// @ts-nocheck
// =============================================================================
// GET /api/admin/audit-log/export
//
// Streams the full audit log as a CSV download.
// Accepts optional ?action= and ?start= / ?end= date filters.
// Admin only.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

function escapeCSV(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(rows: string[][]): string {
  return rows.map((r) => r.map(escapeCSV).join(',')).join('\n');
}

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

  const { searchParams } = new URL(request.url);
  const actionFilter = searchParams.get('action') ?? '';
  const startDate    = searchParams.get('start')  ?? '';
  const endDate      = searchParams.get('end')    ?? '';

  let q = admin
    .from('admin_audit_log')
    .select('id, admin_id, action, entity_type, entity_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(10000); // safety cap

  if (actionFilter) q = q.eq('action', actionFilter);
  if (startDate)    q = q.gte('created_at', startDate);
  if (endDate)      q = q.lte('created_at', endDate);

  const { data: entries, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich admin names
  const adminIds = [...new Set((entries ?? []).map((e) => e.admin_id))];
  const adminMap: Record<string, string> = {};
  if (adminIds.length) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, first_name, last_name, display_name')
      .in('id', adminIds);
    for (const p of profiles ?? []) {
      adminMap[p.id] = p.first_name
        ? `${p.first_name} ${p.last_name ?? ''}`.trim()
        : p.display_name ?? 'Admin';
    }
  }

  const header = ['id', 'timestamp', 'admin_name', 'admin_id', 'action', 'entity_type', 'entity_id', 'metadata'];
  const rows = (entries ?? []).map((e) => [
    e.id,
    e.created_at,
    adminMap[e.admin_id] ?? 'Unknown',
    e.admin_id,
    e.action,
    e.entity_type,
    e.entity_id,
    JSON.stringify(e.metadata ?? {}),
  ]);

  const csv = toCSV([header, ...rows]);
  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
