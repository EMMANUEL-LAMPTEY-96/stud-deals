// =============================================================================
// GET /api/vendor/stamp-qr
//
// Returns a short-lived signed token for the vendor's "scan to earn a stamp"
// QR (VendorQRPanel). Callable by the vendor owner (Supabase session) or by
// staff in scan mode (staff_session cookie).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/utils/staff-session';
import { generateVendorQrToken } from '@/lib/utils/stamp-qr';

export async function GET(request: NextRequest) {
  let vendorId: string | null = null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const admin = createAdminClient();
    const { data: vp } = await admin.from('vendor_profiles').select('id').eq('user_id', user.id).maybeSingle();
    vendorId = (vp as { id: string } | null)?.id ?? null;
  }
  if (!vendorId) {
    vendorId = (await getStaffSession(request))?.vendorId ?? null;
  }
  if (!vendorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token, refreshInMs } = generateVendorQrToken(vendorId);
  return NextResponse.json(
    { vendor_id: vendorId, token, refresh_in_ms: refreshInMs },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
