// =============================================================================
// GET /api/admin/users/export
//
// Returns all users as a CSV download.
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

  // Fetch all profiles
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, role, first_name, last_name, display_name, city, created_at, is_active')
    .order('created_at', { ascending: false });

  // Fetch all emails in one call
  const emailMap: Record<string, string> = {};
  try {
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap[u.id] = u.email;
    }
  } catch (_) {}

  // Fetch student verification statuses
  const studentIds = (profiles ?? []).filter((p) => p.role === 'student').map((p) => p.id);
  const verifMap: Record<string, string> = {};
  if (studentIds.length) {
    const { data: sp } = await admin
      .from('student_profiles')
      .select('user_id, verification_status')
      .in('user_id', studentIds);
    for (const s of sp ?? []) verifMap[s.user_id as string] = s.verification_status as string;
  }

  const rows = (profiles ?? []).map((p) => ({
    id:                  p.id,
    role:                p.role,
    name:                p.first_name ? `${p.first_name} ${p.last_name ?? ''}`.trim() : p.display_name ?? '',
    email:               emailMap[p.id] ?? '',
    city:                p.city ?? '',
    is_active:           p.is_active ?? true,
    verification_status: verifMap[p.id] ?? '',
    created_at:          p.created_at,
  }));

  const csv = toCSV(rows);
  const filename = `users_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
