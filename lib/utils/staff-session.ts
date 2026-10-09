// =============================================================================
// lib/utils/staff-session.ts
//
// Server-only helpers for the staff PIN "scan mode".
//
// - PINs are stored in vendor_profiles.staff_pins as an HMAC (pin_hash), never
//   plain text. Legacy entries with a plain `pin` are accepted once at login
//   and upgraded to a hash.
// - A successful login sets an HttpOnly, signed `staff_session` cookie that
//   identifies (vendor, staff member). Every staff API call re-checks that the
//   staff member still exists and is active, so removing them is immediate.
// =============================================================================

import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const STAFF_COOKIE = 'staff_session';
export const STAFF_SESSION_TTL_SECONDS = 4 * 60 * 60;

export interface StaffPinEntry {
  id: string;
  name: string;
  role: string;
  active: boolean;
  created_at: string;
  pin_hash?: string;
  /** Legacy plain-text PIN — upgraded to pin_hash on first successful login. */
  pin?: string;
}

export interface StaffSession {
  vendorId: string;
  staffId: string;
  staffName: string;
  businessName: string;
  city: string | null;
}

function secret(): string {
  const s = process.env.STAFF_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('STAFF_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY) must be set');
  return s;
}

function hmac(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Keyed per vendor (not per staff member) so duplicate PINs can be detected. */
export function hashStaffPin(vendorId: string, pin: string): string {
  return hmac(`staff-pin:${vendorId}:${pin}`);
}

export function staffPinMatches(vendorId: string, pin: string, entry: StaffPinEntry): boolean {
  if (entry.pin_hash) return safeEqual(hashStaffPin(vendorId, pin), entry.pin_hash);
  if (entry.pin) return safeEqual(pin, String(entry.pin));
  return false;
}

export function parseStaffPins(raw: unknown): StaffPinEntry[] {
  return Array.isArray(raw) ? (raw as StaffPinEntry[]) : [];
}

/** Strip PIN material before sending staff entries to a browser. */
export function publicStaffEntry(e: StaffPinEntry) {
  return { id: e.id, name: e.name, role: e.role, active: e.active, created_at: e.created_at };
}

// ── Session cookie ──────────────────────────────────────────────────────────

export function signStaffCookie(vendorId: string, staffId: string): { value: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + STAFF_SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ v: vendorId, s: staffId, exp })).toString('base64url');
  return { value: `${payload}.${hmac(`staff-session:${payload}`)}`, maxAge: STAFF_SESSION_TTL_SECONDS };
}

function readStaffCookie(value: string | undefined): { vendorId: string; staffId: string } | null {
  if (!value) return null;
  const [payload, sig] = value.split('.');
  if (!payload || !sig || !safeEqual(sig, hmac(`staff-session:${payload}`))) return null;
  try {
    const { v, s, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof v !== 'string' || typeof s !== 'string' || typeof exp !== 'number') return null;
    if (exp < Math.floor(Date.now() / 1000)) return null;
    return { vendorId: v, staffId: s };
  } catch {
    return null;
  }
}

/**
 * Resolve the staff session from the request cookie, re-validating against the
 * DB that the vendor exists and the staff member is still active.
 */
export async function getStaffSession(request: NextRequest): Promise<StaffSession | null> {
  const parsed = readStaffCookie(request.cookies.get(STAFF_COOKIE)?.value);
  if (!parsed) return null;

  const admin = createAdminClient();
  const { data: vp } = await admin
    .from('vendor_profiles')
    .select('id, business_name, city, staff_pins')
    .eq('id', parsed.vendorId)
    .maybeSingle();
  if (!vp) return null;

  const member = parseStaffPins(vp.staff_pins).find((p) => p.id === parsed.staffId && p.active);
  if (!member) return null;

  return {
    vendorId: vp.id,
    staffId: member.id,
    staffName: member.name,
    businessName: vp.business_name,
    city: vp.city ?? null,
  };
}

export const staffCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};
