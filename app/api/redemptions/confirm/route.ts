// =============================================================================
// app/api/redemptions/confirm/route.ts
// POST /api/redemptions/confirm
//
// THE CONFIRMATION FLOW — called when a vendor scans/enters a student's code.
//
// This is the most trust-sensitive endpoint in the entire app.
// A "confirmed" redemption = a real student visited a real business.
// It is the core data event that makes your Looker Studio ROI dashboards work.
//
// Guards:
//   ✓ Vendor is authenticated
//   ✓ Caller has role = 'vendor' with a verified vendor profile
//   ✓ Redemption code exists and has status = 'claimed' (not expired/used)
//   ✓ The redemption belongs to THIS vendor's offer (anti-fraud)
//   ✓ Code has not expired (expires_at > NOW())
//
// On success:
//   → Updates redemption status to 'confirmed', sets confirmed_at = NOW()
//   → The DB trigger handle_redemption_confirmed() fires automatically:
//       • offer.redemption_count++
//       • vendor_profile.total_lifetime_redemptions++
//       • student_profile.total_redemptions++ and total_savings_usd updates
//   → Returns student display name + offer title for the vendor confirmation screen
//
// Security note: We NEVER return the student's full name or email to the vendor.
// Only a first name + last initial (e.g., "Emmanuel A.") for personal service.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidVoucherCodeFormat, normaliseVoucherCode, parseQrPayload } from '@/lib/utils/voucher';
import type { ConfirmRedemptionRequest, ConfirmRedemptionResponse } from '@/lib/types/database.types';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── 1. Authenticate vendor ────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // ── 2. Verify caller is a vendor with a verified profile ──────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'vendor') {
      return NextResponse.json({ error: 'Only vendor accounts can confirm redemptions.' }, { status: 403 });
    }

    const { data: vendorProfile } = await supabase
      .from('vendor_profiles')
      .select('id, business_name, is_verified')
      .eq('user_id', user.id)
      .single();

    if (!vendorProfile) {
      return NextResponse.json({ error: 'Vendor profile not found.' }, { status: 404 });
    }

    if (!vendorProfile.is_verified) {
      return NextResponse.json(
        { error: 'Your business account is pending verification. Contact support.' },
        { status: 403 }
      );
    }

    // ── 3. Parse and normalise the code ───────────────────────────────────
    let body: ConfirmRedemptionRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    if (!body.redemption_code) {
      return NextResponse.json({ error: 'redemption_code is required.' }, { status: 400 });
    }

    // Handle both raw codes and QR JSON payloads
    let code = body.redemption_code;
    if (code.startsWith('{')) {
      // Might be a QR JSON payload — parse it
      const parsed = parseQrPayload(code);
      if (!parsed) {
        return NextResponse.json({ error: 'Invalid QR code format.' }, { status: 400 });
      }
      code = parsed;
    }

    const normalisedCode = normaliseVoucherCode(code);

    if (!isValidVoucherCodeFormat(normalisedCode)) {
      return NextResponse.json(
        { error: 'Invalid voucher code format. Codes look like: STUD-XXXX-XXXX' },
        { status: 400 }
      );
    }

    // ── 4. Fetch the redemption ───────────────────────────────────────────
    const { data: redemption, error: fetchError } = await supabase
      .from('redemptions')
      .select(`
        id, status, expires_at, vendor_id, offer_id, student_id,
        offer:offers (id, title, discount_label),
        student:student_profiles (
          id,
          user:profiles (first_name, last_name)
        )
      `)
      .eq('redemption_code', normalisedCode)
      .maybeSingle();

    if (fetchError) {
      console.error('[confirm] DB error fetching redemption:', fetchError);
      return NextResponse.json({ error: 'Server error looking up code.' }, { status: 500 });
    }

    if (!redemption) {
      return NextResponse.json(
        { error: 'Code not found. Please check the code and try again.' },
        { status: 404 }
      );
    }

    // ── 5. Guard: Code belongs to THIS vendor ────────────────────────────
    // Critical anti-fraud check — prevents Vendor A from confirming Vendor B's codes
    if (redemption.vendor_id !== vendorProfile.id) {
      return NextResponse.json(
        { error: 'This code was not issued for your business.' },
        { status: 403 }
      );
    }

    // ── 6. Guard: Code is in 'claimed' state ─────────────────────────────
    if (redemption.status !== 'claimed') {
      const stateMessages: Record<string, string> = {
        confirmed: 'This code has already been used. Each code is single-use only.',
        expired:   'This code has expired. Ask the student to generate a new one.',
        cancelled: 'This code was cancelled.',
      };
      return NextResponse.json(
        {
          error: stateMessages[redemption.status] ?? `Code status: ${redemption.status}`,
          status: redemption.status,
        },
        { status: 409 }
      );
    }

    // ── 7. Guard: Code has not expired ───────────────────────────────────
    if (new Date(redemption.expires_at) < new Date()) {
      // Proactively update to expired in DB (cron job handles bulk expiry, this handles edge case)
      await supabase
        .from('redemptions')
        .update({ status: 'expired' })
        .eq('id', redemption.id);

      return NextResponse.json(
        { error: 'This code has expired. Codes are valid for 24 hours after the student claims them.' },
        { status: 409 }
      );
    }

    // ── 8. CONFIRM THE REDEMPTION ─────────────────────────────────────────
    // This is the CONVERSION EVENT. The DB trigger fires here.
    const confirmedAt = new Date().toISOString();

    const { error: confirmError } = await supabase
      .from('redemptions')
      .update({
        status: 'confirmed',
        confirmed_at: confirmedAt,
        confirmed_by_vendor_user_id: user.id,
      })
      .eq('id', redemption.id)
      .eq('status', 'claimed');    // Optimistic lock — prevents double-confirm race condition

    if (confirmError) {
      console.error('[confirm] Update error:', confirmError);
      return NextResponse.json({ error: 'Failed to confirm redemption. Please try again.' }, { status: 500 });
    }

    // ── 9. Build privacy-safe student display name ────────────────────────
    // We show "Emmanuel A." — enough for personal service, not full PII
    const studentUser = (redemption.student as { user: { first_name: string | null; last_name: string | null } | null } | null)?.user;
    const firstName = studentUser?.first_name ?? 'Student';
    const lastInitial = studentUser?.last_name ? `${studentUser.last_name[0].toUpperCase()}.` : '';
    const displayName = `${firstName} ${lastInitial}`.trim();

    const offerData = redemption.offer as { id: string; title: string; discount_label: string } | null;

    // ── 10. Return success to vendor screen ───────────────────────────────
    return NextResponse.json<ConfirmRedemptionResponse>({
      success: true,
      redemption_id: redemption.id,
      student_display_name: displayName,
      offer_title: offerData?.title ?? 'Discount',
      discount_label: offerData?.discount_label ?? '',
      confirmed_at: confirmedAt,
      message: `✓ Voucher accepted! Apply the ${offerData?.discount_label ?? 'discount'} for ${displayName}.`,
    });

  } catch (err) {
    console.error('[confirm] Unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
