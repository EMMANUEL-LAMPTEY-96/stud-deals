// @ts-nocheck
// =============================================================================
// PATCH /api/admin/offers/[id]
//
// Admin action on a specific offer: pause, activate, or delete.
// Body: { action: 'pause' | 'activate' | 'delete' }
//
// Audit-logged.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { safeLog } from '@/lib/utils/safe-logger';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { action: 'pause' | 'activate' | 'delete' };
  try { body = await request.json(); } catch (_) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { action } = body;
  if (!['pause', 'activate', 'delete'].includes(action)) {
    return NextResponse.json({ error: 'action must be pause | activate | delete' }, { status: 400 });
  }

  const offerId = params.id;

  // Verify offer exists
  const { data: offer } = await admin
    .from('offers')
    .select('id, title, vendor_id, status')
    .eq('id', offerId)
    .maybeSingle();

  if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });

  if (action === 'delete') {
    const { error } = await admin.from('offers').delete().eq('id', offerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const newStatus = action === 'pause' ? 'inactive' : 'active';
    const { error } = await admin.from('offers').update({ status: newStatus }).eq('id', offerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  const auditAction = action === 'pause' ? 'offer_paused'
    : action === 'activate' ? 'offer_activated'
    : 'offer_deleted';

  await admin.from('admin_audit_log').insert({
    admin_id:    user.id,
    action:      auditAction,
    entity_type: 'offer',
    entity_id:   offerId,
    metadata:    { title: offer.title, vendor_id: offer.vendor_id },
  });

  safeLog.info('[admin/offers] Action recorded', { adminId: user.id, offerId, action });

  return NextResponse.json({ success: true, action, offer_id: offerId });
}
