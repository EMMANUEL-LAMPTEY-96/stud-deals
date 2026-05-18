// @ts-nocheck
// =============================================================================
// GET /api/admin/billing
//
// Returns platform-wide billing & revenue metrics for the admin billing page.
//
// Response shape:
// {
//   summary: {
//     total_vendors: number,
//     total_free: number,
//     total_trialing: number,
//     total_growth_active: number,
//     total_pro_active: number,
//     total_past_due: number,
//     total_cancelled: number,
//     estimated_mrr_huf: number,        // growth_active×13990 + pro_active×27990
//     estimated_mrr_eur: number,         // mrr_huf / 400 (rough conversion)
//   },
//   by_tier: [{ tier, count, mrr_huf }],
//   by_city: [{ city, free, trialing, growth, pro, total }],
//   trials_expiring: [VendorRow],        // trial_ends_at within 7 days
//   past_due:        [VendorRow],        // plan_status = 'past_due'
//   recent_upgrades: [VendorRow],        // moved to growth/pro in last 30 days
// }
// =============================================================================

import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const PRICES_HUF: Record<string, number> = {
  free:   0,
  growth: 13_990,
  pro:    27_990,
};

const HUF_TO_EUR = 400; // rough display conversion

export async function GET() {
  // ── Auth + admin guard ────────────────────────────────────────────────────
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

  // ── Fetch all vendor billing data in one query ────────────────────────────
  const { data: vendors, error } = await admin
    .from('vendor_profiles')
    .select(
      'id, user_id, business_name, city, plan_tier, plan_status, trial_ends_at, ' +
      'plan_started_at, plan_expires_at, stripe_customer_id, stripe_subscription_id, created_at'
    )
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!vendors?.length) {
    return NextResponse.json({
      summary: {
        total_vendors: 0, total_free: 0, total_trialing: 0,
        total_growth_active: 0, total_pro_active: 0,
        total_past_due: 0, total_cancelled: 0,
        estimated_mrr_huf: 0, estimated_mrr_eur: 0,
      },
      by_tier: [], by_city: [], trials_expiring: [], past_due: [], recent_upgrades: [],
    });
  }

  // ── Summary counts ────────────────────────────────────────────────────────
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  let total_free = 0, total_trialing = 0, total_growth_active = 0;
  let total_pro_active = 0, total_past_due = 0, total_cancelled = 0;

  const trials_expiring: typeof vendors = [];
  const past_due: typeof vendors = [];
  const recent_upgrades: typeof vendors = [];

  for (const v of vendors) {
    const status = v.plan_status ?? 'free';
    const tier   = v.plan_tier   ?? 'free';

    if (status === 'free' || status === 'cancelled' && tier === 'free') total_free++;
    else if (status === 'trialing') total_trialing++;
    else if (status === 'active' && tier === 'growth') total_growth_active++;
    else if (status === 'active' && tier === 'pro') total_pro_active++;
    else if (status === 'past_due') total_past_due++;
    else if (status === 'cancelled') total_cancelled++;
    else total_free++;

    // Trials expiring within 7 days
    if (status === 'trialing' && v.trial_ends_at) {
      const endsIn = new Date(v.trial_ends_at).getTime() - now;
      if (endsIn > 0 && endsIn <= sevenDays) trials_expiring.push(v);
    }

    // Past due vendors
    if (status === 'past_due') past_due.push(v);

    // Recent upgrades to a paid plan in the last 30 days
    if ((tier === 'growth' || tier === 'pro') && v.plan_started_at) {
      if (now - new Date(v.plan_started_at).getTime() <= thirtyDays) {
        recent_upgrades.push(v);
      }
    }
  }

  const estimated_mrr_huf =
    total_growth_active * PRICES_HUF.growth +
    total_pro_active    * PRICES_HUF.pro;

  const summary = {
    total_vendors:       vendors.length,
    total_free,
    total_trialing,
    total_growth_active,
    total_pro_active,
    total_past_due,
    total_cancelled,
    estimated_mrr_huf,
    estimated_mrr_eur: Math.round(estimated_mrr_huf / HUF_TO_EUR),
  };

  // ── By tier ───────────────────────────────────────────────────────────────
  const tierMap: Record<string, { count: number; paying: number }> = {
    free:   { count: 0, paying: 0 },
    growth: { count: 0, paying: 0 },
    pro:    { count: 0, paying: 0 },
  };
  for (const v of vendors) {
    const tier = v.plan_tier ?? 'free';
    if (!tierMap[tier]) tierMap[tier] = { count: 0, paying: 0 };
    tierMap[tier].count++;
    if (v.plan_status === 'active') tierMap[tier].paying++;
  }
  const by_tier = Object.entries(tierMap).map(([tier, { count, paying }]) => ({
    tier,
    count,
    paying,
    mrr_huf: paying * (PRICES_HUF[tier] ?? 0),
  }));

  // ── By city ───────────────────────────────────────────────────────────────
  const cityMap: Record<string, Record<string, number>> = {};
  for (const v of vendors) {
    const city = v.city ?? 'Unknown';
    if (!cityMap[city]) cityMap[city] = { free: 0, trialing: 0, growth: 0, pro: 0 };
    const tier   = v.plan_tier   ?? 'free';
    const status = v.plan_status ?? 'free';
    if (status === 'trialing') cityMap[city].trialing++;
    else if (tier === 'growth') cityMap[city].growth++;
    else if (tier === 'pro')    cityMap[city].pro++;
    else                        cityMap[city].free++;
  }
  const by_city = Object.entries(cityMap)
    .map(([city, counts]) => ({
      city,
      ...counts,
      total: (counts.free ?? 0) + (counts.trialing ?? 0) + (counts.growth ?? 0) + (counts.pro ?? 0),
    }))
    .sort((a, b) => b.total - a.total);

  // ── Map vendor rows to safe output shape ─────────────────────────────────
  const mapVendor = (v: (typeof vendors)[0]) => ({
    id:                    v.id,
    business_name:         v.business_name ?? '—',
    city:                  v.city ?? '—',
    plan_tier:             v.plan_tier ?? 'free',
    plan_status:           v.plan_status ?? 'free',
    trial_ends_at:         v.trial_ends_at,
    plan_started_at:       v.plan_started_at,
    has_stripe:            !!v.stripe_subscription_id,
  });

  return NextResponse.json({
    summary,
    by_tier,
    by_city,
    trials_expiring: trials_expiring.slice(0, 20).map(mapVendor),
    past_due:        past_due.slice(0, 20).map(mapVendor),
    recent_upgrades: recent_upgrades.slice(0, 20).map(mapVendor),
  });
}
