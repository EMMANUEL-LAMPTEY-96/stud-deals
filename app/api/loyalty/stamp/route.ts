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
//   6. Insert stamp row into redemptions
//   7. Check if reward threshold reached
//   8. Return stamp progress + reward status
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

interface LoyaltyConfig {
  mode: 'punch_card' | 'first_visit' | 'milestone' | 'standard';
  required_visits?: number;
  reward_type?: string;
  reward_value?: number;
  reward_label?: string;
  min_spend?: number;
}

function parseLoyaltyConfig(termsAndConditions: string | null): LoyaltyConfig | null {
  if (!termsAndConditions) return null;
  const match = termsAndConditions.match(/^\[\[LOYALTY:(.*?)\]\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as LoyaltyConfig;
  } catch {
    return null;
  }
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
  } catch {
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
    .in('status', ['stamp', 'reward_earned'])
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

  // ── 7. Count existing stamps for this student × offer (all time) ───────────
  const { count: existingStamps } = await admin
    .from('redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentProfile.id)
    .eq('offer_id', targetOffer.id)
    .in('status', ['stamp', 'reward_earned']);

  const stampsAfter = (existingStamps ?? 0) + 1;
  const rewardTriggered = stampsAfter % requiredVisits === 0;
  const newStatus = rewardTriggered ? 'reward_earned' : 'stamp';

  // ── 8. Insert the stamp row ────────────────────────────────────────────────
  const now = new Date().toISOString();
  const { error: insertError } = await admin
    .from('redemptions')
    .insert({
      student_id:      studentProfile.id,
      vendor_id:       vendorProfile.id,
      offer_id:        targetOffer.id,
      status:          newStatus,
      redemption_code: `STAMP-${Date.now()}`,
      claimed_at:      now,
      confirmed_at:    now,
      device_type:     'student_scan',   // marks this as student-initiated
    });

  if (insertError) {
    console.error('stamp insert error:', insertError);
    return NextResponse.json({ error: 'Failed to record stamp' }, { status: 500 });
  }

  // ── 9. Build response ──────────────────────────────────────────────────────
  const cyclePosition = stampsAfter % requiredVisits;
  const stampsInCycle = cyclePosition === 0 ? requiredVisits : cyclePosition;

  // Fetch student display name for vendor activity feed
  const { data: profile } = await admin
    .from('profiles')
    .select('first_name, last_name, display_name')
    .eq('id', user.id)
    .maybeSingle();

  const studentName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name ?? ''}`.trim()
    : profile?.display_name ?? 'Student';

  return NextResponse.json({
    success:         true,
    student_name:    studentName,
    vendor_name:     vendorProfile.business_name,
    vendor_logo:     vendorProfile.logo_url,
    vendor_city:     vendorProfile.city,
    offer_title:     targetOffer.title,
    offer_id:        targetOffer.id,
    loyalty_mode:    loyaltyConfig?.mode ?? 'punch_card',
    stamps_total:    stampsAfter,
    stamps_in_cycle: stampsInCycle,
    required_visits: requiredVisits,
    reward_triggered: rewardTriggered,
    reward_label:    rewardLabel,
    stamped_at:      now,
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
    .in('status', ['stamp', 'reward_earned']);

  if (student_profile_id) query = query.eq('student_id', student_profile_id);
  if (vendor_id) query = query.eq('vendor_id', vendor_id);

  const { data, error } = await query.order('confirmed_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ stamps: data ?? [] });
}
