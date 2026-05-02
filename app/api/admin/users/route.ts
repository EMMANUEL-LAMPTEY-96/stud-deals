// =============================================================================
// GET /api/admin/users
//
// Returns all users (students + vendors) for the admin user management table.
// Protected: role = 'admin' required.
//
// Query params:
//   ?role=student|vendor|all   (default: all)
//   ?search=string
//   ?city=Budapest|Szeged
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
  const role   = searchParams.get('role') ?? 'all';
  const search = searchParams.get('search')?.toLowerCase() ?? '';
  const city   = searchParams.get('city') ?? '';

  // ── Fetch all profiles ─────────────────────────────────────────────────────
  let profileQuery = admin
    .from('profiles')
    .select('id, role, first_name, last_name, display_name, city, created_at')
    .order('created_at', { ascending: false });

  if (role !== 'all') profileQuery = profileQuery.eq('role', role);
  if (city) profileQuery = profileQuery.eq('city', city);

  const { data: profiles } = await profileQuery;

  if (!profiles?.length) return NextResponse.json({ users: [] });

  const userIds = profiles.map((p) => p.id);

  // ── Batch fetch auth emails ────────────────────────────────────────────────
  const emailMap: Record<string, string> = {};
  await Promise.all(
    userIds.map(async (uid) => {
      try {
        const { data } = await admin.auth.admin.getUserById(uid);
        if (data.user?.email) emailMap[uid] = data.user.email;
      } catch (_) { /* skip */ }
    })
  );

  // ── Fetch student verification statuses ────────────────────────────────────
  const studentIds = profiles.filter((p) => p.role === 'student').map((p) => p.id);
  const verifMap: Record<string, string> = {};
  if (studentIds.length) {
    const { data: studentProfiles } = await admin
      .from('student_profiles')
      .select('user_id, verification_status')
      .in('user_id', studentIds);
    for (const sp of studentProfiles ?? []) {
      verifMap[sp.user_id as string] = sp.verification_status as string;
    }
  }

  // ── Fetch vendor offer counts ──────────────────────────────────────────────
  const vendorUserIds = profiles.filter((p) => p.role === 'vendor').map((p) => p.id);
  const vendorOfferMap: Record<string, { business_name: string; city: string; active_offers: number }> = {};
  if (vendorUserIds.length) {
    const { data: vendorProfiles } = await admin
      .from('vendor_profiles')
      .select('user_id, business_name, city')
      .in('user_id', vendorUserIds);

    const vpIds = (vendorProfiles ?? []).map((vp) => vp.id as string);
    const { data: offerCounts } = vpIds.length
      ? await admin
          .from('offers')
          .select('vendor_id, status')
          .in('vendor_id', vpIds)
      : { data: [] };

    const activeByVendorProfileId: Record<string, number> = {};
    for (const o of offerCounts ?? []) {
      if (o.status === 'active') {
        activeByVendorProfileId[o.vendor_id as string] =
          (activeByVendorProfileId[o.vendor_id as string] ?? 0) + 1;
      }
    }

    for (const vp of vendorProfiles ?? []) {
      vendorOfferMap[vp.user_id as string] = {
        business_name: vp.business_name as string,
        city: vp.city as string,
        active_offers: activeByVendorProfileId[vp.id as string] ?? 0,
      };
    }
  }

  // ── Build user records ─────────────────────────────────────────────────────
  let users = profiles.map((p) => {
    const name = p.first_name
      ? `${p.first_name} ${p.last_name ?? ''}`.trim()
      : p.display_name ?? 'Unknown';

    return {
      id: p.id,
      role: p.role,
      name,
      email: emailMap[p.id] ?? null,
      city: p.city ?? vendorOfferMap[p.id]?.city ?? '',
      created_at: p.created_at,
      // Student-specific
      verification_status: verifMap[p.id] ?? null,
      // Vendor-specific
      business_name: vendorOfferMap[p.id]?.business_name ?? null,
      active_offers: vendorOfferMap[p.id]?.active_offers ?? null,
    };
  });

  // Search filter
  if (search) {
    users = users.filter((u) =>
      u.name.toLowerCase().includes(search) ||
      (u.email ?? '').toLowerCase().includes(search) ||
      (u.business_name ?? '').toLowerCase().includes(search) ||
      (u.city ?? '').toLowerCase().includes(search)
    );
  }

  return NextResponse.json({ users, total: users.length });
}
