// =============================================================================
// GET /api/admin/audit-log
//
// Returns paginated admin audit log entries.
// Joins with profiles to get admin name.
//
// Query params:
//   ?page=1&limit=50
//   ?action=user_banned|student_verified|vendor_approved|...
//   ?entity_type=profile|student_profile|vendor_profile
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

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
  const page        = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
  const limit       = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const offset      = (page - 1) * limit;
  const actionFilter     = searchParams.get('action')      ?? '';
  const entityTypeFilter = searchParams.get('entity_type') ?? '';
  const startDate        = searchParams.get('start')       ?? '';
  const endDate          = searchParams.get('end')         ?? '';

  let q = admin
    .from('admin_audit_log')
    .select('id, admin_id, action, entity_type, entity_id, metadata, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (actionFilter)     q = q.eq('action',      actionFilter);
  if (entityTypeFilter) q = q.eq('entity_type', entityTypeFilter);
  if (startDate)        q = q.gte('created_at', startDate);
  if (endDate)          q = q.lte('created_at', endDate);

  const { data: entries, count: totalCount, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!entries?.length) {
    return NextResponse.json({ entries: [], total: 0, page, limit, total_pages: 0 });
  }

  // Enrich with admin names
  const adminIds = [...new Set(entries.map((e) => e.admin_id))];
  const { data: adminProfiles } = await admin
    .from('profiles')
    .select('id, first_name, last_name, display_name')
    .in('id', adminIds);

  const adminMap: Record<string, string> = {};
  for (const p of adminProfiles ?? []) {
    adminMap[p.id] = p.first_name
      ? `${p.first_name} ${p.last_name ?? ''}`.trim()
      : p.display_name ?? 'Admin';
  }

  const enriched = entries.map((e) => ({
    ...e,
    admin_name: adminMap[e.admin_id] ?? 'Unknown',
  }));

  const total       = totalCount ?? enriched.length;
  const total_pages = Math.ceil(total / limit);

  return NextResponse.json({ entries: enriched, total, page, limit, total_pages });
}
