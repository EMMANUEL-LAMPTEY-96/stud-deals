// =============================================================================
// lib/utils/otp.ts
//
// Server-only helpers for the university-email OTP flow.
//
// The OTP is never stored in plain text. We store an HMAC of
// (user id, email, code) keyed with a server secret, so a student who reads
// their own student_profiles row (RLS allows that) cannot recover or
// brute-force the code offline.
// =============================================================================

import { createHmac, randomInt, timingSafeEqual } from 'crypto';

export const OTP_EXPIRY_MINUTES = 15;
export const OTP_MAX_VERIFY_ATTEMPTS = 5;
export const OTP_MAX_SENDS_PER_WINDOW = 5;
export const OTP_SEND_WINDOW_MINUTES = 60;

/** Shape of the JSON stored in student_profiles.verification_notes during an OTP flow. */
export interface StoredOtp {
  otp_email: string;
  otp_hash: string;
  otp_expires_at: string;
  otp_attempts: number;
  otp_send_count: number;
  otp_window_started_at: string;
  institution_id: string | null;
  institution_name: string | null;
}

function otpSecret(): string {
  const secret = process.env.OTP_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('OTP_HMAC_SECRET (or SUPABASE_SERVICE_ROLE_KEY) must be set');
  return secret;
}

export function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

export function hashOtp(userId: string, email: string, code: string): string {
  return createHmac('sha256', otpSecret()).update(`${userId}:${email}:${code}`).digest('hex');
}

export function otpMatches(userId: string, email: string, code: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(userId, email, code), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseStoredOtp(notes: string | null | undefined): StoredOtp | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed.otp_hash === 'string' ? (parsed as StoredOtp) : null;
  } catch {
    return null;
  }
}
