// =============================================================================
// GET /api/admin/stats
//
// Returns platform-wide statistics for the admin dashboard.
// Protected: caller must have role = 'admin' in profiles table.
//
// Returns:
//   overview      — totals: students, vendors, stamps_today, stamps_total,
//                   rewards_total, active_offers, unverified_students,
//                   pending_verifications
//   cities        — per-city breakdown { city, students, vendors, stamps }
//   activity      — last 20 events (stamps, registrations, verifications)
//   daily_stamps  — last 14 days stamp counts for the sparkline chart
// =============================================================================

import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // Role check
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // ── Run all queries in parallel ────────────────────────────────────────────
  const [
    studentsRes,
    vendorsRes,
    stampsTodayRes,
    stampsTotalRes,
    rewardsRes,
    activeOffersRes,
    unverifiedRes,
    pendingVerifRes,
    pendingVendorsRes,
    recentActivityRes,
    dailyStampsRes,
    cityVendorsRes,
  ] = await Promise.all([
    // Total students
    admin.from('student_profiles').select('id', { count: 'exact', head: true }),
    // Total vendors
    admin.from('vendor_profiles').select('id', { count: 'exact', head: true }),
    // Stamps today
    admin.from('redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'stamp')
      .gte('confirmed_at', todayStart.toISOString()),
    // Stamps total
    admin.from('redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'stamp'),
    // Rewards total
    admin.from('redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'reward_earned'),
    // Active offers
    admin.from('offers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    // Unverified students
    admin.from('student_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'unverified'),
    // Pending student verification reviews
    admin.from('student_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'pending_review'),
    // Pending vendor approvals: is_verified = false AND verified_at IS NULL
    admin.from('vendor_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_verified', false)
      .is('verified_at', null),
    // Recent activity (stamps + registrations)
    admin.from('redemptions')
      .select(`
        id, status, confirmed_at,
        student:student_profiles!student_id (
          id,
          profile:profiles!user_id ( first_name, last_name, display_name )
        ),
        vendor:vendor_profiles!vendor_id ( business_name, city )
      `)
      .in('status', ['stamp', 'reward_earned'])
      .order('confirmed_at', { ascending: false })
      .limit(20),
    // Daily stamps — last 14 days
    admin.from('redemptions')
      .select('confirmed_at')
      .eq('status', 'stamp')
      .gte('confirmed_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order('confirmed_at', { ascending: true }),
    // Vendors with city for city breakdown
    admin.from('vendor_profiles')
      .select('id, city'),
  ]);

  // ── City breakdown ─────────────────────────────────────────────────────────
  const LAUNCH_CITIES = ['Budapest', 'Szeged'];

  // Count vendors per city
  const vendorsByCity: Record<string, number> = {};
  for (const v of cityVendorsRes.data ?? []) {
    const c = (v.city as string) || 'Other';
    vendorsByCity[c] = (vendorsByCity[c] ?? 0) + 1;
  }

  // Stamps per city from activity
  const allStampsRes = await admin
    .from('redemptions')
    .select(`
      status,
      vendor:vendor_profiles!vendor_id ( city )
    `)
    .in('status', ['stamp', 'reward_earned']);

  const stampsByCity: Record<string, number> = {};
  for (const r of allStampsRes.data ?? []) {
    const c = (r.vendor as { city?: string } | null)?.city ?? 'Other';
    stampsByCity[c] = (stampsByCity[c] ?? 0) + 1;
  }

  // Students per city (via profiles.city)
  const studentsPerCityRes = await admin
    .from('profiles')
    .select('city')
    .eq('role', 'student');

  const studentsByCity: Record<string, number> = {};
  for (const p of studentsPerCityRes.data ?? []) {
    const c = (p.city as string) || 'Unknown';
    studentsByCity[c] = (studentsByCity[c] ?? 0) + 1;
  }

  const cities = LAUNCH_CITIES.map((city) => ({
    city,
    students: studentsByCity[city] ?? 0,
    vendors:  vendorsByCity[city]  ?? 0,
    stamps:   stampsByCity[city]   ?? 0,
  }));

  // ── Daily stamps chart data ────────────────────────────────────────────────
  const dailyMap: Record<string, number> = {};
  for (const r of dailyStampsRes.data ?? []) {
    const day = (r.confirmed_at as string).slice(0, 10);
    dailyMap[day] = (dailyMap[day] ?? 0) + 1;
  }

  const daily_stamps = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    return { date: key, count: dailyMap[key] ?? 0 };
  });

  // ── Format activity feed ───────────────────────────────────────────────────
  const activity = (recentActivityRes.data ?? []).map((r) => {
    const sp = r.student as { id: string; profile: { first_name: string | null; last_name: string | null; display_name: string | null } | null } | null;
    const profileData = sp?.profile;
    const name = profileData?.first_name
      ? `${profileData.first_name} ${profileData.last_name ?? ''}`.trim()
      : profileData?.display_name ?? 'Student';
    const vendor = r.vendor as { business_name: string; city: string } | null;
    return {
      id: r.id,
      type: r.status,
      student_name: name,
      vendor_name: vendor?.business_name ?? 'Unknown',
      city: vendor?.city ?? '',
      at: r.confirmed_at,
    };
  });

  return NextResponse.json({
    overview: {
      students:              studentsRes.count ?? 0,
      vendors:               vendorsRes.count ?? 0,
      stamps_today:          stampsTodayRes.count ?? 0,
      stamps_total:          stampsTotalRes.count ?? 0,
      rewards_total:         rewardsRes.count ?? 0,
      active_offers:         activeOffersRes.count ?? 0,
      unverified_students:   unverifiedRes.count ?? 0,
      pending_verifications: pendingVerifRes.count ?? 0,
      pending_vendors:       pendingVendorsRes.count ?? 0,
    },
    cities,
    activity,
    daily_stamps,
  });
}
