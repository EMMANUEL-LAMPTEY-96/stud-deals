// =============================================================================
// GET  /api/admin/config → returns all platform config key/value pairs
// PATCH /api/admin/config → updates one or more config keys
//
// Body: { key: string, value: boolean | number | string }
// Uses admin client (service role) for writes so RLS doesn't block us.
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

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await admin
    .from('platform_config')
    .select('key, value, updated_at, updated_by')
    .order('key');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return as flat map for convenience
  const config: Record<string, unknown> = {};
  for (const row of data ?? []) {
    config[row.key] = row.value;
  }

  return NextResponse.json({ config, rows: data ?? [] });
}

export async function PATCH(request: NextRequest) {
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

  let body: { key: string; value: unknown };
  try { body = await request.json(); } catch (_) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { key, value } = body;
  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });

  // Capture old value before updating (for full audit trail)
  const { data: oldRow } = await admin
    .from('platform_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  const { error } = await admin
    .from('platform_config')
    .update({ value, updated_by: user.id })
    .eq('key', key);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('admin_audit_log').insert({
    admin_id:    user.id,
    action:      'config_updated',
    entity_type: 'platform_config',
    entity_id:   key,
    metadata:    { key, old_value: oldRow?.value ?? null, new_value: value },
  });

  safeLog.info('[admin/config] Config updated', { adminId: user.id, key, value });
  return NextResponse.json({ success: true, key, value });
}
