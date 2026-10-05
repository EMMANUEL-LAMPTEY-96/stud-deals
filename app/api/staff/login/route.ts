// =============================================================================
// POST   /api/staff/login   { vendor_id?: string, pin: string }
// DELETE /api/staff/login   — log out (clears the staff_session cookie)
//
// Server-side staff PIN check for /vendor/scan. The PIN is compared against
// hashed entries in vendor_profiles.staff_pins for ONE vendor (from the scan
// link's ?v= param, or the logged-in vendor's own profile). Failed attempts
// are rate-limited per vendor and per IP via staff_login_attempts.
// =============================================================================

import { safeLog } from '@/lib/utils/safe-logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  STAFF_COOKIE,
  hashStaffPin,
  parseStaffPins,
  signStaffCookie,
  staffCookieOptions,
  staffPinMatches,
} from '@/lib/utils/staff-session';

const WINDOW_MINUTES = 15;
const MAX_FAILS_PER_VENDOR = 10;
const MAX_FAILS_PER_IP = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  let body: { vendor_id?: string; pin?: string };
  try { body = await request.json(); } catch (_) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const pin = String(body.pin ?? '');
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be 4 digits.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── Resolve which vendor this login is for ───────────────────────────────
  let vendorId = body.vendor_id && UUID_RE.test(body.vendor_id) ? body.vendor_id : null;
  if (!vendorId) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: own } = await admin.from('vendor_profiles').select('id').eq('user_id', user.id).maybeSingle();
      vendorId = (own as any)?.id ?? null;
    }
  }
  if (!vendorId) {
    return NextResponse.json(
      { error: 'Open the staff link your manager shared (it includes your shop).' },
      { status: 400 }
    );
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const [vendorFails, ipFails] = await Promise.all([
    admin.from('staff_login_attempts').select('id', { count: 'exact', head: true })
      .eq('vendor_id', vendorId).eq('success', false).gte('attempted_at', since),
    ip
      ? admin.from('staff_login_attempts').select('id', { count: 'exact', head: true })
          .eq('ip', ip).eq('success', false).gte('attempted_at', since)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  if (vendorFails.error || ipFails.error) {
    // Fail closed: without the attempts table a 4-digit PIN is brute-forceable.
    safeLog.error('staff login: rate-limit lookup failed', vendorFails.error ?? ipFails.error);
    return NextResponse.json({ error: 'Staff login is temporarily unavailable.' }, { status: 503 });
  }
  if ((vendorFails.count ?? 0) >= MAX_FAILS_PER_VENDOR || (ipFails.count ?? 0) >= MAX_FAILS_PER_IP) {
    return NextResponse.json(
      { error: `Too many incorrect PINs. Try again in ${WINDOW_MINUTES} minutes.` },
      { status: 429 }
    );
  }

  // ── Check PIN ─────────────────────────────────────────────────────────────
  const { data: vp } = await admin
    .from('vendor_profiles')
    .select('id, business_name, city, staff_pins')
    .eq('id', vendorId)
    .maybeSingle();

  const pins = parseStaffPins((vp as any)?.staff_pins);
  const member = vp ? pins.find((p) => p.active && staffPinMatches(vendorId!, pin, p)) : undefined;

  await admin.from('staff_login_attempts').insert({ vendor_id: vendorId, ip, success: !!member } as any);

  if (!vp || !member) {
    return NextResponse.json({ error: 'Incorrect PIN.' }, { status: 401 });
  }

  // Upgrade a legacy plain-text PIN to a hash.
  if (!member.pin_hash && member.pin) {
    const upgraded = pins.map((p) => {
      if (p.id !== member.id) return p;
      const { pin: _plain, ...rest } = p;
      return { ...rest, pin_hash: hashStaffPin(vendorId!, pin) };
    });
    await admin.from('vendor_profiles').update({ staff_pins: upgraded } as any).eq('id', vendorId);
  }

  const cookie = signStaffCookie(vendorId, member.id);
  const res = NextResponse.json({
    success: true,
    session: {
      vendorId,
      staffName: member.name,
      businessName: (vp as any).business_name,
      city: (vp as any).city ?? null,
    },
  });
  res.cookies.set(STAFF_COOKIE, cookie.value, { ...staffCookieOptions, maxAge: cookie.maxAge });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(STAFF_COOKIE, '', { ...staffCookieOptions, maxAge: 0 });
  return res;
}
