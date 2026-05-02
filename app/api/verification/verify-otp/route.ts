// =============================================================================
// POST /api/verification/verify-otp
//
// Validates the 6-digit OTP the student typed.
// Checks:
//   1. OTP matches what's stored in verification_notes
//   2. OTP hasn't expired (15 min window)
// On success:
//   - Sets verification_status = 'verified'
//   - Sets verification_method = 'edu_email'
//   - Sets verified_at = now()
//   - Clears verification_notes (removes the raw OTP from DB)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

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

  // ── Parse stored OTP data ─────────────────────────────────────────────
  let stored: {
    otp_code: string;
    otp_expires_at: string;
    otp_email: string;
    institution_id: string | null;
    institution_name: string | null;
  } | null = null;

  try {
    if (sp.verification_notes) stored = JSON.parse(sp.verification_notes);
  } catch (_) {
    return NextResponse.json({ error: 'Verification session expired. Please start again.' }, { status: 400 });
  }

  if (!stored?.otp_code) {
    return NextResponse.json({ error: 'No verification in progress. Please request a new code.' }, { status: 400 });
  }

  // ── Check expiry ──────────────────────────────────────────────────────
  if (new Date() > new Date(stored.otp_expires_at)) {
    return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 });
  }

  // ── Check code ────────────────────────────────────────────────────────
  if (inputCode !== stored.otp_code) {
    return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 });
  }

  // ── Mark as verified ──────────────────────────────────────────────────
  const { error: updateError } = await admin
    .from('student_profiles')
    .update({
      verification_status: 'verified',
      verification_method: 'edu_email',
      verified_at: new Date().toISOString(),
      verification_notes: null,   // clear the raw OTP
      institution_id: stored.institution_id,
      institution_name_manual: stored.institution_name,
    })
    .eq('id', sp.id);

  if (updateError) {
    console.error('verify-otp update error:', updateError);
    return NextResponse.json({ error: 'Failed to update verification status.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Verification successful! You now have full access.',
    institution_name: stored.institution_name,
  });
}
