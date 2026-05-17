// @ts-nocheck
// =============================================================================
// PATCH /api/admin/users/[id]/ban
//
// Admin-only endpoint to deactivate (ban) or reactivate a user account.
// Sets profiles.is_active = false | true.
// Banned users are blocked at the middleware level — they can't access any
// authenticated route until reactivated.
//
// Body: { action: 'ban' | 'unban' }
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

  let body: { action: 'ban' | 'unban' };
  try { body = await request.json(); } catch (_) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { action } = body;
  if (!['ban', 'unban'].includes(action)) {
    return NextResponse.json({ error: 'action must be "ban" or "unban"' }, { status: 400 });
  }

  const targetId = params.id;

  // Prevent admins from banning themselves
  if (targetId === user.id) {
    return NextResponse.json({ error: 'You cannot ban your own account' }, { status: 400 });
  }

  // Check target user exists
  const { data: targetProfile } = await admin
    .from('profiles')
    .select('id, role, first_name')
    .eq('id', targetId)
    .maybeSingle();

  if (!targetProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Prevent banning other admins
  if (targetProfile.role === 'admin' && action === 'ban') {
    return NextResponse.json({ error: 'Cannot ban another admin account' }, { status: 400 });
  }

  const { error } = await admin
    .from('profiles')
    .update({ is_active: action === 'unban' })
    .eq('id', targetId);

  if (error) {
    safeLog.error('[admin/users/ban] Update error', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  await admin.from('admin_audit_log').insert({
    admin_id:    user.id,
    action:      action === 'ban' ? 'user_banned' : 'user_unbanned',
    entity_type: 'profile',
    entity_id:   targetId,
    metadata:    { target_role: targetProfile.role },
  });

  safeLog.info('[admin/users/ban] Action recorded', { adminId: user.id, targetId, action });

  return NextResponse.json({ success: true, action, user_id: targetId });
}
