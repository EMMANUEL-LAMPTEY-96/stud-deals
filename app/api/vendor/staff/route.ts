// =============================================================================
// GET  /api/vendor/staff — list the vendor's staff (no PIN material returned)
// POST /api/vendor/staff — { action: 'add', name, pin } | { action: 'toggle' | 'delete', id }
//
// PINs are hashed server-side before being stored in vendor_profiles.staff_pins.
// =============================================================================

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  hashStaffPin,
  parseStaffPins,
  publicStaffEntry,
  staffPinMatches,
  type StaffPinEntry,
} from '@/lib/utils/staff-session';

async function getOwnVendor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from('vendor_profiles')
    .select('id, business_name, staff_pins')
    .eq('user_id', user.id)
    .maybeSingle();
  return data as { id: string; business_name: string; staff_pins: unknown } | null;
}

export async function GET() {
  const vp = await getOwnVendor();
  if (!vp) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({
    vendor_id: vp.id,
    business_name: vp.business_name,
    staff: parseStaffPins(vp.staff_pins).map(publicStaffEntry),
  });
}

export async function POST(request: NextRequest) {
  const vp = await getOwnVendor();
  if (!vp) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action?: string; id?: string; name?: string; pin?: string };
  try { body = await request.json(); } catch (_) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  let pins = parseStaffPins(vp.staff_pins);

  switch (body.action) {
    case 'add': {
      const name = String(body.name ?? '').trim().slice(0, 60);
      const pin = String(body.pin ?? '');
      if (!name) return NextResponse.json({ error: 'Staff name is required.' }, { status: 400 });
      if (!/^\d{4}$/.test(pin)) return NextResponse.json({ error: 'PIN must be exactly 4 digits.' }, { status: 400 });
      if (pins.some((p) => staffPinMatches(vp.id, pin, p))) {
        return NextResponse.json({ error: 'That PIN is already in use. Choose another.' }, { status: 409 });
      }
      const entry: StaffPinEntry = {
        id: randomUUID(),
        name,
        role: 'scanner',
        active: true,
        created_at: new Date().toISOString(),
        pin_hash: hashStaffPin(vp.id, pin),
      };
      pins = [...pins, entry];
      break;
    }
    case 'toggle':
      pins = pins.map((p) => (p.id === body.id ? { ...p, active: !p.active } : p));
      break;
    case 'delete':
      pins = pins.filter((p) => p.id !== body.id);
      break;
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('vendor_profiles').update({ staff_pins: pins } as any).eq('id', vp.id);
  if (error) return NextResponse.json({ error: 'Could not save staff.' }, { status: 500 });

  return NextResponse.json({ staff: pins.map(publicStaffEntry) });
}
