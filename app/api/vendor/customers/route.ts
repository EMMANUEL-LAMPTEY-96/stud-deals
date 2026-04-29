// =============================================================================
// GET /api/vendor/customers
//
// Returns the list of students who have earned stamps at the calling vendor,
// enriched with:
//   - Display name (first + last from profiles)
//   - Email (from Supabase Auth — only if student has marketing consent)
//   - Stamp count, rewards earned, last visit date
//   - Institution name
//
// GDPR NOTE:
// EU/Hungarian GDPR requires student consent before sharing contact data
// with vendors. Consent is stored in student user_metadata.share_with_vendors.
// Students who haven't explicitly consented have their email masked.
// Add a `share_with_vendors` boolean column to student_profiles when you
// run the next DB migration for cleaner querying.
//
// Query params:
//   ?sort=stamps|recent|name   (default: stamps)
//   ?search=string
//   ?consented=true|false|all  (default: all — shows all, masks non-consented)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export interface CustomerRecord {
  student_profile_id: string;
  user_id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;         // null if no marketing consent
  email_masked: boolean;        // true = student hasn't consented
  institution_name: string | null;
  stamp_count: number;
  rewards_earned: number;
  last_visit_at: string | null;
  first_visit_at: string | null;
  verification_status: string;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // ── Verify caller is a vendor ──────────────────────────────────────────
  const { data: vp } = await admin
    .from('vendor_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!vp) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.toLowerCase() ?? '';
  const sort = searchParams.get('sort') ?? 'stamps';

  // ── Fetch all stamp events for this vendor ────────────────────────────
  const { data: stamps, error: stampsError } = await admin
    .from('redemptions')
    .select(`
      student_id,
      status,
      confirmed_at,
      student_profile:student_profiles!student_id (
        id,
        user_id,
        verification_status,
        institution_id,
        institution:institutions ( name, short_name )
      )
    `)
    .eq('vendor_id', vp.id)
    .in('status', ['stamp', 'reward_earned'])
    .order('confirmed_at', { ascending: false });

  if (stampsError) {
    console.error('customers stamps error:', stampsError);
    return NextResponse.json({ error: stampsError.message }, { status: 500 });
  }

  // ── Group by student_id ───────────────────────────────────────────────
  const grouped: Record<string, {
    student_profile_id: string;
    user_id: string;
    institution_name: string | null;
    verification_status: string;
    stamps: { status: string; confirmed_at: string }[];
  }> = {};

  for (const row of stamps ?? []) {
    const sp = row.student_profile as { id: string; user_id: string; verification_status: string; institution: { name: string } | null } | null;
    if (!sp) continue;
    const key = row.student_id as string;
    if (!grouped[key]) {
      grouped[key] = {
        student_profile_id: sp.id,
        user_id: sp.user_id,
        institution_name: (sp.institution as { name: string } | null)?.name ?? null,
        verification_status: sp.verification_status,
        stamps: [],
      };
    }
    grouped[key].stamps.push({ status: row.status as string, confirmed_at: row.confirmed_at as string });
  }

  // ── Fetch profile + auth data for each unique student ─────────────────
  const userIds = Object.values(grouped).map((g) => g.user_id);
  if (userIds.length === 0) return NextResponse.json({ customers: [] });

  // Get profiles (names)
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, first_name, last_name, display_name')
    .in('id', userIds);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  // Get auth users (emails + consent metadata)
  // We fetch in batches of 50 to avoid timeouts
  const authUserMap: Record<string, { email: string; share_with_vendors: boolean }> = {};
  for (let i = 0; i < userIds.length; i += 50) {
    const batch = userIds.slice(i, i + 50);
    await Promise.all(
      batch.map(async (uid) => {
        try {
          const { data } = await admin.auth.admin.getUserById(uid);
          if (data.user) {
            const meta = data.user.user_metadata ?? {};
            authUserMap[uid] = {
              email: data.user.email ?? '',
              // Default true (opted-in) unless they explicitly opted out
              share_with_vendors: meta.share_with_vendors !== false,
            };
          }
        } catch { /* skip */ }
      })
    );
  }

  // ── Build customer records ─────────────────────────────────────────────
  const customers: CustomerRecord[] = Object.entries(grouped).map(([studentId, g]) => {
    const profile = profileMap[g.user_id];
    const authUser = authUserMap[g.user_id];

    const stampCount = g.stamps.length;
    const rewardsEarned = g.stamps.filter((s) => s.status === 'reward_earned').length;
    const sortedDates = g.stamps
      .map((s) => s.confirmed_at)
      .filter(Boolean)
      .sort();
    const lastVisit = sortedDates[sortedDates.length - 1] ?? null;
    const firstVisit = sortedDates[0] ?? null;

    const hasConsent = authUser?.share_with_vendors ?? false;
    const email = hasConsent ? (authUser?.email ?? null) : null;

    return {
      student_profile_id: g.student_profile_id,
      user_id: g.user_id,
      display_name: profile?.first_name
        ? `${profile.first_name} ${profile.last_name ?? ''}`.trim()
        : profile?.display_name ?? 'Student',
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      email,
      email_masked: !hasConsent,
      institution_name: g.institution_name,
      stamp_count: stampCount,
      rewards_earned: rewardsEarned,
      last_visit_at: lastVisit,
      first_visit_at: firstVisit,
      verification_status: g.verification_status,
    };
  });

  // ── Filter by search ──────────────────────────────────────────────────
  const filtered = search
    ? customers.filter((c) =>
        c.display_name.toLowerCase().includes(search) ||
        (c.email ?? '').toLowerCase().includes(search) ||
        (c.institution_name ?? '').toLowerCase().includes(search)
      )
    : customers;

  // ── Sort ──────────────────────────────────────────────────────────────
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'recent') {
      return new Date(b.last_visit_at ?? 0).getTime() - new Date(a.last_visit_at ?? 0).getTime();
    }
    if (sort === 'name') {
      return a.display_name.localeCompare(b.display_name);
    }
    // default: stamps (most loyal first)
    return b.stamp_count - a.stamp_count;
  });

  return NextResponse.json({
    customers: sorted,
    total: sorted.length,
    consented_count: sorted.filter((c) => !c.email_masked).length,
  });
}
