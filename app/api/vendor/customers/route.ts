// @ts-nocheck
// Pre-existing Supabase typed-client debt — suppressed until db types are regenerated.
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { safeLog } from '@/lib/utils/safe-logger';

// =============================================================================
// app/api/vendor/customers/route.ts — Vendor Customer Directory
//
// GET /api/vendor/customers?sort=stamps|recent|name&search=<query>
//
// Returns aggregated customer data for the authenticated vendor:
//   - Unique students who have at least 1 stamp/redemption with this vendor
//   - Stamp count, rewards claimed, last/first visit dates
//   - GDPR-safe: email partially masked (first 2 chars + domain)
//   - Sorted by: most stamps (default), most recent visit, or name
// =============================================================================

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  const masked = '*'.repeat(Math.max(local.length - 2, 2));
  return `${visible}${masked}@${domain}`;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  // ── Auth check ──────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Vendor profile ──────────────────────────────────────────────────────────
  const { data: vp } = await supabase
    .from('vendor_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!vp) {
    return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
  }

  const vendorId = vp.id;

  // ── Query params ────────────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get('sort') ?? 'stamps'; // stamps | recent | name

  try {
    // ── Fetch all redemptions with student profile details ──────────────────
    const { data: reds, error: rdErr } = await admin
      .from('redemptions')
      .select(`
        student_id,
        status,
        claimed_at
      `)
      .eq('vendor_id', vendorId)
      .in('status', ['stamp', 'reward_earned', 'tier_reward', 'confirmed'])
      .order('claimed_at', { ascending: false });

    if (rdErr) {
      safeLog.error('customers: redemptions fetch error', rdErr.message);
      return NextResponse.json({ error: 'Failed to load customers' }, { status: 500 });
    }

    const rows = reds ?? [];
    if (rows.length === 0) {
      return NextResponse.json({ customers: [], meta: { total: 0, total_stamps: 0, total_rewards: 0 } });
    }

    // Get unique student profile IDs
    const studentIds = [...new Set(rows.map(r => r.student_id).filter(Boolean))];

    // Fetch student profile + auth user info via admin
    const { data: studentProfiles } = await admin
      .from('student_profiles')
      .select('id, user_id, verification_status, institution_id, institutions(name)')
      .in('id', studentIds);

    const spMap = new Map<string, typeof studentProfiles extends (infer T)[] | null ? T : never>();
    (studentProfiles ?? []).forEach(sp => sp && spMap.set(sp.id, sp));

    // Fetch profiles (name + email) for all user_ids
    const userIds = [...new Set((studentProfiles ?? []).map(sp => sp?.user_id).filter(Boolean))] as string[];
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, first_name, display_name')
      .in('id', userIds);

    const profileMap = new Map<string, { first_name: string | null; display_name: string | null }>();
    (profiles ?? []).forEach(p => p && profileMap.set(p.id, p));

    // Fetch auth users for emails (admin only)
    const emailMap = new Map<string, string>();
    for (const uid of userIds) {
      try {
        const { data: au } = await admin.auth.admin.getUserById(uid);
        if (au?.user?.email) emailMap.set(uid, au.user.email);
      } catch (_) {}
    }

    // ── Aggregate per student ─────────────────────────────────────────────────
    interface CustomerAgg {
      student_profile_id: string;
      user_id: string;
      display_name: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      email_masked: boolean;
      institution_name: string | null;
      stamp_count: number;
      rewards_earned: number;
      last_visit_at: string | null;
      first_visit_at: string | null;
      verification_status: string;
    }

    const aggMap = new Map<string, CustomerAgg>();

    for (const row of rows) {
      const sid = row.student_id;
      if (!sid) continue;

      const sp = spMap.get(sid);
      const uid = sp?.user_id ?? '';
      const profile = profileMap.get(uid);
      const rawEmail = emailMap.get(uid) ?? null;
      const maskedEmail = rawEmail ? maskEmail(rawEmail) : null;
      // @ts-ignore
      const institutionName = sp?.institutions?.name ?? null;

      const isStamp = row.status === 'stamp';
      const isReward = ['reward_earned', 'tier_reward', 'confirmed'].includes(row.status);

      const existing = aggMap.get(sid);
      if (!existing) {
        aggMap.set(sid, {
          student_profile_id: sid,
          user_id: uid,
          display_name: profile?.display_name ?? profile?.first_name ?? 'Student',
          first_name: profile?.first_name ?? null,
          last_name: null,
          email: maskedEmail,
          email_masked: rawEmail !== null,
          institution_name: institutionName,
          stamp_count: isStamp ? 1 : 0,
          rewards_earned: isReward ? 1 : 0,
          last_visit_at: row.claimed_at,
          first_visit_at: row.claimed_at,
          verification_status: sp?.verification_status ?? 'unverified',
        });
      } else {
        if (isStamp) existing.stamp_count += 1;
        if (isReward) existing.rewards_earned += 1;
        // rows are in descending order — last encountered = earliest
        if (row.claimed_at && row.claimed_at < (existing.first_visit_at ?? '')) {
          existing.first_visit_at = row.claimed_at;
        }
      }
    }

    let customers = Array.from(aggMap.values());

    // ── Sort ──────────────────────────────────────────────────────────────────
    switch (sort) {
      case 'recent':
        customers.sort((a, b) =>
          new Date(b.last_visit_at ?? 0).getTime() - new Date(a.last_visit_at ?? 0).getTime()
        );
        break;
      case 'name':
        customers.sort((a, b) => a.display_name.localeCompare(b.display_name));
        break;
      case 'stamps':
      default:
        customers.sort((a, b) =>
          b.stamp_count - a.stamp_count ||
          new Date(b.last_visit_at ?? 0).getTime() - new Date(a.last_visit_at ?? 0).getTime()
        );
        break;
    }

    const totalStamps = customers.reduce((s, c) => s + c.stamp_count, 0);
    const totalRewards = customers.reduce((s, c) => s + c.rewards_earned, 0);

    return NextResponse.json({
      customers,
      meta: {
        total: customers.length,
        total_stamps: totalStamps,
        total_rewards: totalRewards,
      },
    });
  } catch (err) {
    safeLog.error('GET /api/vendor/customers error', (err as Error).message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
