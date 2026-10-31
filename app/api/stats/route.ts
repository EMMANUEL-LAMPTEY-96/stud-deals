// =============================================================================
// app/api/stats/route.ts
//
// Public endpoint — returns live platform stats for the login/signup pages.
// No auth required (counts only, no PII).
//
// Cached by Vercel Edge for 5 minutes (revalidate: 300) so the DB is hit at
// most once every 5 min across all visitors, not on every page load.
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const revalidate = 300; // 5-minute ISR cache on Vercel

export async function GET() {
  try {
    const admin = createAdminClient();

    // Public numbers must not include demo accounts (profiles.is_demo).
    const { data: demoUsers } = await admin.from('profiles').select('id').eq('is_demo', true);
    const demoUserIds = (demoUsers ?? []).map((u: { id: string }) => u.id);
    const { data: demoVendors } = demoUserIds.length
      ? await admin.from('vendor_profiles').select('id').in('user_id', demoUserIds)
      : { data: [] as { id: string }[] };
    const demoVendorIds = (demoVendors ?? []).map((v: { id: string }) => v.id);
    const notIn = (ids: string[]) => `(${ids.join(',')})`;

    const students = admin.from('profiles').select('id', { count: 'exact', head: true })
      .eq('role', 'student').eq('is_demo', false);
    let deals = admin.from('offers').select('id', { count: 'exact', head: true }).eq('status', 'active');
    let vendors = admin.from('vendor_profiles').select('id', { count: 'exact', head: true }).eq('is_verified', true);
    let redemptions = admin.from('redemptions').select('id', { count: 'exact', head: true }).eq('status', 'confirmed');
    if (demoVendorIds.length) {
      deals = deals.not('vendor_id', 'in', notIn(demoVendorIds));
      vendors = vendors.not('id', 'in', notIn(demoVendorIds));
      redemptions = redemptions.not('vendor_id', 'in', notIn(demoVendorIds));
    }

    const [studentsRes, dealsRes, vendorsRes, redemptionsRes] = await Promise.all([
      students, deals, vendors, redemptions,
    ]);

    return NextResponse.json(
      {
        students:    studentsRes.count    ?? 0,
        deals:       dealsRes.count       ?? 0,
        vendors:     vendorsRes.count     ?? 0,
        redemptions: redemptionsRes.count ?? 0,
      },
      {
        headers: {
          // Allow Vercel CDN + browser to cache for 5 min
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch {
    // Fail gracefully — return zeros rather than a 500
    return NextResponse.json(
      { students: 0, deals: 0, vendors: 0, redemptions: 0 },
      { status: 200 },
    );
  }
}
