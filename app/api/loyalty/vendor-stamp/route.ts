// =============================================================================
// app/api/loyalty/vendor-stamp/route.ts
//
// POST — Vendor scans student's time-based QR code to award a loyalty stamp.
//
// Flow (vendor-initiated):
//   1. Student opens Loyalty page — a 90-second time-based QR is displayed
//   2. Vendor opens their Scanner page and points camera at student's screen
//   3. Scanner sends scanned payload here as { qr_payload }
//   4. Server validates: HMAC signature + expiry — rejects forged/expired codes
//   5. Vendor identity from auth token → vendor_profile looked up
//   6. Student identity from QR payload → student_profile looked up
//   7. 8-hour per-vendor cooldown enforced
//   8. Active loyalty offer found for this vendor
//   9. Double stamp, first-visit bonus, tier rewards calculated
//  10. Stamp row(s) inserted into redemptions
//  11. Notifications fired
//  12. Stamp progress returned to vendor (show on their screen)
//
// Security:
//   - Must be authenticated as a vendor
//   - HMAC prevents forging QR codes for students who haven't visited
//   - 90s expiry prevents screenshot-sharing between students
//   - 8-hour cooldown prevents the same student being stamped twice in a visit
//   - Vendor can only stamp at their own venue
// =============================================================================

import { safeLog } from '@/lib/utils/safe-logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';
import {
  parseLoyaltyConfig,
  isDoubleStampWindow,
  type RewardTier,
} from '@/lib/utils/loyalty';
import { validateStampPayload } from '@/lib/utils/stamp-qr';
import { sendEmail } from '@/lib/email/resend';
import { rewardEarnedEmail } from '@/lib/email/templates';
import { z } from 'zod';

const STAMP_COOLDOWN_HOURS = 8;

// ── Input schema ──────────────────────────────────────────────────────────────
const VendorStampSchema = z.object({
  qr_payload: z.string().min(1).max(500),
});

