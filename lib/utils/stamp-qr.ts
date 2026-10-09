// =============================================================================
// lib/utils/stamp-qr.ts
//
// HMAC-SHA256 based time-limited QR payload for the vendor-scans-student
// loyalty stamp flow.
//
// QR format:
//   STUDEALS_STAMP:v1:{studentProfileId}:{expiresUnix}:{hmac12}
//
// - studentProfileId: UUID from student_profiles.id
// - expiresUnix: Unix timestamp (seconds) when this code expires
// - hmac12: first 12 hex chars of HMAC-SHA256(SECRET, studentProfileId + ":" + expiresUnix)
//
// Why HMAC?
//   A plain vendor ID in a QR (old flow) can be screenshot-shared so friends
//   can stamp themselves without visiting. The HMAC binds the QR to a specific
//   student + expiry time — a code that expires in 90 seconds cannot be shared
//   in advance or replayed.
//
// Server-only: uses Node's `crypto` module. Do NOT import in client components.
// =============================================================================

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * STAMP_QR_SECRET is required in production. The dev fallback only exists so
 * local development works without extra env setup.
 */
function stampSecret(): string {
  const secret = process.env.STAMP_QR_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('STAMP_QR_SECRET must be set in production');
  }
  return 'studeals-dev-stamp-secret';
}

/** Validity window in seconds. Student QR refreshes every 60s; this gives 30s slack. */
export const STAMP_QR_TTL_SECONDS = 90;

// ---------------------------------------------------------------------------
// generateStampPayload
// ---------------------------------------------------------------------------

/**
 * Generate a time-limited signed QR payload for a student.
 *
 * @param studentProfileId  UUID from student_profiles.id
 * @returns { payload: string, expiresAt: number (unix seconds) }
 */
export function generateStampPayload(studentProfileId: string): {
  payload: string;
  expiresAt: number;
} {
  const expiresAt = Math.floor(Date.now() / 1000) + STAMP_QR_TTL_SECONDS;
  const message = `${studentProfileId}:${expiresAt}`;
  const hmac12 = createHmac('sha256', stampSecret())
    .update(message)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();

  const payload = `STUDEALS_STAMP:v1:${studentProfileId}:${expiresAt}:${hmac12}`;
  return { payload, expiresAt };
}

// ---------------------------------------------------------------------------
// validateStampPayload
// ---------------------------------------------------------------------------

export type StampValidationResult =
  | { valid: true; studentProfileId: string }
  | { valid: false; error: string; error_code: string };

/**
 * Validate a scanned QR payload.
 * Checks: format, expiry, HMAC signature.
 *
 * @param raw  The raw string decoded from the QR code.
 */
export function validateStampPayload(raw: string): StampValidationResult {
  // ── 1. Basic format check ─────────────────────────────────────────────────
  // STUDEALS_STAMP:v1:{uuid-no-colons}:{unix}:{hmac12}
  // A UUID is 32 hex + 4 hyphens = 36 chars, no colons.
  // So split(':') yields exactly 5 parts.
  const parts = raw.trim().split(':');

  if (
    parts.length !== 5 ||
    parts[0] !== 'STUDEALS_STAMP' ||
    parts[1] !== 'v1'
  ) {
    return {
      valid: false,
      error: 'Not a StudDeals loyalty QR. Make sure the student opens their Loyalty page.',
      error_code: 'INVALID_FORMAT',
    };
  }

  const [, , studentProfileId, expiresStr, providedHmac] = parts;

  // ── 2. Expiry check ───────────────────────────────────────────────────────
  const expiresAt = parseInt(expiresStr, 10);
  if (isNaN(expiresAt)) {
    return {
      valid: false,
      error: 'Malformed QR code.',
      error_code: 'INVALID_FORMAT',
    };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds > expiresAt) {
    return {
      valid: false,
      error: 'QR code expired. Ask the student to refresh their Loyalty page.',
      error_code: 'QR_EXPIRED',
    };
  }

  // ── 3. HMAC verification (constant-time) ──────────────────────────────────
  const message = `${studentProfileId}:${expiresAt}`;
  const expectedHmac = createHmac('sha256', stampSecret())
    .update(message)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();

  // Constant-time comparison to resist timing attacks
  let signaturesMatch = false;
  try {
    signaturesMatch = timingSafeEqual(
      Buffer.from(providedHmac.toUpperCase()),
      Buffer.from(expectedHmac),
    );
  } catch {
    // Buffers of different length → not equal
    signaturesMatch = false;
  }

  if (!signaturesMatch) {
    return {
      valid: false,
      error: 'Invalid QR signature. This code did not come from StudDeals.',
      error_code: 'INVALID_SIGNATURE',
    };
  }

  return { valid: true, studentProfileId };
}

// ---------------------------------------------------------------------------
// Vendor QR (student-scans-vendor flow)
//
// The vendor's on-screen QR links to /stamp/{vendorId}?t={token}, where
//   token = {window}.{hmac16}
//   window = floor(unix ms / 5 min)
//   hmac16 = first 16 hex chars of HMAC-SHA256(SECRET, "vendor-qr:{vendorId}:{window}")
// Tokens are minted server-side (/api/vendor/stamp-qr) so they can't be
// predicted from the clock, and are accepted for the current window ±1.
// ---------------------------------------------------------------------------

export const VENDOR_QR_WINDOW_MS = 5 * 60 * 1000;

function vendorQrSig(vendorId: string, window: number): string {
  return createHmac('sha256', stampSecret())
    .update(`vendor-qr:${vendorId.toLowerCase()}:${window}`)
    .digest('hex')
    .slice(0, 16);
}

export function generateVendorQrToken(vendorId: string): { token: string; refreshInMs: number } {
  const now = Date.now();
  const window = Math.floor(now / VENDOR_QR_WINDOW_MS);
  return {
    token: `${window}.${vendorQrSig(vendorId, window)}`,
    refreshInMs: VENDOR_QR_WINDOW_MS - (now % VENDOR_QR_WINDOW_MS),
  };
}

export function validateVendorQrToken(vendorId: string, token: string): boolean {
  const [windowStr, sig] = String(token).split('.');
  const window = Number(windowStr);
  if (!Number.isInteger(window) || !sig) return false;
  const current = Math.floor(Date.now() / VENDOR_QR_WINDOW_MS);
  if (Math.abs(current - window) > 1) return false;
  const expected = Buffer.from(vendorQrSig(vendorId, window));
  const provided = Buffer.from(sig.toLowerCase());
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
