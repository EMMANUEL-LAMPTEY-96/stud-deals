// @ts-nocheck
// =============================================================================
// PATCH /api/admin/redemptions/[id]/void
//
// Voids a specific redemption. Sets status to 'voided'.
// Notifies the student. Full audit log entry.
//
// Body: { reason: string }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: callerProfile } = await admin
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const redemptionId = params.id;
  let body: { reason: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { reason } = body;
  if (!reason || reason.trim().length < 5) {
    return NextResponse.json({ error: 'A reason of at least 5 characters is required' }, { status: 400 });
  }

  // Fetch the redemption
  const { data: redemption } = await admin
    .from('redemptions')
    .select('id, student_id, vendor_id, offer_id, status')
    .eq('id', redemptionId)
    .maybeSingle();

  if (!redemption) return NextResponse.json({ error: 'Redemption not found' }, { status: 404 });

  const alreadyVoided = ['voided', 'admin_void'].includes(redemption.status);
  if (alreadyVoided) {
    return NextResponse.json({ error: 'Redemption is already voided' }, { status: 409 });
  }

  // Void it
  const { error } = await admin
    .from('redemptions')
    .update({ status: 'voided' })
    .eq('id', redemptionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify student
  try {
    const { data: vp } = await admin
      .from('vendor_profiles')
      .select('business_name')
      .eq('id', redemption.vendor_id)
      .maybeSingle();

    await admin.from('notifications').insert({
      user_id: redemption.student_id,
      title:   'Redemption cancelled by platform',
      body:    `A redemption at ${vp?.business_name ?? 'a vendor'} was cancelled. Reason: ${reason}`,
      type:    'redemption_voided',
      is_read: false,
    });
  } catch { /* non-fatal */ }

  // Audit log
  await admin.from('admin_audit_log').insert({
    admin_id:    user.id,
    action:      'redemption_voided',
    entity_type: 'redemption',
    entity_id:   redemptionId,
    metadata: {
      student_id:     redemption.student_id,
      vendor_id:      redemption.vendor_id,
      offer_id:       redemption.offer_id,
      original_status: redemption.status,
      reason,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
