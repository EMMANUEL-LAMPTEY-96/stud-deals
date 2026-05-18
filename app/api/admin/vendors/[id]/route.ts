// @ts-nocheck
// =============================================================================
// GET /api/admin/vendors/[id]
//
// Returns a full 360° vendor profile for the admin deep-dive page:
//   - Business info + plan tier/status
//   - All offers with loyalty config parsed
//   - Redemption summary (last 30 days + all-time)
//   - Active stamp cards count (students with ≥1 stamp, no reward yet)
//   - Staff PINs (masked: first char + ***)
//   - Top 5 students by stamp count
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

function parseLoyaltyConfig(terms: string | null) {
  if (!terms) return null;
  const match = terms.match(/^\[\[LOYALTY:(.*?)\]\]/s);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function maskPin(pin: string | null): string | null {
  if (!pin) return null;
  if (pin.length <= 1) return pin;
  return pin[0] + '*'.repeat(pin.length - 1);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: callerProfile } = await admin
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const vendorProfileId = params.id;

  // ── Core vendor profile ───────────────────────────────────────────────────
  const { data: vp, error: vpErr } = await admin
    .from('vendor_profiles')
    .select(`
      id, user_id, business_name, business_type, description,
      city, business_email, business_phone, website_url, logo_url,
      is_verified, verified_at, rejection_notes, created_at,
      plan_tier, plan_status, trial_ends_at, staff_pin
    `)
    .eq('id', vendorProfileId)
    .maybeSingle();

  if (vpErr || !vp) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }

  // ── Auth email ─────────────────────────────────────────────────────────────
  let email: string | null = null;
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(vp.user_id);
    email = authUser?.user?.email ?? null;
  } catch { /* non-fatal */ }

  // ── Offers with loyalty config ────────────────────────────────────────────
  const { data: offers } = await admin
    .from('offers')
    .select('id, title, category, status, discount_value, discount_type, created_at, terms_and_conditions')
    .eq('vendor_id', vendorProfileId)
    .order('created_at', { ascending: false });

  const offersEnriched = (offers ?? []).map((o) => ({
    ...o,
    loyalty_config: parseLoyaltyConfig(o.terms_and_conditions),
    terms_and_conditions: undefined, // strip raw field
  }));

  // ── Redemption summary ────────────────────────────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: allRedemptions } = await admin
    .from('redemptions')
    .select('id, status, created_at, student_id')
    .eq('vendor_id', vendorProfileId);

  const { data: recentRedemptions } = await admin
    .from('redemptions')
    .select('id, status, created_at')
    .eq('vendor_id', vendorProfileId)
    .gte('created_at', thirtyDaysAgo);

  const allReds = allRedemptions ?? [];
  const recentReds = recentRedemptions ?? [];

  const countByStatus = (rows: typeof allReds, s: string) =>
    rows.filter((r) => r.status === s).length;

  const redemptionSummary = {
    all_time: {
      stamps:  allReds.filter((r) => ['stamp', 'reward_earned', 'tier_reward'].includes(r.status)).length,
      claims:  countByStatus(allReds, 'claimed'),
      rewards: countByStatus(allReds, 'reward_earned'),
      total:   allReds.length,
    },
    last_30_days: {
      stamps:  recentReds.filter((r) => ['stamp', 'reward_earned', 'tier_reward'].includes(r.status)).length,
      claims:  countByStatus(recentReds, 'claimed'),
      rewards: countByStatus(recentReds, 'reward_earned'),
      total:   recentReds.length,
    },
  };

  // ── Active stamp cards (students with ≥1 stamp but no completed reward) ──
  const stampStudentIds = new Set(
    allReds
      .filter((r) => ['stamp', 'tier_reward'].includes(r.status))
      .map((r) => r.student_id),
  );
  const activeStampCards = stampStudentIds.size;

  // ── Top 5 students by stamp count ────────────────────────────────────────
  const stampCountMap: Record<string, number> = {};
  for (const r of allReds.filter((r) =>
    ['stamp', 'reward_earned', 'tier_reward'].includes(r.status)
  )) {
    stampCountMap[r.student_id] = (stampCountMap[r.student_id] ?? 0) + 1;
  }
  const top5StudentIds = Object.entries(stampCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  let topStudents: { id: string; name: string; stamps: number }[] = [];
  if (top5StudentIds.length) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, first_name, last_name, display_name')
      .in('id', top5StudentIds);

    topStudents = top5StudentIds.map((sid) => {
      const p = (profiles ?? []).find((x) => x.id === sid);
      const name = p
        ? (p.first_name ? `${p.first_name} ${p.last_name ?? ''}`.trim() : (p.display_name ?? 'Student'))
        : 'Unknown';
      return { id: sid, name, stamps: stampCountMap[sid] };
    });
  }

  return NextResponse.json({
    vendor: {
      ...vp,
      email,
      staff_pin: maskPin(vp.staff_pin),
      approval_status: vp.is_verified
        ? 'approved'
        : vp.verified_at ? 'rejected' : 'pending',
    },
    offers:              offersEnriched,
    redemption_summary:  redemptionSummary,
    active_stamp_cards:  activeStampCards,
    top_students:        topStudents,
  });
}