export async function POST(request: NextRequest) {
  // ── 1. Auth: vendor only ───────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Confirm caller is a vendor (VULN-17: explicit role check)
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!callerProfile || (callerProfile.role !== 'vendor' && callerProfile.role !== 'admin')) {
    return NextResponse.json({ error: 'Vendor account required.' }, { status: 403 });
  }

  // ── 2. Parse + validate body ───────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = VendorStampSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Missing qr_payload field.', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { qr_payload } = parsed.data;

  // ── 3. Validate QR payload (HMAC + expiry) ─────────────────────────────────
  const validation = validateStampPayload(qr_payload);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error, error_code: validation.error_code },
      { status: 403 }
    );
  }

  const { studentProfileId } = validation;

  // ── 4. Look up student profile ────────────────────────────────────────────
  const { data: studentProfile } = await admin
    .from('student_profiles')
    .select('id, user_id, verification_status')
    .eq('id', studentProfileId)
    .maybeSingle();

  if (!studentProfile) {
    return NextResponse.json(
      { error: 'Student not found. The QR may belong to a deleted account.' },
      { status: 404 }
    );
  }

  if (studentProfile.verification_status !== 'verified') {
    return NextResponse.json(
      {
        error: 'This student has not completed verification yet.',
        error_code: 'STUDENT_UNVERIFIED',
      },
      { status: 403 }
    );
  }

  // ── 5. Look up vendor profile (from auth token — vendor can only stamp at own venue) ──
  const { data: vendorProfile } = await admin
    .from('vendor_profiles')
    .select('id, business_name, logo_url, city, is_verified, user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!vendorProfile) {
    return NextResponse.json(
      { error: 'Vendor profile not found.' },
      { status: 404 }
    );
  }

  if (!vendorProfile.is_verified) {
    return NextResponse.json(
      { error: 'Your business is not yet verified on Studeals.' },
      { status: 403 }
    );
  }

  // ── 6. Rate limit: 1 stamp per student per vendor per 8 hours ─────────────
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
      new Date(recentStamp.confirmed_at).getTime() +
        STAMP_COOLDOWN_HOURS * 60 * 60 * 1000
    );
    const hoursLeft = Math.ceil(
      (nextAllowed.getTime() - Date.now()) / (1000 * 60 * 60)
    );
    return NextResponse.json(
      {
        error: `This student was already stamped here recently. Next stamp available in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}.`,
        error_code: 'RATE_LIMITED',
        next_allowed_at: nextAllowed.toISOString(),
      },
      { status: 429 }
    );
  }

  // ── 7. Find vendor's active loyalty offer ──────────────────────────────────
  const { data: offers } = await admin
    .from('offers')
    .select('id, title, terms_and_conditions')
    .eq('vendor_id', vendorProfile.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(10);

  const targetOffer =
    offers?.find((o) => parseLoyaltyConfig(o.terms_and_conditions) !== null) ??
    offers?.[0] ??
    null;

  if (!targetOffer) {
    return NextResponse.json(
      { error: 'No active loyalty programme found for your business.' },
      { status: 404 }
    );
  }

  const loyaltyConfig = parseLoyaltyConfig(targetOffer.terms_and_conditions);
  const requiredVisits = loyaltyConfig?.required_visits ?? 5;
  const rewardLabel = loyaltyConfig?.reward_label ?? 'Free item';

  // ── 8. Count existing stamps (all-time) for this student × offer ──────────
  const { data: allStampRows } = await admin
    .from('redemptions')
    .select('id, status, confirmed_at')
    .eq('student_id', studentProfile.id)
    .eq('offer_id', targetOffer.id)
    .in('status', ['stamp', 'reward_earned', 'tier_reward'])
    .order('confirmed_at', { ascending: false });

  const allStamps = allStampRows ?? [];

  // ── 9. Stamp expiry: determine effective cycle-position ───────────────────
  let effectiveStampCount = allStamps.length;

  if (loyaltyConfig?.stamp_expiry_days && allStamps.length > 0) {
    const mostRecentDate = new Date(allStamps[0].confirmed_at);
    const daysSince =
      (Date.now() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > loyaltyConfig.stamp_expiry_days) {
      effectiveStampCount = 0;
    }
  }

  // ── 10. Cycle position before this visit ──────────────────────────────────
  const cyclePositionBefore = effectiveStampCount % requiredVisits;

  // ── 11. First visit + double stamp checks ─────────────────────────────────
  const isFirstVisit = allStamps.length === 0;
  const inDoubleWindow =
    !!loyaltyConfig?.double_stamp_windows?.length &&
    isDoubleStampWindow(loyaltyConfig.double_stamp_windows);

  // ── 12. Stamps to award ───────────────────────────────────────────────────
  let stampsToAward = 1;
  if (inDoubleWindow) stampsToAward = 2;

  let bonusStamps = 0;
  if (isFirstVisit && loyaltyConfig?.first_visit_bonus) {
    bonusStamps = loyaltyConfig.first_visit_bonus;
  }

  const totalNewStamps = stampsToAward + bonusStamps;
  const stampsAfter = effectiveStampCount + totalNewStamps;

  // ── 13. Reward status ─────────────────────────────────────────────────────
  const cyclePositionAfter = stampsAfter % requiredVisits;
  const completedCyclesBefore = Math.floor(effectiveStampCount / requiredVisits);
  const completedCyclesAfter = Math.floor(stampsAfter / requiredVisits);
  const rewardTriggered = completedCyclesAfter > completedCyclesBefore;

  // Tier rewards
  const { data: claimedTierRows } = await admin
    .from('redemptions')
    .select('redemption_code')
    .eq('student_id', studentProfile.id)
    .eq('offer_id', targetOffer.id)
    .eq('status', 'tier_reward');

  const claimedTierCodes = new Set(
    (claimedTierRows ?? []).map((r) => r.redemption_code)
  );

  const triggeredTiers: RewardTier[] = [];
  if (loyaltyConfig?.tiers?.length) {
    for (const tier of loyaltyConfig.tiers) {
      const tierCycleStamp = tier.stamps % requiredVisits || requiredVisits;
      const tierCode = `TIER-${tier.stamps}-CYCLE-${completedCyclesAfter}`;
      const alreadyClaimed = claimedTierCodes.has(tierCode);

      const crossedInThisBatch =
        !alreadyClaimed &&
        cyclePositionBefore < tierCycleStamp &&
        (cyclePositionAfter >= tierCycleStamp || rewardTriggered);

      if (crossedInThisBatch) triggeredTiers.push(tier);
    }
  }

  // ── 14. Insert stamp rows ─────────────────────────────────────────────────
  const now = new Date().toISOString();
  const mainStatus = rewardTriggered ? 'reward_earned' : 'stamp';

  const secureStampCode = (prefix: string) =>
    `${prefix}-${randomBytes(12).toString('hex').toUpperCase()}`;

  const insertRows: object[] = [
    {
      student_id:      studentProfile.id,
      vendor_id:       vendorProfile.id,
      offer_id:        targetOffer.id,
      status:          mainStatus,
      redemption_code: secureStampCode('VSTAMP'),
      claimed_at:      now,
      confirmed_at:    now,
      device_type:     'vendor_scan',
    },
  ];

  if (inDoubleWindow) {
    insertRows.push({
      student_id:      studentProfile.id,
      vendor_id:       vendorProfile.id,
      offer_id:        targetOffer.id,
      status:          'stamp',
      redemption_code: secureStampCode('VSTAMP-DOUBLE'),
      claimed_at:      now,
      confirmed_at:    now,
      device_type:     'vendor_scan_double',
    });
  }

  for (let i = 0; i < bonusStamps; i++) {
    insertRows.push({
      student_id:      studentProfile.id,
      vendor_id:       vendorProfile.id,
      offer_id:        targetOffer.id,
      status:          'stamp',
      redemption_code: secureStampCode('VSTAMP-BONUS'),
      claimed_at:      now,
      confirmed_at:    now,
      device_type:     'vendor_scan_first_visit_bonus',
    });
  }

  for (const tier of triggeredTiers) {
    insertRows.push({
      student_id:      studentProfile.id,
      vendor_id:       vendorProfile.id,
      offer_id:        targetOffer.id,
      status:          'tier_reward',
      redemption_code: `TIER-${tier.stamps}-CYCLE-${completedCyclesAfter}`,
      claimed_at:      now,
      confirmed_at:    now,
      device_type:     'vendor_scan',
    });
  }

  const { error: insertError } = await admin
    .from('redemptions')
    .insert(insertRows as never[]);

  if (insertError) {
    safeLog.error('vendor-stamp insert error:', insertError);
    return NextResponse.json(
      { error: 'Failed to record stamp. Please try again.' },
      { status: 500 }
    );
  }

  // ── 15. Notifications (fire-and-forget) ───────────────────────────────────
  const notifRows: object[] = [];
  const vendorName = vendorProfile.business_name ?? 'the venue';
  const almostThere = cyclePositionAfter === requiredVisits - 1 && !rewardTriggered;

  if (almostThere) {
    notifRows.push({
      user_id:    studentProfile.user_id,
      type:       'almost_there',
      title:      '🎯 Just 1 stamp away!',
      body:       `Visit ${vendorName} one more time to earn: ${rewardLabel}`,
      action_url: '/loyalty',
      is_read:    false,
    });
  }

  if (rewardTriggered) {
    notifRows.push({
      user_id:    studentProfile.user_id,
      type:       'reward_earned',
      title:      '🎉 Reward unlocked!',
      body:       `You earned "${rewardLabel}" at ${vendorName}. Show this to redeem it.`,
      action_url: '/loyalty',
      is_read:    false,
    });
  }

  for (const tier of triggeredTiers) {
    notifRows.push({
      user_id:    studentProfile.user_id,
      type:       'tier_reward',
      title:      '⭐ Milestone reward!',
      body:       `You unlocked "${tier.reward_label}" at ${vendorName}!`,
      action_url: '/loyalty',
      is_read:    false,
    });
  }

  if (notifRows.length > 0) {
    admin
      .from('notifications')
      .insert(notifRows as never[])
      .then(({ error: e }) => {
        if (e) safeLog.error('vendor-stamp notification error:', e.message);
      });
  }

  // ── 16. Vendor reward email (fire-and-forget) ─────────────────────────────
  if (rewardTriggered) {
    (async () => {
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(
          vendorProfile.user_id
        );
        const vendorEmail = authUser?.user?.email;
        if (!vendorEmail) return;

        const { subject, html } = rewardEarnedEmail({
          vendorBusinessName: vendorName,
          offerTitle:         targetOffer.title,
          rewardLabel,
          studentDisplayName: 'A student',
          stampsRequired:     requiredVisits,
          earnedAt:           now,
        });
        await sendEmail({ to: vendorEmail, subject, html });
      } catch {
        // Non-critical
      }
    })();
  }

  // ── 17. Fetch student display name for vendor UI ───────────────────────────
  const { data: profile } = await admin
    .from('profiles')
    .select('first_name, last_name, display_name')
    .eq('id', studentProfile.user_id)
    .maybeSingle();

  const studentName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name ?? ''}`.trim()
    : profile?.display_name ?? 'Student';

  // ── 18. Build response ────────────────────────────────────────────────────
  const finalCyclePosition = stampsAfter % requiredVisits;
  const stampsInCycle =
    finalCyclePosition === 0 ? requiredVisits : finalCyclePosition;

  const primaryTier =
    triggeredTiers.length > 0 ? triggeredTiers[triggeredTiers.length - 1] : null;
  const effectiveRewardTriggered = rewardTriggered || triggeredTiers.length > 0;
  const effectiveRewardLabel = rewardTriggered
    ? rewardLabel
    : primaryTier?.reward_label ?? rewardLabel;

  return NextResponse.json({
    success:               true,
    student_name:          studentName,
    vendor_name:           vendorProfile.business_name,
    vendor_logo:           vendorProfile.logo_url,
    offer_title:           targetOffer.title,
    offer_id:              targetOffer.id,
    loyalty_mode:          loyaltyConfig?.mode ?? 'punch_card',
    stamps_total:          allStamps.length + totalNewStamps,
    stamps_in_cycle:       stampsInCycle,
    required_visits:       requiredVisits,
    stamps_awarded:        totalNewStamps,
    reward_triggered:      effectiveRewardTriggered,
    reward_label:          effectiveRewardLabel,
    main_reward_triggered: rewardTriggered,
    almost_there:          almostThere,
    is_first_visit:        isFirstVisit,
    double_stamp:          inDoubleWindow,
    bonus_stamps:          bonusStamps,
    tier_rewards:          triggeredTiers.map((t) => ({
      stamps:       t.stamps,
      reward_label: t.reward_label,
      reward_type:  t.reward_type,
      reward_value: t.reward_value,
    })),
    stamped_at: now,
  });
}
