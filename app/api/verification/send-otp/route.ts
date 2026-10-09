// =============================================================================
// POST /api/verification/send-otp
//
// Emails a 6-digit OTP to the student's university email.
//
// Steps:
//   1. Auth check — must be a logged-in student
//   2. The email domain must belong to an active Hungarian institution
//      (anything else goes through document upload instead)
//   3. Rate limit: OTP_MAX_SENDS_PER_WINDOW codes per OTP_SEND_WINDOW_MINUTES
//   4. Store an HMAC of the code (never the code itself) in
//      student_profiles.verification_notes, with expiry + attempt counter
//   5. Email the code via Resend
// =============================================================================

import { safeLog } from '@/lib/utils/safe-logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/resend';
import { verificationOtpEmail } from '@/lib/email/templates';
import { findInstitutionForEmail } from '@/lib/utils/institution-domain';
import {
  OTP_EXPIRY_MINUTES,
  OTP_MAX_SENDS_PER_WINDOW,
  OTP_SEND_WINDOW_MINUTES,
  generateOtp,
  hashOtp,
  parseStoredOtp,
  type StoredOtp,
} from '@/lib/utils/otp';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { university_email: string };
  try { body = await request.json(); } catch (_) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const uniEmail = body.university_email?.trim().toLowerCase();
  if (!uniEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(uniEmail)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── Get student profile ───────────────────────────────────────────────────
  const { data: sp } = await admin
    .from('student_profiles')
    .select('id, verification_status, verification_notes')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sp) return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 });
  if (sp.verification_status === 'verified') {
    return NextResponse.json({ error: 'Your account is already verified.' }, { status: 400 });
  }

  // ── Domain must belong to a known Hungarian institution ──────────────────
  const matched = await findInstitutionForEmail(admin, uniEmail);

  if (!matched) {
    return NextResponse.json(
      { error: "We don't recognise this university email domain. Please verify by uploading your student ID instead." },
      { status: 400 }
    );
  }

  // ── Rate limit sends ──────────────────────────────────────────────────────
  const previous = parseStoredOtp(sp.verification_notes);
  const now = Date.now();
  const windowMs = OTP_SEND_WINDOW_MINUTES * 60 * 1000;
  const windowActive = previous && now - new Date(previous.otp_window_started_at).getTime() < windowMs;
  const sendCount = windowActive ? previous!.otp_send_count : 0;

  if (sendCount >= OTP_MAX_SENDS_PER_WINDOW) {
    return NextResponse.json(
      { error: 'Too many codes requested. Please wait an hour and try again.' },
      { status: 429 }
    );
  }

  // ── Generate + store hashed OTP ──────────────────────────────────────────
  const otp = generateOtp();
  const stored: StoredOtp = {
    otp_email: uniEmail,
    otp_hash: hashOtp(user.id, uniEmail, otp),
    otp_expires_at: new Date(now + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString(),
    otp_attempts: 0,
    otp_send_count: sendCount + 1,
    otp_window_started_at: windowActive ? previous!.otp_window_started_at : new Date(now).toISOString(),
    institution_id: matched.id,
    institution_name: matched.name,
  };

  const { error: updateError } = await admin
    .from('student_profiles')
    .update({
      verification_status: 'pending_email',
      verification_method: 'edu_email',
      verification_notes: JSON.stringify(stored),
    })
    .eq('id', sp.id);

  if (updateError) {
    safeLog.error('send-otp update error:', updateError);
    return NextResponse.json({ error: 'Failed to start verification.' }, { status: 500 });
  }

  // ── Email the code ────────────────────────────────────────────────────────
  const { subject, html } = verificationOtpEmail(otp, OTP_EXPIRY_MINUTES);
  const emailSent = await sendEmail({ to: uniEmail, subject, html });

  if (!emailSent && process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: "We couldn't send the code right now. Please try again in a few minutes." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    email_sent: emailSent,
    university_matched: true,
    institution_name: matched.name,
    // Local dev without RESEND_API_KEY: return the code so the flow is testable.
    ...(process.env.NODE_ENV === 'development' && !emailSent ? { dev_otp: otp } : {}),
  });
}
