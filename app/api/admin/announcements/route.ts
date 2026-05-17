// @ts-nocheck
// =============================================================================
// GET  /api/admin/announcements  → preview recipient count
// POST /api/admin/announcements  → send announcement to all users of target role
//
// Body: { title: string, message: string, target: 'all' | 'student' | 'vendor' }
//
// Bulk-inserts into the notifications table.
// Audit-logged.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { safeLog } from '@/lib/utils/safe-logger';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (callerProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const target = new URL(request.url).searchParams.get('target') ?? 'all';

  let q = admin.from('profiles').select('id', { count: 'exact', head: true }).neq('role', 'admin');
  if (target !== 'all') q = q.eq('role', target);

  const { count } = await q;
  return NextResponse.json({ recipient_count: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (callerProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { title: string; message: string; target: 'all' | 'student' | 'vendor' };
  try { body = await request.json(); } catch (_) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { title, message, target } = body;
  if (!title?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'title and message are required' }, { status: 400 });
  }
  if (!['all', 'student', 'vendor'].includes(target)) {
    return NextResponse.json({ error: 'target must be all | student | vendor' }, { status: 400 });
  }

  // Fetch target user IDs (exclude admins)
  let q = admin.from('profiles').select('id').neq('role', 'admin');
  if (target !== 'all') q = q.eq('role', target);
  const { data: recipients } = await q;

  if (!recipients?.length) {
    return NextResponse.json({ error: 'No recipients found', sent: 0 }, { status: 400 });
  }

  // Batch insert notifications — chunk to avoid hitting insert limits
  const CHUNK = 500;
  let sent = 0;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const rows = chunk.map((r) => ({
      user_id: r.id,
      type:    'announcement',
      title,
      message,
      is_read: false,
    }));
    const { error } = await admin.from('notifications').insert(rows);
    if (!error) sent += chunk.length;
    else safeLog.error('[admin/announcements] Insert chunk error', error.message);
  }

  // Audit log
  await admin.from('admin_audit_log').insert({
    admin_id:    user.id,
    action:      'announcement_sent',
    entity_type: 'notification',
    entity_id:   user.id,
    metadata:    { title, target, sent },
  });

  safeLog.info('[admin/announcements] Announcement sent', { adminId: user.id, target, sent });
  return NextResponse.json({ success: true, sent });
}
