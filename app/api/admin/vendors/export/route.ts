// @ts-nocheck
// =============================================================================
// GET /api/admin/vendors/export
//
// Returns all vendors as a CSV download.
// Protected: admin only.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

function escapeCSV(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines   = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escapeCSV(r[h] as string)).join(',')),
  ];
  return lines.join('\n');
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

  const { data: vendors } = await admin
    .from('vendor_profiles')
    .select('user_id, business_name, city, is_verified, plan_tier, created_at')
    .order('created_at', { ascending: false });

  // Fetch emails
  const emailMap: Record<string, string> = {};
  try {
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap[u.id] = u.email;
    }
  } catch (_) {}

  // Fetch active offer counts per vendor
  const vpIds = (vendors ?? []).map((v) => v.user_id as string);
  const offerCounts: Record<string, number> = {};
  if (vpIds.length) {
    const { data: offerRows } = await admin
      .from('offers')
      .select('vendor_id, status')
      .in('vendor_id', vpIds);
    for (const o of offerRows ?? []) {
      if (o.status === 'active') {
        offerCounts[o.vendor_id as string] = (offerCounts[o.vendor_id as string] ?? 0) + 1;
      }
    }
  }

  const rows = (vendors ?? []).map((v) => ({
    user_id:       v.user_id,
    business_name: v.business_name,
    email:         emailMap[v.user_id as string] ?? '',
    city:          v.city ?? '',
    is_verified:   v.is_verified ?? false,
    plan_tier:     v.plan_tier ?? '',
    active_offers: offerCounts[v.user_id as string] ?? 0,
    created_at:    v.created_at,
  }));

  const csv = toCSV(rows);
  const filename = `vendors_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
