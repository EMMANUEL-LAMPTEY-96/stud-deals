// @ts-nocheck
// =============================================================================
// GET /api/admin/approve-vendor/export
//
// Downloads all vendors for a given status as a CSV file.
// ?status=pending|approved|rejected  (default: approved)
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
  const statusFilter = searchParams.get('status') ?? 'approved';

  let vendorQuery = admin
    .from('vendor_profiles')
    .select('id, user_id, business_name, business_type, city, business_email, is_verified, verified_at, created_at, plan_tier, plan_status')
    .order('created_at', { ascending: false });

  if (statusFilter === 'pending') {
    vendorQuery = vendorQuery.eq('is_verified', false).is('verified_at', null);
  } else if (statusFilter === 'approved') {
    vendorQuery = vendorQuery.eq('is_verified', true);
  } else if (statusFilter === 'rejected') {
    vendorQuery = vendorQuery.eq('is_verified', false).not('verified_at', 'is', null);
  }

  const { data: vendors, error } = await vendorQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch emails from auth
  const emailMap: Record<string, string> = {};
  try {
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap[u.id] = u.email;
    }
  } catch { /* non-fatal */ }

  // Build CSV
  const headers = [
    'ID', 'Business Name', 'Business Type', 'City',
    'Auth Email', 'Business Email', 'Status',
    'Plan Tier', 'Plan Status', 'Joined',
  ];

  const rows = (vendors ?? []).map((v) => {
    const status = v.is_verified ? 'approved' : (v.verified_at ? 'rejected' : 'pending');
    return [
      v.id,
      `"${(v.business_name ?? '').replace(/"/g, '""')}"`,
      `"${(v.business_type ?? '').replace(/"/g, '""')}"`,
      v.city ?? '',
      emailMap[v.user_id] ?? '',
      v.business_email ?? '',
      status,
      v.plan_tier ?? 'free',
      v.plan_status ?? 'free',
      new Date(v.created_at).toISOString().split('T')[0],
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const filename = `vendors-${statusFilter}-${new Date().toISOString().split('T')[0]}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
