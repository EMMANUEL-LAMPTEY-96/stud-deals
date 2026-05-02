// =============================================================================
// app/api/vendor/customers/route.ts — Vendor Customer Directory
//
// GET /api/vendor/customers?sort=stamps|recent|name&search=<query>
//
// Returns aggregated customer data for the authenticated vendor:
//   - Unique students who have at least 1 stamp with this vendor
//   - Stamp count, last visit date, rewards claimed
//   - GDPR-safe: email partially masked (first 2 chars + domain)
//   - Sorted by: most stamps (default), most recent visit, or name
//   - Optional search by masked display name
//
// Auth: server-side Supabase session check (vendor_profiles.user_id = auth.uid())
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  const masked = '*'.repeat(Math.max(local.length - 2, 2));
  return `${visible}${masked}@${domain}`;
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (_) {}
        },
      },
    }
  );

  // ── Auth check ──────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Vendor profile check ────────────────────────────────────────────────────
  const { data: vp } = await supabase
    .from('vendor_profiles')
    .select('id, is_approved')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!vp) {
    return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
  }

  if (!vp.is_approved) {
    return NextResponse.json({ error: 'Vendor not approved' }, { status: 403 });
  }

  const vendorId = vp.id;

  // ── Query params ────────────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get('sort') ?? 'stamps'; // stamps | recent | name
  const search = (searchParams.get('search') ?? '').trim().toLowerCase();

  // ── Fetch all redemptions for this vendor ────────────────────────────────────
  // We join to profiles to get display names and emails
  const { data: redemptions, error: rdError } = await supabase
    .from('redemptions')
    .select(`
      student_profile_id,
      status,
      claimed_at,
      student_profiles!inner (
        id,
        user_id,
        profiles (
          id,
          full_name,
          email
        )
      )
    `)
    .eq('vendor_id', vendorId)
    .in('status', ['stamp', 'reward_earned', 'tier_reward', 'confirmed'])
    .order('claimed_at', { ascending: false });

  if (rdError) {
    console.error('[/api/vendor/customers] Fetch error:', rdError.message);
    return NextResponse.json({ error: 'Failed to load customers' }, { status: 500 });
  }

  const rows = redemptions ?? [];

  // ── Aggregate per student ────────────────────────────────────────────────────
  interface CustomerAgg {
    student_profile_id: string;
    full_name: string;
    masked_email: string;
    stamps: number;
    rewards_claimed: number;
    last_visit: string;  // ISO string of most recent stamp
    first_visit: string; // ISO string of first stamp
  }

  const aggMap = new Map<string, CustomerAgg>();

  for (const row of rows) {
    const sid = row.student_profile_id;
    // @ts-ignore — Supabase join typing
    const profile = row.student_profiles?.profiles;
    const fullName: string = profile?.full_name ?? 'Student';
    const email: string = profile?.email ?? '';
    const maskedEmail = email ? maskEmail(email) : '';

    const existing = aggMap.get(sid);
    const isStamp = row.status === 'stamp';
    const isReward = ['reward_earned', 'tier_reward', 'confirmed'].includes(row.status);

    if (!existing) {
      aggMap.set(sid, {
        student_profile_id: sid,
        full_name: fullName,
        masked_email: maskedEmail,
        stamps: isStamp ? 1 : 0,
        rewards_claimed: isReward ? 1 : 0,
        last_visit: row.claimed_at,
        first_visit: row.claimed_at,
      });
    } else {
      if (isStamp) existing.stamps += 1;
      if (isReward) existing.rewards_claimed += 1;
      // last_visit: rows are descending so first encountered = most recent
      // first_visit: always update to current (row) since we're going backwards
      if (new Date(row.claimed_at) < new Date(existing.first_visit)) {
        existing.first_visit = row.claimed_at;
      }
    }
  }

  let customers = Array.from(aggMap.values());

  // ── Search filter ────────────────────────────────────────────────────────────
  if (search) {
    customers = customers.filter(c =>
      c.full_name.toLowerCase().includes(search) ||
      c.masked_email.toLowerCase().includes(search)
    );
  }

  // ── Sort ─────────────────────────────────────────────────────────────────────
  switch (sort) {
    case 'recent':
      customers.sort((a, b) => new Date(b.last_visit).getTime() - new Date(a.last_visit).getTime());
      break;
    case 'name':
      customers.sort((a, b) => a.full_name.localeCompare(b.full_name));
      break;
    case 'stamps':
    default:
      customers.sort((a, b) => b.stamps - a.stamps || new Date(b.last_visit).getTime() - new Date(a.last_visit).getTime());
      break;
  }

  // ── Summary stats ─────────────────────────────────────────────────────────────
  const totalStamps = customers.reduce((s, c) => s + c.stamps, 0);
  const totalRewards = customers.reduce((s, c) => s + c.rewards_claimed, 0);

  return NextResponse.json({
    customers,
    meta: {
      total: customers.length,
      total_stamps: totalStamps,
      total_rewards: totalRewards,
    },
  });
}
