import { generateVendorQrToken, validateVendorQrToken, VENDOR_QR_WINDOW_MS } from '@/lib/utils/stamp-qr';
import { generateOtp, hashOtp, otpMatches } from '@/lib/utils/otp';
import { hashStaffPin, staffPinMatches, signStaffCookie } from '@/lib/utils/staff-session';

const VENDOR = '0b0e6f1a-1111-2222-3333-444455556666';

beforeAll(() => {
  process.env.STAMP_QR_SECRET = 'test-stamp-secret';
  process.env.OTP_HMAC_SECRET = 'test-otp-secret';
  process.env.STAFF_SESSION_SECRET = 'test-staff-secret';
});

describe('vendor QR token', () => {
  it('accepts a freshly minted token', () => {
    const { token } = generateVendorQrToken(VENDOR);
    expect(validateVendorQrToken(VENDOR, token)).toBe(true);
  });

  it('rejects the old predictable nonce (bare window number)', () => {
    const window = Math.floor(Date.now() / VENDOR_QR_WINDOW_MS);
    expect(validateVendorQrToken(VENDOR, String(window))).toBe(false);
  });

  it('rejects a token for another vendor', () => {
    const { token } = generateVendorQrToken(VENDOR);
    expect(validateVendorQrToken('99999999-1111-2222-3333-444455556666', token)).toBe(false);
  });

  it('rejects a tampered or expired token', () => {
    const { token } = generateVendorQrToken(VENDOR);
    const [w, sig] = token.split('.');
    expect(validateVendorQrToken(VENDOR, `${w}.${sig.replace(/./, (c) => (c === 'a' ? 'b' : 'a'))}`)).toBe(false);
    expect(validateVendorQrToken(VENDOR, `${Number(w) - 2}.${sig}`)).toBe(false);
  });
});

describe('OTP hashing', () => {
  it('produces 6-digit codes and verifies only the right one', () => {
    const code = generateOtp();
    expect(code).toMatch(/^\d{6}$/);
    const h = hashOtp('user-1', 'a@elte.hu', code);
    expect(h).not.toContain(code);
    expect(otpMatches('user-1', 'a@elte.hu', code, h)).toBe(true);
    expect(otpMatches('user-2', 'a@elte.hu', code, h)).toBe(false);
    const wrong = code === '123456' ? '654321' : '123456';
    expect(otpMatches('user-1', 'a@elte.hu', wrong, h)).toBe(false);
  });
});

describe('staff PINs', () => {
  it('matches hashed and legacy plain-text entries', () => {
    const base = { id: 's1', name: 'A', role: 'scanner', active: true, created_at: '' };
    expect(staffPinMatches(VENDOR, '1234', { ...base, pin_hash: hashStaffPin(VENDOR, '1234') })).toBe(true);
    expect(staffPinMatches(VENDOR, '4321', { ...base, pin_hash: hashStaffPin(VENDOR, '1234') })).toBe(false);
    expect(staffPinMatches(VENDOR, '1234', { ...base, pin: '1234' })).toBe(true);
    expect(staffPinMatches('other', '1234', { ...base, pin_hash: hashStaffPin(VENDOR, '1234') })).toBe(false);
  });

  it('signs session cookies', () => {
    const { value } = signStaffCookie(VENDOR, 's1');
    expect(value.split('.')).toHaveLength(2);
  });
});
