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

    const [studentsRes, dealsRes, vendorsRes, redemptionsRes] = await Promise.all([
      admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student'),
      admin
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      admin
        .from('vendor_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_verified', true),
      admin
        .from('redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed'),
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
