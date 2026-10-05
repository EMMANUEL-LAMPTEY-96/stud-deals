// =============================================================================
// POST /api/verification/verify-otp
//
// Validates the 6-digit OTP the student typed.
// Checks:
//   1. A code was issued and hasn't expired (15 min window)
//   2. Fewer than OTP_MAX_VERIFY_ATTEMPTS wrong guesses so far
//   3. HMAC of the input matches the stored hash
// On success:
//   - Sets verification_status = 'verified', verification_method = 'edu_email'
//   - Sets student_email, institution, verified_at
//   - Clears verification_notes
// =============================================================================

import { safeLog } from '@/lib/utils/safe-logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { OTP_MAX_VERIFY_ATTEMPTS, otpMatches, parseStoredOtp } from '@/lib/utils/otp';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { otp_code: string };
  try { body = await request.json(); } catch (_) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const inputCode = body.otp_code?.trim();
  if (!inputCode || !/^\d{6}$/.test(inputCode)) {
    return NextResponse.json({ error: 'Please enter the 6-digit code.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── Fetch student profile with stored OTP ──────────────────────────────
  const { data: sp } = await admin
    .from('student_profiles')
    .select('id, verification_status, verification_notes')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sp) return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 });
  if (sp.verification_status === 'verified') {
    return NextResponse.json({ error: 'Already verified.' }, { status: 400 });
  }

  const stored = parseStoredOtp(sp.verification_notes);
  if (!stored) {
    return NextResponse.json({ error: 'No verification in progress. Please request a new code.' }, { status: 400 });
  }

  // ── Check expiry + attempts ───────────────────────────────────────────
  if (new Date() > new Date(stored.otp_expires_at)) {
    return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 });
  }
  if (stored.otp_attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 429 });
  }

  // ── Check code ────────────────────────────────────────────────────────
  if (!otpMatches(user.id, stored.otp_email, inputCode, stored.otp_hash)) {
    // Optimistic lock on the previous notes value so parallel guesses can't
    // share one attempt slot.
    const { data: bumped } = await admin
      .from('student_profiles')
      .update({ verification_notes: JSON.stringify({ ...stored, otp_attempts: stored.otp_attempts + 1 }) })
      .eq('id', sp.id)
      .eq('verification_notes', sp.verification_notes)
      .select('id');

    if (!bumped?.length) {
      return NextResponse.json({ error: 'Please try again.' }, { status: 409 });
    }
    const left = OTP_MAX_VERIFY_ATTEMPTS - stored.otp_attempts - 1;
    return NextResponse.json(
      { error: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many incorrect attempts. Please request a new code.' },
      { status: 400 }
    );
  }

  // ── Mark as verified ──────────────────────────────────────────────────
  const { data: updated, error: updateError } = await admin
    .from('student_profiles')
    .update({
      verification_status: 'verified',
      verification_method: 'edu_email',
      verified_at: new Date().toISOString(),
      verification_notes: null,
      student_email: stored.otp_email,
      institution_id: stored.institution_id,
      institution_name_manual: null,
    })
    .eq('id', sp.id)
    .eq('verification_notes', sp.verification_notes)
    .select('id');

  if (updateError) {
    safeLog.error('verify-otp update error:', updateError);
    return NextResponse.json({ error: 'Failed to update verification status.' }, { status: 500 });
  }
  if (!updated?.length) {
    return NextResponse.json({ error: 'Verification session changed. Please request a new code.' }, { status: 409 });
  }

  return NextResponse.json({
    success: true,
    message: 'Verification successful! You now have full access.',
    institution_name: stored.institution_name,
  });
}
