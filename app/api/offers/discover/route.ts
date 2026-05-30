// =============================================================================
// GET /api/offers/discover
//
// Returns three curated offer lists for the student dashboard discovery section.
// All lists only return ACTIVE offers (status = 'active').
//
// Response:
// {
//   trending:       DiscoverOffer[]   // top 5 most claimed in last 7 days
//   expiring_soon:  DiscoverOffer[]   // expires_at within 48 hours
//   new_this_week:  DiscoverOffer[]   // created in last 7 days, up to 5
// }
//
// DiscoverOffer: { id, title, category, discount_value, discount_type,
//                  expires_at, claim_count, business_name, city, logo_url }
// =============================================================================

import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  // Must be authenticated (student or any role)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Admin client used for cross-user aggregation (trending counts across all students)
  const adminSupabase = createAdminClient();

  const now     = new Date();
  const in48h   = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  const ago7d   = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString();
  const nowISO  = now.toISOString();

  // ── Base offer SELECT with vendor join ────────────────────────────────────
  const offerSelect = `
    id, title, category, status, discount_value, discount_type,
    expires_at, created_at,
    vendor_profiles!inner ( business_name, city, logo_url )
  `;

  // ── 1. Trending: count recent redemptions per offer ───────────────────────
  // Use admin client to bypass RLS — trending needs counts across ALL students
  const { data: recentRedemptions } = await adminSupabase
    .from('redemptions')
    .select('offer_id')
    .gte('created_at', ago7d)
    .in('status', ['claimed', 'confirmed']);

  // Build claim count map
  const claimMap: Record<string, number> = {};
  for (const r of recentRedemptions ?? []) {
    if (r.offer_id) claimMap[r.offer_id] = (claimMap[r.offer_id] ?? 0) + 1;
  }

  // Get the top offer IDs by recent claims (max 20 candidates → trim to 5 after fetch)
  const topOfferIds = Object.entries(claimMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id]) => id);

  let trending: unknown[] = [];
  if (topOfferIds.length > 0) {
    const { data: trendingOffers } = await supabase
      .from('offers')
      .select(offerSelect)
      .in('id', topOfferIds)
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${nowISO}`);

    trending = (trendingOffers ?? [])
      .map((o) => ({
        ...mapOffer(o),
        claim_count: claimMap[o.id] ?? 0,
      }))
      .sort((a, b) => (b as any).claim_count - (a as any).claim_count)
      .slice(0, 5);
  }

  // ── 2. Expiring soon: active offers expiring within 48 hours ─────────────
  const { data: expiringOffers } = await supabase
    .from('offers')
    .select(offerSelect)
    .eq('status', 'active')
    .gt('expires_at', nowISO)
    .lte('expires_at', in48h)
    .order('expires_at', { ascending: true })
    .limit(6);

  const expiring_soon = (expiringOffers ?? []).map((o) => ({
    ...mapOffer(o),
    claim_count: claimMap[o.id] ?? 0,
  }));

  // ── 3. New this week: offers created in last 7 days ───────────────────────
  const { data: newOffers } = await supabase
    .from('offers')
    .select(offerSelect)
    .eq('status', 'active')
    .gte('created_at', ago7d)
    .or(`expires_at.is.null,expires_at.gt.${nowISO}`)
    .order('created_at', { ascending: false })
    .limit(5);

  const new_this_week = (newOffers ?? []).map((o) => ({
    ...mapOffer(o),
    claim_count: claimMap[o.id] ?? 0,
  }));

  return NextResponse.json({ trending, expiring_soon, new_this_week });
}

// ── Map raw Supabase row to DiscoverOffer ─────────────────────────────────
function mapOffer(o: any) {
  const vp = Array.isArray(o.vendor_profiles) ? o.vendor_profiles[0] : o.vendor_profiles;
  return {
    id:             o.id,
    title:          o.title,
    category:       o.category,
    discount_value: o.discount_value,
    discount_type:  o.discount_type,
    expires_at:     o.expires_at,
    created_at:     o.created_at,
    business_name:  vp?.business_name ?? null,
    city:           vp?.city          ?? null,
    logo_url:       vp?.logo_url      ?? null,
  };
}
