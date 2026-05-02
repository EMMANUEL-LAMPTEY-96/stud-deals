// =============================================================================
// app/api/loyalty/stamp/route.ts
//
// POST — Student scans a vendor's QR code to earn a loyalty stamp.
//
// Flow (student-initiated):
//   1. Student opens app, taps "Earn Stamp", camera opens
//   2. Student scans the vendor's displayed QR code (encodes vendor_profile.id)
//   3. This API is called with { vendor_id } — student identity from auth token
//   4. Rate-limit check: 1 stamp per student per vendor per 8 hours
//   5. Find vendor's active loyalty offer
//   6. Parse loyalty config (supports advanced options)
//   7. Stamp expiry: if last stamp > stamp_expiry_days ago, reset cycle position to 0
//   8. Double stamp window: if current time matches a configured window, award 2× stamps
//   9. First visit bonus: if this is the student's very first scan here, add bonus stamps
//  10. Insert stamp row(s) into redemptions
//  11. Check main cycle reward threshold (required_visits)
//  12. Check tiered reward thresholds
//  13. Return full stamp progress + reward status
//
// Security:
//   - Must be authenticated (student or any role)
//   - Stamp always recorded against the authenticated user — cannot stamp for others
//   - 8-hour cooldown enforced server-side — cannot be bypassed client-side
//   - Vendor QR is just a vendor ID — not a secret, not a one-time code
//     The auth session is what ties the stamp to a specific student
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const STAMP_COOLDOWN_HOURS = 8;

interface DoubleStampWindow {
  days: string[];
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

interface RewardTier {
  stamps: number;
  reward_label: string;
  reward_type: string;
  reward_value?: number;
}

interface LoyaltyConfig {
  mode: 'punch_card' | 'first_visit' | 'milestone' | 'standard';
  required_visits?: number;
  reward_type?: string;
  reward_value?: number;
  reward_label?: string;
  spend_threshold?: number;
  // Advanced options
  first_visit_bonus?: number;
  stamp_expiry_days?: number;
  double_stamp_windows?: DoubleStampWindow[];
  tiers?: RewardTier[];
}

function parseLoyaltyConfig(termsAndConditions: string | null): LoyaltyConfig | null {
  if (!termsAndConditions) return null;
  const match = termsAndConditions.match(/^\[\[LOYALTY:(.*?)\]\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as LoyaltyConfig;
  } catch (_) {
    return null;
  }
}

// Check if the current time (UTC) falls within a double-stamp window
function isDoubleStampWindow(windows: DoubleStampWindow[]): boolean {
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Europe/Budapest' }).toLowerCase();
  const currentTime = now.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Budapest',
  }); // "HH:MM"

  for (const win of windows) {
    if (!win.days.includes(currentDay)) continue;
    if (currentTime >= win.start && currentTime <= win.end) return true;
  }
  return false;
}

