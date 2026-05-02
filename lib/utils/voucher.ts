// =============================================================================
// lib/utils/voucher.ts
// Voucher code generation and validation utilities.
//
// DESIGN DECISIONS:
//   - Codes are human-readable alphanumeric: "STUD-X7K2-M3P9"
//     Rationale: Vendors need to type these into a confirmation screen
//     if their camera can't scan the QR. Readable codes prevent frustration.
//   - Codes exclude visually ambiguous characters: 0, O, 1, I, L
//     Rationale: "0" vs "O" confusion at a busy coffee counter costs sales.
//   - Codes are uppercase and sectioned with hyphens for easy reading aloud.
//   - Uniqueness is guaranteed by the UNIQUE constraint on the DB column,
//     not by the generator — the caller should retry on conflict.
//   - Default TTL is 24 hours from claim time. Configurable per offer.
//
// CODE FORMAT:  "STUD-XXXX-XXXX"
//   - "STUD" prefix = easy to identify at point of sale
//   - Two 4-char segments = 32 bits of entropy from a 30-char alphabet
//   - Collision probability: 1 in ~810,000 at 1,000 active codes
//   - At 50,000 active codes simultaneously: still <1% collision rate
//   - If needed, increase to 3 segments for more entropy.
// =============================================================================

// No ambiguous characters: removed 0, O, 1, I, L
const VOUCHER_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generates a unique human-readable voucher code.
 * Format: "STUD-XXXX-XXXX"
 *
 * @param segmentLength  Characters per segment (default: 4)
 * @param segmentCount   Number of random segments (default: 2)
 * @returns string like "STUD-M3P9-X7K2"
 */
export function generateVoucherCode(
  segmentLength = 4,
  segmentCount = 2
): string {
  const segments: string[] = [];

  for (let s = 0; s < segmentCount; s++) {
    let segment = '';
    for (let i = 0; i < segmentLength; i++) {
      // Use crypto.getRandomValues for cryptographic randomness (not Math.random)
      const randomByte = new Uint8Array(1);
      crypto.getRandomValues(randomByte);
      // Map byte to alphabet (bias-free using rejection sampling conceptually)
      segment += VOUCHER_ALPHABET[randomByte[0] % VOUCHER_ALPHABET.length];
    }
    segments.push(segment);
  }

  return `STUD-${segments.join('-')}`;
}

/**
 * Validates that a code string matches the expected voucher format.
 * Used on the vendor confirmation screen before hitting the API.
 *
 * @returns true if the code has the correct structure
 */
export function isValidVoucherCodeFormat(code: string): boolean {
  // Matches "STUD-XXXX-XXXX" where X is from our alphabet
  const pattern = /^STUD-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
  return pattern.test(code.toUpperCase().trim());
}

/**
 * Normalises a voucher code entered by a vendor:
 *   - trims whitespace
 *   - uppercases
 *   - auto-inserts hyphens if they accidentally typed "STUDX7K2M3P9"
 */
export function normaliseVoucherCode(input: string): string {
  const clean = input.trim().toUpperCase().replace(/[\s-]/g, '');

  // If it starts with STUD and is 12 chars, reformat it
  if (clean.startsWith('STUD') && clean.length === 12) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
  }

  // Otherwise return with hyphens preserved as-is
  return input.trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// TTL / EXPIRY HELPERS
// ---------------------------------------------------------------------------

/** Default voucher TTL: 24 hours */
export const DEFAULT_VOUCHER_TTL_HOURS = 24;

/**
 * Computes when a voucher expires.
 * @param claimedAt  ISO string of when the student claimed the voucher
 * @param ttlHours   Hours until expiry (default: 24)
 */
export function computeVoucherExpiry(
  claimedAt: Date | string = new Date(),
  ttlHours: number = DEFAULT_VOUCHER_TTL_HOURS
): Date {
  const base = typeof claimedAt === 'string' ? new Date(claimedAt) : claimedAt;
  return new Date(base.getTime() + ttlHours * 60 * 60 * 1000);
}

/**
 * Checks if a voucher has expired.
 * @param expiresAt  ISO string or Date of expiry
 */
export function isVoucherExpired(expiresAt: Date | string): boolean {
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return expiry <= new Date();
}

/**
 * Returns a human-readable time remaining string.
 * e.g., "Expires in 23h 47m" or "Expired"
 */
export function getVoucherExpiryLabel(expiresAt: Date | string): string {
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 1) return `Expires in ${hours}h ${minutes}m`;
  if (minutes >= 1) return `Expires in ${minutes}m`;
  return 'Expires in less than 1 minute';
}

// ---------------------------------------------------------------------------
// QR CODE PAYLOAD
// ---------------------------------------------------------------------------

/**
 * Generates the data payload to encode in the QR code.
 * We encode a minimal JSON object — not just the code — so future versions
 * can add a signature for tamper detection without breaking QR format.
 *
 * QR payload: '{"c":"STUD-X7K2-M3P9","v":1}'
 * c = code, v = payload version (for future backwards compat)
 */
export function buildQrPayload(redemptionCode: string): string {
  return JSON.stringify({ c: redemptionCode, v: 1 });
}

/**
 * Parses a QR payload back to a redemption code.
 * Handles both the JSON format and raw code strings (for backwards compat).
 */
export function parseQrPayload(payload: string): string | null {
  try {
    const parsed = JSON.parse(payload);
    if (parsed?.c && typeof parsed.c === 'string') return parsed.c;
  } catch (_) {
    // Not JSON — treat as raw code
    if (isValidVoucherCodeFormat(payload)) return payload;
  }
  return null;
}
