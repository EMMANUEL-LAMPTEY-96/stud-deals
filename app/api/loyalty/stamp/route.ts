// =============================================================================
// app/api/loyalty/stamp/route.ts
//
// POST — Vendor scans a student's loyalty QR code to log a stamp.
//
// This is the CORE loyalty action. The student shows their QR code (which
// encodes their student_profiles.id). The vendor scans it. We:
//   1. Verify the caller is an authenticated vendor
//   2. Look up the student by their profile ID
//   3. Find which loyalty program (offer) to stamp — vendor's active loyalty offer
//   4. Insert a 'stamp' row into the redemptions table
//   5. Count total stamps for this student × offer combo
//   6. If stamps % required_visits === 0 → mark this stamp as reward_earned
//   7. Return student info + stamp progress + reward status
//
// The student QR code encodes their student_profiles.id UUID.
// No one-time codes needed — the student's ID IS their loyalty card.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

interface LoyaltyConfig {
  mode: 'punch_card' | 'first_visit' | 'milestone' | 'standard';
  required_visits?: number;         // punch_card
  reward_type?: string;
  reward_value?: number;
  reward_label?: string;
  min_spend?: number;               // milestone
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
  // ── 1. Auth: must be a logged-in vendor ────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Parse body ──────────────────────────────────────────────────────────
  let body: { student_profile_id?: string; offer_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { student_profile_id, offer_id } = body;
  if (!student_profile_id) {
    return NextResponse.json({ error: 'student_profile_id is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── 3. Get vendor profile ──────────────────────────────────────────────────
  const { data: vendorProfile } = await admin
    .from('vendor_profiles')
    .select('id, business_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!vendorProfile) {
    return NextResponse.json({ error: 'Vendor profile not found' }, { status: 403 });
  }

  // ── 4. Look up student ─────────────────────────────────────────────────────
  const { data: studentProfile } = await admin
    .from('student_profiles')
    .select('id, user_id, verification_status')
    .eq('id', student_profile_id)
    .maybeSingle();

  if (!studentProfile) {
    return NextResponse.json({
      error: 'Student not found. Make sure you scanned the correct QR code.',
    }, { status: 404 });
  }

  // Fetch student display name from profiles
  const { data: profile } = await admin
    .from('profiles')
    .select('first_name, last_name, display_name')
    .eq('id', studentProfile.user_id)
    .maybeSingle();

  const studentName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name ?? ''}`.trim()
    : profile?.display_name ?? 'Student';

  // ── 5. Find which loyalty offer to stamp ───────────────────────────────────
  // If offer_id was passed (vendor chose a specific program), use that.
  // Otherwise, find the vendor's active loyalty offer automatically.
  let targetOffer: { id: string; title: string; terms_and_conditions: string | null } | null = null;

  if (offer_id) {
    const { data } = await admin
      .from('offers')
      .select('id, title, terms_and_conditions')
      .eq('id', offer_id)
      .eq('vendor_id', vendorProfile.id)
      .maybeSingle();
    targetOffer = data;
  } else {
    // Auto-pick the first active loyalty offer for this vendor
    const { data: offers } = await admin
      .from('offers')
      .select('id, title, terms_and_conditions')
      .eq('vendor_id', vendorProfile.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(10);

    // Find one with a loyalty config
    targetOffer = offers?.find(
      (o) => parseLoyaltyConfig(o.terms_and_conditions) !== null
    ) ?? offers?.[0] ?? null;
  }

  if (!targetOffer) {
    return NextResponse.json({
      error: 'No active loyalty program found for this business. Create one in the offers section.',
    }, { status: 404 });
  }

  const loyaltyConfig = parseLoyaltyConfig(targetOffer.terms_and_conditions);
  const requiredVisits = loyaltyConfig?.required_visits ?? 5;
  const rewardLabel = loyaltyConfig?.reward_label ?? 'Free item';

  // ── 6. Count existing stamps for this student × offer ──────────────────────
  const { count: existingStamps } = await admin
    .from('redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentProfile.id)
    .eq('offer_id', targetOffer.id)
    .in('status', ['stamp', 'reward_earned']);

  const stampsAfter = (existingStamps ?? 0) + 1;
  const rewardTriggered = stampsAfter % requiredVisits === 0;
  const newStatus = rewardTriggered ? 'reward_earned' : 'stamp';

  // ── 7. Insert the stamp row ────────────────────────────────────────────────
  const { error: insertError } = await admin
    .from('redemptions')
    .insert({
      student_id: studentProfile.id,
      vendor_id: vendorProfile.id,
      offer_id: targetOffer.id,
      status: newStatus,
      redemption_code: `STAMP-${Date.now()}`,
      claimed_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      device_type: 'vendor_scan',
    });

  if (insertError) {
    console.error('stamp insert error:', insertError);
    return NextResponse.json({ error: 'Failed to record stamp' }, { status: 500 });
  }

  // ── 8. Return result ───────────────────────────────────────────────────────
  // Current cycle progress (stamps within current reward cycle)
  const cyclePosition = stampsAfter % requiredVisits;
  const stampsInCycle = cyclePosition === 0 ? requiredVisits : cyclePosition;

  return NextResponse.json({
    success: true,
    student_name: studentName,
    offer_title: targetOffer.title,
    offer_id: targetOffer.id,
    loyalty_mode: loyaltyConfig?.mode ?? 'punch_card',
    stamps_total: stampsAfter,
    stamps_in_cycle: stampsInCycle,
    required_visits: requiredVisits,
    reward_triggered: rewardTriggered,
    reward_label: rewardLabel,
    vendor_name: vendorProfile.business_name,
    stamped_at: new Date().toISOString(),
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

  // Build query
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