export async function POST(request: NextRequest) {
  // ── 1. Auth: any authenticated user (student) ──────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Parse body ──────────────────────────────────────────────────────────
  let body: { vendor_id?: string };
  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { vendor_id } = body;
  if (!vendor_id) {
    return NextResponse.json({ error: 'vendor_id is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── 3. Look up the student profile for this authenticated user ─────────────
  const { data: studentProfile } = await admin
    .from('student_profiles')
    .select('id, verification_status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!studentProfile) {
    return NextResponse.json({
      error: 'Student profile not found. Please complete your student profile first.',
    }, { status: 404 });
  }

  // ── 4. Look up the vendor ──────────────────────────────────────────────────
  const { data: vendorProfile } = await admin
    .from('vendor_profiles')
    .select('id, business_name, logo_url, city, is_verified')
    .eq('id', vendor_id)
    .maybeSingle();

  if (!vendorProfile) {
    return NextResponse.json({
      error: 'Business not found. Make sure you scanned the correct QR code.',
    }, { status: 404 });
  }

  if (!vendorProfile.is_verified) {
    return NextResponse.json({
      error: 'This business is not yet verified on Stud Deals.',
    }, { status: 403 });
  }

  // ── 5. Rate limit: 1 stamp per student per vendor per 8 hours ─────────────
  const cooldownCutoff = new Date(
    Date.now() - STAMP_COOLDOWN_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: recentStamp } = await admin
    .from('redemptions')
    .select('id, confirmed_at')
    .eq('student_id', studentProfile.id)
    .eq('vendor_id', vendorProfile.id)
    .in('status', ['stamp', 'reward_earned', 'tier_reward'])
    .gte('confirmed_at', cooldownCutoff)
    .order('confirmed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentStamp) {
    const nextAllowed = new Date(
      new Date(recentStamp.confirmed_at).getTime() + STAMP_COOLDOWN_HOURS * 60 * 60 * 1000
    );
    const hoursLeft = Math.ceil((nextAllowed.getTime() - Date.now()) / (1000 * 60 * 60));
    return NextResponse.json({
      error: `You already stamped here recently. Come back in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}!`,
      error_code: 'RATE_LIMITED',
      next_allowed_at: nextAllowed.toISOString(),
    }, { status: 429 });
  }

  // ── 6. Find vendor's active loyalty offer ──────────────────────────────────
  const { data: offers } = await admin
    .from('offers')
    .select('id, title, terms_and_conditions')
    .eq('vendor_id', vendorProfile.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(10);

  // Prefer offers with a loyalty config, fall back to first active offer
  const targetOffer = offers?.find(
    (o) => parseLoyaltyConfig(o.terms_and_conditions) !== null
  ) ?? offers?.[0] ?? null;

  if (!targetOffer) {
    return NextResponse.json({
      error: 'This business has no active loyalty program yet.',
    }, { status: 404 });
  }

  const loyaltyConfig = parseLoyaltyConfig(targetOffer.terms_and_conditions);
  const requiredVisits = loyaltyConfig?.required_visits ?? 5;
  const rewardLabel = loyaltyConfig?.reward_label ?? 'Free item';

  // ── 7. Count existing stamps for this student × offer (all time) ──────────
  // We fetch all stamp rows (not just count) so we can check expiry date
  const { data: allStampRows } = await admin
    .from('redemptions')
    .select('id, status, confirmed_at')
    .eq('student_id', studentProfile.id)
    .eq('offer_id', targetOffer.id)
    .in('status', ['stamp', 'reward_earned', 'tier_reward'])
    .order('confirmed_at', { ascending: false });

  const allStamps = allStampRows ?? [];

  // ── 8. Stamp expiry: determine effective cycle-position stamps ────────────
  // If the most recent stamp is older than stamp_expiry_days, the cycle resets.
  // We only count stamps within the current "active window" (since the last expiry reset).
  let effectiveStampCount = allStamps.length;

  if (loyaltyConfig?.stamp_expiry_days && allStamps.length > 0) {
    const mostRecentStampDate = new Date(allStamps[0].confirmed_at);
    const daysSinceLastStamp = (Date.now() - mostRecentStampDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceLastStamp > loyaltyConfig.stamp_expiry_days) {
      // Stamps have expired — treat the cycle as starting fresh
      effectiveStampCount = 0;
    }
  }

  // ── 9. Determine cycle position before this visit ─────────────────────────
  const cyclePositionBefore = effectiveStampCount % requiredVisits;

  // ── 10. Check if this is the student's very first visit (bonus stamps) ─────
  const isFirstVisit = allStamps.length === 0;

  // ── 11. Check double stamp window ─────────────────────────────────────────
  const inDoubleWindow =
    loyaltyConfig?.double_stamp_windows &&
    loyaltyConfig.double_stamp_windows.length > 0 &&
    isDoubleStampWindow(loyaltyConfig.double_stamp_windows);

  // ── 12. Calculate stamps to award this visit ───────────────────────────────
  let stampsToAward = 1;
  if (inDoubleWindow) stampsToAward = 2;

  let bonusStamps = 0;
  if (isFirstVisit && loyaltyConfig?.first_visit_bonus) {
    bonusStamps = loyaltyConfig.first_visit_bonus;
  }

  const totalNewStamps = stampsToAward + bonusStamps;
  const stampsAfter = effectiveStampCount + totalNewStamps;

  // ── 13. Determine reward status ────────────────────────────────────────────
  // Main cycle reward: triggered if we crossed a multiple of requiredVisits
  const cyclePositionAfter = stampsAfter % requiredVisits;
  const completedCyclesBefore = Math.floor(effectiveStampCount / requiredVisits);
  const completedCyclesAfter  = Math.floor(stampsAfter / requiredVisits);
  const rewardTriggered = completedCyclesAfter > completedCyclesBefore;

  // Tier rewards: find any tiers whose threshold we just crossed
  // Track already-claimed tier rewards to avoid double-firing
  const { data: claimedTierRows } = await admin
    .from('redemptions')
    .select('redemption_code')
    .eq('student_id', studentProfile.id)
    .eq('offer_id', targetOffer.id)
    .eq('status', 'tier_reward');

  const claimedTierCodes = new Set((claimedTierRows ?? []).map(r => r.redemption_code));

  // Find tiers triggered by this stamp batch (within the current cycle)
  const triggeredTiers: RewardTier[] = [];
  if (loyaltyConfig?.tiers && loyaltyConfig.tiers.length > 0) {
    for (const tier of loyaltyConfig.tiers) {
      // Only fire if we crossed this tier's threshold in the current cycle
      const tierCycleStamp = tier.stamps % requiredVisits || requiredVisits;
      const tierCode = `TIER-${tier.stamps}-CYCLE-${completedCyclesAfter}`;
      const alreadyClaimed = claimedTierCodes.has(tierCode);

      const crossedInThisBatch = (
        !alreadyClaimed &&
        cyclePositionBefore < tierCycleStamp &&
        (cyclePositionAfter >= tierCycleStamp || rewardTriggered)
      );

      if (crossedInThisBatch) {
        triggeredTiers.push(tier);
      }
    }
  }

  // ── 14. Insert all stamp rows ──────────────────────────────────────────────
  const now = new Date().toISOString();
  const mainStatus = rewardTriggered ? 'reward_earned' : 'stamp';

  const insertRows: object[] = [];

  // Primary stamp (or first of double)
  insertRows.push({
    student_id:      studentProfile.id,
    vendor_id:       vendorProfile.id,
    offer_id:        targetOffer.id,
    status:          mainStatus,
    redemption_code: `STAMP-${Date.now()}`,
    claimed_at:      now,
    confirmed_at:    now,
    device_type:     'student_scan',
  });

  // Second stamp for double-window
  if (inDoubleWindow) {
    insertRows.push({
      student_id:      studentProfile.id,
      vendor_id:       vendorProfile.id,
      offer_id:        targetOffer.id,
      status:          'stamp',
      redemption_code: `STAMP-DOUBLE-${Date.now() + 1}`,
      claimed_at:      now,
      confirmed_at:    now,
      device_type:     'student_scan_double',
    });
  }

  // Bonus first-visit stamps
  for (let i = 0; i < bonusStamps; i++) {
    insertRows.push({
      student_id:      studentProfile.id,
      vendor_id:       vendorProfile.id,
      offer_id:        targetOffer.id,
      status:          'stamp',
      redemption_code: `STAMP-BONUS-${Date.now() + 10 + i}`,
      claimed_at:      now,
      confirmed_at:    now,
      device_type:     'student_scan_first_visit_bonus',
    });
  }

  // Tier reward rows
  for (const tier of triggeredTiers) {
    const tierCode = `TIER-${tier.stamps}-CYCLE-${completedCyclesAfter}`;
    insertRows.push({
      student_id:      studentProfile.id,
      vendor_id:       vendorProfile.id,
      offer_id:        targetOffer.id,
      status:          'tier_reward',
      redemption_code: tierCode,
      claimed_at:      now,
      confirmed_at:    now,
      device_type:     'student_scan',
    });
  }

  const { error: insertError } = await admin
    .from('redemptions')
    .insert(insertRows as never[]);

  if (insertError) {
    console.error('stamp insert error:', insertError);
    return NextResponse.json({ error: 'Failed to record stamp' }, { status: 500 });
  }

  // ── 15. Build response ─────────────────────────────────────────────────────
  const finalCyclePosition = stampsAfter % requiredVisits;
  const stampsInCycle = finalCyclePosition === 0 ? requiredVisits : finalCyclePosition;

  // Fetch student display name for vendor activity feed
  const { data: profile } = await admin
    .from('profiles')
    .select('first_name, last_name, display_name')
    .eq('id', user.id)
    .maybeSingle();

  const studentName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name ?? ''}`.trim()
    : profile?.display_name ?? 'Student';

  // Primary reward info for the response
  // If a tier reward fired but the main cycle didn't, surface the tier reward
  const primaryTier = triggeredTiers.length > 0 ? triggeredTiers[triggeredTiers.length - 1] : null;
  const effectiveRewardTriggered = rewardTriggered || triggeredTiers.length > 0;
  const effectiveRewardLabel = rewardTriggered
    ? rewardLabel
    : primaryTier?.reward_label ?? rewardLabel;

  return NextResponse.json({
    success:          true,
    student_name:     studentName,
    vendor_name:      vendorProfile.business_name,
    vendor_logo:      vendorProfile.logo_url,
    vendor_city:      vendorProfile.city,
    offer_title:      targetOffer.title,
    offer_id:         targetOffer.id,
    loyalty_mode:     loyaltyConfig?.mode ?? 'punch_card',
    // Stamp counts
    stamps_total:     allStamps.length + totalNewStamps, // includes all historical + today
    stamps_in_cycle:  stampsInCycle,
    required_visits:  requiredVisits,
    stamps_awarded:   totalNewStamps,
    // Reward status
    reward_triggered: effectiveRewardTriggered,
    reward_label:     effectiveRewardLabel,
    main_reward_triggered: rewardTriggered,
    // Context flags
    is_first_visit:   isFirstVisit,
    double_stamp:     inDoubleWindow,
    bonus_stamps:     bonusStamps,
    // Tier details (if any fired)
    tier_rewards:     triggeredTiers.map(t => ({
      stamps:       t.stamps,
      reward_label: t.reward_label,
      reward_type:  t.reward_type,
      reward_value: t.reward_value,
    })),
    // Metadata
    stamped_at:       now,
  });
}

// GET — fetch a student's loyalty progress at a specific vendor
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const student_profile_id = searchParams.get('student_id');
  const vendor_id = searchParams.get('vendor_id');

  if (!student_profile_id && !vendor_id) {
    return NextResponse.json({ error: 'student_id or vendor_id required' }, { status: 400 });
  }

  const admin = createAdminClient();

  let query = admin
    .from('redemptions')
    .select('id, student_id, vendor_id, offer_id, status, stamped_at:confirmed_at, offer:offers(id, title, terms_and_conditions, vendor:vendor_profiles(id, business_name, logo_url))')
    .in('status', ['stamp', 'reward_earned', 'tier_reward']);

  if (student_profile_id) query = query.eq('student_id', student_profile_id);
  if (vendor_id) query = query.eq('vendor_id', vendor_id);

  const { data, error } = await query.order('confirmed_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ stamps: data ?? [] });
}
