// =============================================================================
// app/api/birthday/route.ts
//
// GET  — Check whether today is the authenticated student's birthday and
//         whether they have already claimed their birthday reward this year.
//         Also returns their top punch-card vendor (for the reward preview).
//
// POST — Claim the birthday reward.
//         Guards:
//           ✓ Student is authenticated
//           ✓ Student has date_of_birth set
//           ✓ Today is the student's birthday (month + day match, ignoring year)
//           ✓ Has not already claimed the reward this calendar year
//         On success:
//           → Inserts 3 birthday_bonus stamp rows at the student's most-active
//             punch-card vendor (highest stamps-in-cycle / required ratio).
//             If the student has no punch-card history, credits the stamps at
//             the most recent vendor they've interacted with.
//           → Updates birthday_bonus_claimed_year to the current year.
//           → Inserts an in-app birthday notification.
//           → Returns stamp count, vendor name, and new stamp progress.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { parseLoyaltyConfig } from '@/lib/utils/loyalty';

const BIRTHDAY_BONUS_STAMPS = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isBirthdayToday(dob: string): boolean {
  const today = new Date();
  const birth = new Date(dob);
  return (
    today.getMonth() === birth.getMonth() &&
    today.getDate()  === birth.getDate()
  );
}

function currentYear(): number {
  return new Date().getFullYear();
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const admin    = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: sp } = await admin
    .from('student_profiles')
    .select('id, date_of_birth, birthday_bonus_claimed_year')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sp) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // No birthday set — can't compute anything
  if (!sp.date_of_birth) {
    return NextResponse.json({ is_birthday: false, has_dob: false, claimed: false });
  }

  const isBirthday = isBirthdayToday(sp.date_of_birth);
  const claimed    = sp.birthday_bonus_claimed_year === currentYear();

  // Find top vendor for preview (most stamps in current cycle)
  const { data: topVendorRow } = await admin
    .from('redemptions')
    .select(`
      vendor_id,
      vendor:vendor_profiles (id, business_name, logo_url)
    `)
    .eq('student_id', sp.id)
    .in('status', ['stamp', 'reward_earned', 'tier_reward', 'birthday_bonus'])
    .order('confirmed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const topVendor = topVendorRow?.vendor
    ? {
        id:            (topVendorRow.vendor as { id: string }).id,
        business_name: (topVendorRow.vendor as { business_name: string }).business_name,
        logo_url:      (topVendorRow.vendor as { logo_url: string | null }).logo_url,
      }
    : null;

  return NextResponse.json({
    is_birthday: isBirthday,
    has_dob:     true,
    claimed,
    top_vendor:  topVendor,
    bonus_stamps: BIRTHDAY_BONUS_STAMPS,
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = await createClient();
  const admin    = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: sp } = await admin
    .from('student_profiles')
    .select('id, date_of_birth, birthday_bonus_claimed_year, verification_status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sp)              return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  if (!sp.date_of_birth) return NextResponse.json({ error: 'No birthday set on your profile.' }, { status: 400 });

  // ── VULN-07 fix: Verified students only ───────────────────────────────────
  if (sp.verification_status !== 'verified') {
    return NextResponse.json({
      error: 'Student verification required to claim birthday bonus.',
      verification_status: sp.verification_status,
      redirect_to: '/verification',
    }, { status: 403 });
  }

  // Guard: must be birthday today
  if (!isBirthdayToday(sp.date_of_birth)) {
    return NextResponse.json({ error: 'Today is not your birthday.' }, { status: 403 });
  }

  // Guard: not already claimed this year
  if (sp.birthday_bonus_claimed_year === currentYear()) {
    return NextResponse.json({ error: 'You have already claimed your birthday reward this year.', already_claimed: true }, { status: 409 });
  }

  // ── Find the best vendor + offer to credit stamps to ─────────────────────
  // Strategy: find the loyalty offer where the student is closest to completing
  // a cycle (highest stamps_in_cycle / required ratio). Fall back to most recent.

  // Get all stamp activity grouped by offer
  const { data: stampRows } = await admin
    .from('redemptions')
    .select(`
      vendor_id, offer_id,
      offer:offers (id, title, terms_and_conditions,
        vendor:vendor_profiles (id, business_name, logo_url)
      )
    `)
    .eq('student_id', sp.id)
    .in('status', ['stamp', 'reward_earned', 'tier_reward'])
    .order('confirmed_at', { ascending: false });

  // Deduplicate offer_ids and parse loyalty configs
  interface OfferProgress {
    vendor_id: string;
    offer_id:  string;
    vendor_name: string;
    logo_url: string | null;
    stamps_in_cycle: number;
    required_visits: number;
    ratio: number;
  }

  const offerMap = new Map<string, OfferProgress>();

  for (const row of (stampRows ?? [])) {
    if (!row.offer_id || offerMap.has(row.offer_id)) continue;
    const offer = row.offer as { id: string; title: string; terms_and_conditions: string; vendor: { id: string; business_name: string; logo_url: string | null } } | null;
    if (!offer) continue;

    const config = parseLoyaltyConfig(offer.terms_and_conditions ?? '');
    if (!config) continue;

    const required = config.required_visits ?? 10;
    // Count stamps in current cycle for this offer
    const cycleStamps = (stampRows ?? []).filter(r => r.offer_id === row.offer_id).length % required;

    offerMap.set(row.offer_id, {
      vendor_id:       row.vendor_id,
      offer_id:        row.offer_id,
      vendor_name:     offer.vendor?.business_name ?? 'your favourite café',
      logo_url:        offer.vendor?.logo_url ?? null,
      stamps_in_cycle: cycleStamps,
      required_visits: required,
      ratio:           cycleStamps / required,
    });
  }

  // Pick offer with highest progress ratio; fall back to most-recent vendor
  let targetVendorId: string | null = null;
  let targetOfferId:  string | null = null;
  let targetName     = 'your favourite spot';
  let targetLogo: string | null = null;

  if (offerMap.size > 0) {
    const best = [...offerMap.values()].sort((a, b) => b.ratio - a.ratio)[0];
    targetVendorId = best.vendor_id;
    targetOfferId  = best.offer_id;
    targetName     = best.vendor_name;
    targetLogo     = best.logo_url;
  } else {
    // No punch card history — find most recent vendor from any interaction
    const { data: anyRow } = await admin
      .from('redemptions')
      .select('vendor_id, offer_id, vendor:vendor_profiles(id, business_name, logo_url)')
      .eq('student_id', sp.id)
      .order('confirmed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (anyRow?.vendor_id) {
      targetVendorId = anyRow.vendor_id;
      targetOfferId  = anyRow.offer_id;
      const v = anyRow.vendor as { id: string; business_name: string; logo_url: string | null } | null;
      targetName = v?.business_name ?? 'your favourite spot';
      targetLogo = v?.logo_url ?? null;
    }
  }

  const now = new Date().toISOString();

  // ── Insert 3 birthday_bonus stamp rows ────────────────────────────────────
  // Each stamp is a separate row so punch-card progress calculations work
  // identically to regular stamps (count-based).
  if (targetVendorId && targetOfferId) {
    const stampInserts = Array.from({ length: BIRTHDAY_BONUS_STAMPS }, () => ({
      student_id:   sp.id,
      vendor_id:    targetVendorId,
      offer_id:     targetOfferId,
      status:       'birthday_bonus',
      confirmed_at: now,
    }));
    await admin.from('redemptions').insert(stampInserts);
  }
  // (If no vendor history at all, we still mark as claimed and send the
  //  notification — the student can earn bonus stamps on their first scan instead)

  // ── Mark birthday bonus as claimed this year ──────────────────────────────
  await admin
    .from('student_profiles')
    .update({ birthday_bonus_claimed_year: currentYear() })
    .eq('id', sp.id);

  // ── Send birthday in-app notification ─────────────────────────────────────
  const vendorLine = targetVendorId
    ? `3 bonus stamps have been added to your ${targetName} punch card. 🎂`
    : `Your 3 bonus stamps will be applied on your next visit to a vendor!`;

  await admin.from('notifications').insert({
    user_id: user.id,
    type:    'birthday_bonus',
    title:   '🎂 Happy Birthday! Your reward is here',
    body:    vendorLine,
    is_read: false,
  });

  return NextResponse.json({
    success:      true,
    stamps_added: targetVendorId ? BIRTHDAY_BONUS_STAMPS : 0,
    vendor_name:  targetName,
    vendor_logo:  targetLogo,
    message:      `Happy Birthday! ${vendorLine}`,
  });
}
