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
//   → Fire-and-forget: checks if this is the student's first-ever claim;
//     if so and they were referred, marks the referral completed and
//     grants 2 bonus stamps to both the referred student and the referrer.
//
// This endpoint is the most performance-critical in the app.
// It runs on Vercel Edge Runtime for <50ms cold starts globally.
// =============================================================================

import { safeLog } from '@/lib/utils/safe-logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { generateVoucherCode, computeVoucherExpiry, buildQrPayload } from '@/lib/utils/voucher';
import { generateStudentVoucherQr } from '@/lib/utils/qr-code';
import type { ClaimOfferRequest, ClaimOfferResponse } from '@/lib/types/database.types';
import { ClaimSchema, validationErrorResponse } from '@/lib/utils/validation';

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

    // ── 2. Fetch student profile early (needed for explicit rate-limit filter) ─
    // VULN-12 fix: the rate limit query must include an explicit student_id filter
    // as defense-in-depth — we cannot rely solely on RLS being correctly configured.
    const { data: studentProfile, error: profileError } = await supabase
      .from('student_profiles')
      .select('id, verification_status, institution_id, institution_name_manual, graduation_year')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || !studentProfile) {
      return NextResponse.json(
        { error: 'Student profile not found. Please complete your registration.' },
        { status: 404 }
      );
    }

    // ── 3. Rate limit: max 20 claims per student per hour ─────────────────
    // Uses the redemptions table directly — no additional infrastructure needed.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: claimsThisHour } = await supabase
      .from('redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentProfile.id) // explicit filter — defense-in-depth beyond RLS
      .eq('status', 'claimed')
      .gte('claimed_at', hourAgo);

    if ((claimsThisHour ?? 0) >= 20) {
      return NextResponse.json(
        { error: 'You\'ve claimed too many vouchers this hour. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': '0',
            'Retry-After': '3600',
          },
        }
      );
    }

    // ── 4. Parse + validate request body ────────────────────────────────────
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (_) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const parsed = ClaimSchema.safeParse(rawBody);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const { offer_id, device_type } = parsed.data;

    // ── 5. Guard: Student must be verified ───────────────────────────────
    // (studentProfile fetched and validated earlier, before the rate limit check)
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
      .maybeSingle();

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
      safeLog.error('[claim] Error counting existing redemptions:', countError);
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
        .maybeSingle();

      if (insertError) {
        if (insertError.code === '23505') {
          // Unique constraint violation — code collision. Retry.
          insertAttempt++;
          continue;
        }
        safeLog.error('[claim] Insert error:', insertError);
        return NextResponse.json({ error: 'Failed to generate voucher. Please try again.' }, { status: 500 });
      }

      redemptionCode = newRedemption.redemption_code;

      // ── 14. Fire-and-forget: Referral reward check ────────────────────
      // Trigger: first-ever voucher claim by a referred student.
      // Reward:  +2 referral_bonus stamps for both parties at this vendor.
      // This runs async and never blocks the response to the student.
      (async () => {
        try {
          const admin = createAdminClient();
          const vendorId = (offer.vendor as { id: string }).id;
          const now = new Date().toISOString();

          // Is this the student's very first voucher claim?
          // Count all voucher-type rows (claimed + confirmed) for this student.
          // We just inserted status='claimed', so count === 1 means first ever.
          const { count: totalClaims } = await admin
            .from('redemptions')
            .select('id', { count: 'exact', head: true })
            .eq('student_id', studentProfile.id)
            .in('status', ['claimed', 'confirmed']);

          if ((totalClaims ?? 0) !== 1) return; // Not the first claim — nothing to do.

          // Was this student referred by someone?
          const { data: sp } = await admin
            .from('student_profiles')
            .select('referred_by_id')
            .eq('id', studentProfile.id)
            .maybeSingle();

          if (!sp?.referred_by_id) return; // No referrer — nothing to do.

          // Find the pending referral row
          const { data: referral } = await admin
            .from('referrals')
            .select('id, referrer_id')
            .eq('referred_id', studentProfile.id)
            .eq('status', 'pending')
            .maybeSingle();

          if (!referral) return; // Already completed or row missing.

          // ── Mark referral as completed ────────────────────────────────
          await admin
            .from('referrals')
            .update({
              status:            'completed',
              reward_granted_at: now,
              reward_vendor_id:  vendorId,
              reward_offer_id:   offer_id,
            })
            .eq('id', referral.id);

          // ── Grant 2 bonus stamps to the referred student ──────────────
          await admin.from('redemptions').insert([
            {
              student_id:   studentProfile.id,
              vendor_id:    vendorId,
              offer_id:     offer_id,
              status:       'referral_bonus',
              confirmed_at: now,
            },
            {
              student_id:   studentProfile.id,
              vendor_id:    vendorId,
              offer_id:     offer_id,
              status:       'referral_bonus',
              confirmed_at: now,
            },
          ]);

          // ── Grant 2 bonus stamps to the referrer ─────────────────────
          await admin.from('redemptions').insert([
            {
              student_id:   referral.referrer_id,
              vendor_id:    vendorId,
              offer_id:     offer_id,
              status:       'referral_bonus',
              confirmed_at: now,
            },
            {
              student_id:   referral.referrer_id,
              vendor_id:    vendorId,
              offer_id:     offer_id,
              status:       'referral_bonus',
              confirmed_at: now,
            },
          ]);

          // ── In-app notifications for both parties ─────────────────────
          const { data: referrerSp } = await admin
            .from('student_profiles')
            .select('user_id')
            .eq('id', referral.referrer_id)
            .maybeSingle();

          const notifications: object[] = [
            {
              user_id: user.id,
              type:    'referral_reward',
              title:   'Bonus stamps earned! 🎉',
              body:    'You earned 2 bonus stamps for joining via a referral. Keep going — your next reward is closer!',
              is_read: false,
            },
          ];

          if (referrerSp?.user_id) {
            notifications.push({
              user_id: referrerSp.user_id,
              type:    'referral_reward',
              title:   'Referral reward unlocked! 🎉',
              body:    "Your friend just claimed their first deal — you've earned 2 bonus stamps. Thanks for spreading the word!",
              is_read: false,
            });
          }

          await admin.from('notifications').insert(notifications);

        } catch (err) {
          // Referral reward is non-critical — log but never surface to the student
          safeLog.error('[claim] Referral reward hook error:', err);
        }
      })();

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
    safeLog.error('[claim] Unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
