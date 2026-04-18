// =============================================================================
// app/api/redemptions/claim/route.ts
// POST /api/redemptions/claim
//
// THE CLAIM FLOW — called when a student taps "Get Voucher" on an offer.
//
// Guards (all checked before generating a code):
//   ✓ Student is authenticated
//   ✓ Student is verified (verification_status = 'verified')
//   ✓ Offer exists, is 'active', and not expired
//   ✓ Offer has not been depleted (max_total_redemptions check)
//   ✓ Student hasn't exceeded their personal use limit for this offer
//   ✓ Student doesn't already have a live (non-expired) code for this offer
//
// On success:
//   → Inserts a row into redemptions with status = 'claimed'
//   → Returns redemption code + QR code data URL to the frontend
//   → Triggers DB view_count increment (via a prior offer_view insert)
//
// This endpoint is the most performance-critical in the app.
// It runs on Vercel Edge Runtime for <50ms cold starts globally.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateVoucherCode, computeVoucherExpiry, buildQrPayload } from '@/lib/utils/voucher';
import { generateStudentVoucherQr } from '@/lib/utils/qr-code';
import type { ClaimOfferRequest, ClaimOfferResponse } from '@/lib/types/database.types';

// Retry up to 3 times on code collision before giving up
const MAX_CODE_GENERATION_RETRIES = 3;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── 1. Authenticate ───────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    // ── 2. Parse request body ─────────────────────────────────────────────
    let body: ClaimOfferRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { offer_id, device_type = 'mobile' } = body;
    if (!offer_id) {
      return NextResponse.json({ error: 'offer_id is required.' }, { status: 400 });
    }

    // ── 3. Fetch student profile ──────────────────────────────────────────
    const { data: studentProfile, error: profileError } = await supabase
      .from('student_profiles')
      .select('id, verification_status, institution_id, institution_name_manual, graduation_year')
      .eq('user_id', user.id)
      .single();

    if (profileError || !studentProfile) {
      return NextResponse.json(
        { error: 'Student profile not found. Please complete your registration.' },
        { status: 404 }
      );
    }

    // ── 4. Guard: Student must be verified ───────────────────────────────
    if (studentProfile.verification_status !== 'verified') {
      const statusMessages: Record<string, string> = {
        unverified: 'Verify your student status to claim this discount.',
        pending_email: 'Check your university email and click the verification link.',
        pending_review: 'Your student ID is under review. Check back in 24 hours.',
        rejected: 'Your verification was unsuccessful. Please re-upload your student ID.',
        expired: 'Your verification has expired. Please re-verify to continue.',
      };

      return NextResponse.json(
        {
          error: statusMessages[studentProfile.verification_status] ??
                 'Please verify your student status first.',
          verification_status: studentProfile.verification_status,
          redirect_to: '/verification',
        },
        { status: 403 }
      );
    }

    // ── 5. Fetch offer + vendor details ───────────────────────────────────
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select(`
        id, title, discount_label, terms_and_conditions, status, expires_at,
        starts_at, max_uses_per_student, max_total_redemptions,
        redemption_count, discount_type, discount_value, category,
        target_institution_ids,
        vendor:vendor_profiles (
          id, business_name, address_line1, city, is_verified
        )
      `)
      .eq('id', offer_id)
      .single();

    if (offerError || !offer) {
      return NextResponse.json({ error: 'Offer not found.' }, { status: 404 });
    }

    // ── 6. Guard: Offer must be active ────────────────────────────────────
    if (offer.status !== 'active') {
      const statusMessages: Record<string, string> = {
        draft:    'This offer is not yet available.',
        paused:   'This offer is temporarily unavailable.',
        expired:  'This offer has expired.',
        depleted: 'This offer has reached its maximum redemptions. Check back later!',
      };
      return NextResponse.json(
        { error: statusMessages[offer.status] ?? 'This offer is unavailable.' },
        { status: 409 }
      );
    }

    // ── 7. Guard: Offer not expired by date ───────────────────────────────
    if (offer.expires_at && new Date(offer.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This offer has expired.' }, { status: 409 });
    }

    // ── 8. Guard: Offer has not started yet ───────────────────────────────
    if (offer.starts_at && new Date(offer.starts_at) > new Date()) {
      return NextResponse.json(
        { error: 'This offer is not available yet. Check back soon!' },
        { status: 409 }
      );
    }

    // ── 9. Guard: Offer not depleted ─────────────────────────────────────
    if (
      offer.max_total_redemptions !== null &&
      offer.redemption_count >= offer.max_total_redemptions
    ) {
      return NextResponse.json(
        { error: 'This offer has been fully claimed. Stay tuned for more!' },
        { status: 409 }
      );
    }

    // ── 10. Guard: Institution targeting ─────────────────────────────────
    // If the offer targets specific institutions, check the student qualifies
    if (
      offer.target_institution_ids &&
      offer.target_institution_ids.length > 0 &&
      studentProfile.institution_id &&
      !offer.target_institution_ids.includes(studentProfile.institution_id)
    ) {
      return NextResponse.json(
        { error: 'This offer is exclusive to students from specific universities.' },
        { status: 403 }
      );
    }

    // ── 11. Guard: Student personal use limit ────────────────────────────
    // Count how many CONFIRMED + CLAIMED (non-expired) redemptions this student
    // already has for this specific offer.
    const { count: existingCount, error: countError } = await supabase
      .from('redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('offer_id', offer_id)
      .eq('student_id', studentProfile.id)
      .in('status', ['claimed', 'confirmed']);   // 'expired' and 'cancelled' don't count

    if (countError) {
      console.error('[claim] Error counting existing redemptions:', countError);
      return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
    }

    if ((existingCount ?? 0) >= offer.max_uses_per_student) {
      return NextResponse.json(
        {
          error:
            offer.max_uses_per_student === 1
              ? "You've already claimed this offer."
              : `You've already used this offer ${offer.max_uses_per_student} times.`,
          already_claimed: true,
        },
        { status: 409 }
      );
    }

    // ── 12. Guard: No active live code for this offer ─────────────────────
    // Prevent spamming the "Get Voucher" button from creating multiple codes
    const { data: liveCode } = await supabase
      .from('redemptions')
      .select('id, redemption_code, expires_at, qr_code_payload')
      .eq('offer_id', offer_id)
      .eq('student_id', studentProfile.id)
      .eq('status', 'claimed')
      .gt('expires_at', new Date().toISOString())   // Still valid
      .maybeSingle();

    if (liveCode) {
      // Student already has a live code — return it instead of creating a new one
      const existingQr = await generateStudentVoucherQr(liveCode.qr_code_payload ?? liveCode.redemption_code);
      return NextResponse.json<ClaimOfferResponse>({
        success: true,
        redemption_id: liveCode.id,
        redemption_code: liveCode.redemption_code,
        qr_code_data_url: existingQr,
        expires_at: liveCode.expires_at,
        offer: {
          id: offer.id,
          title: offer.title,
          discount_label: offer.discount_label,
          terms_and_conditions: offer.terms_and_conditions,
        },
        vendor: {
          business_name: (offer.vendor as { business_name: string }).business_name,
          address_line1: (offer.vendor as { address_line1: string | null }).address_line1,
          city: (offer.vendor as { city: string }).city,
        },
      });
    }

    // ── 13. Generate unique code (with retry on collision) ────────────────
    let redemptionCode: string | null = null;
    let insertAttempt = 0;

    while (insertAttempt < MAX_CODE_GENERATION_RETRIES) {
      const candidateCode = generateVoucherCode();
      const expiresAt = computeVoucherExpiry(new Date(), 24);
      const qrPayload = buildQrPayload(candidateCode);
      const qrDataUrl = await generateStudentVoucherQr(qrPayload);

      // Compute discount value for the savings tracker
      let discountValueApplied: number | null = null;
      if (offer.discount_type === 'percentage' && offer.discount_value) {
        // We don't know the final bill here — record the percentage as a decimal
        // e.g., 20% → store 20. The vendor dashboard shows "20% discount applied".
        discountValueApplied = offer.discount_value;
      } else if (offer.discount_type === 'fixed_amount' && offer.discount_value) {
        discountValueApplied = offer.discount_value;
      }

      const { data: newRedemption, error: insertError } = await supabase
        .from('redemptions')
        .insert({
          offer_id: offer_id,
          student_id: studentProfile.id,
          vendor_id: (offer.vendor as { id: string }).id,
          redemption_code: candidateCode,
          qr_code_payload: qrPayload,
          status: 'claimed',
          expires_at: expiresAt.toISOString(),
          discount_value_applied: discountValueApplied,
          student_institution_id: studentProfile.institution_id,
          student_graduation_year: studentProfile.graduation_year,
          device_type: device_type,
          redemption_source: 'web_app',
          offer_category: offer.category,
        })
        .select('id, redemption_code, expires_at')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          // Unique constraint violation — code collision. Retry.
          insertAttempt++;
          continue;
        }
        console.error('[claim] Insert error:', insertError);
        return NextResponse.json({ error: 'Failed to generate voucher. Please try again.' }, { status: 500 });
      }

      redemptionCode = newRedemption.redemption_code;

      return NextResponse.json<ClaimOfferResponse>({
        success: true,
        redemption_id: newRedemption.id,
        redemption_code: redemptionCode,
        qr_code_data_url: qrDataUrl,
        expires_at: newRedemption.expires_at,
        offer: {
          id: offer.id,
          title: offer.title,
          discount_label: offer.discount_label,
          terms_and_conditions: offer.terms_and_conditions,
        },
        vendor: {
          business_name: (offer.vendor as { business_name: string }).business_name,
          address_line1: (offer.vendor as { address_line1: string | null }).address_line1,
          city: (offer.vendor as { city: string }).city,
        },
      });
    }

    // All retries exhausted (extremely unlikely)
    return NextResponse.json(
      { error: 'Code generation failed after retries. Please try again.' },
      { status: 500 }
    );

  } catch (err) {
    console.error('[claim] Unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
