// @ts-nocheck
// =============================================================================
// GET /api/admin/redemptions
//
// Paginated list of all redemptions platform-wide.
// Enriched with student name, vendor name, offer title.
//
// Query params:
//   ?page=1&limit=50
//   ?vendor_id=<id>
//   ?student_id=<id>
//   ?status=stamp|claimed|confirmed|reward_earned|voided|admin_void
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: callerProfile } = await admin
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page      = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
  const limit     = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const offset    = (page - 1) * limit;
  const vendorId  = searchParams.get('vendor_id')  ?? '';
  const studentId = searchParams.get('student_id') ?? '';
  const status    = searchParams.get('status')     ?? '';

  let q = admin
    .from('redemptions')
    .select('id, student_id, vendor_id, offer_id, status, redemption_code, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (vendorId)  q = q.eq('vendor_id',  vendorId);
  if (studentId) q = q.eq('student_id', studentId);
  if (status)    q = q.eq('status',     status);

  const { data: rows, count: totalCount, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!rows?.length) {
    return NextResponse.json({ redemptions: [], total: 0, page, limit, total_pages: 0 });
  }

  // Enrich with names
  const studentIds = [...new Set(rows.map((r) => r.student_id))];
  const vendorIds  = [...new Set(rows.map((r) => r.vendor_id))];
  const offerIds   = [...new Set(rows.map((r) => r.offer_id).filter(Boolean))];

  const [{ data: students }, { data: vendors }, { data: offers }] = await Promise.all([
    admin.from('profiles').select('id, first_name, last_name, display_name').in('id', studentIds),
    admin.from('vendor_profiles').select('id, business_name').in('id', vendorIds),
    offerIds.length
      ? admin.from('offers').select('id, title').in('id', offerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const studentMap: Record<string, string> = {};
  for (const s of students ?? []) {
    studentMap[s.id] = s.first_name
      ? `${s.first_name} ${s.last_name ?? ''}`.trim()
      : (s.display_name ?? 'Student');
  }
  const vendorMap: Record<string, string> = {};
  for (const v of vendors ?? []) vendorMap[v.id] = v.business_name;
  const offerMap:  Record<string, string> = {};
  for (const o of offers  ?? []) offerMap[o.id]  = o.title;

  const enriched = rows.map((r) => ({
    ...r,
    student_name: studentMap[r.student_id] ?? 'Unknown',
    vendor_name:  vendorMap[r.vendor_id]   ?? 'Unknown',
    offer_title:  r.offer_id ? (offerMap[r.offer_id] ?? 'Unknown offer') : null,
  }));

  const total       = totalCount ?? enriched.length;
  const total_pages = Math.ceil(total / limit);
  return NextResponse.json({ redemptions: enriched, total, page, limit, total_pages });
}
