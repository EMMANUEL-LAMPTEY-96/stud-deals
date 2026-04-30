// =============================================================================
// app/api/offers/route.ts
// Returns active offers to any authenticated user (service role bypasses RLS
// so unverified students can still browse deals — they just can't claim them).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  // Require authentication
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const search   = searchParams.get('search');
  const city     = searchParams.get('city'); // 'Budapest' | 'Szeged' | null (all)

  // Only serve vendors in our launch cities
  const LAUNCH_CITIES = ['Budapest', 'Szeged'];

  // Use admin client to bypass RLS — any authenticated user can browse offers
  const admin = createAdminClient();

  let query = admin
    .from('offers')
    .select(`
      *,
      vendor:vendor_profiles (
        id,
        business_name,
        logo_url,
        city,
        address_line1,
        is_verified
      )
    `)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('redemption_count', { ascending: false })
    .limit(60);

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  if (search?.trim()) {
    query = query.ilike('title', `%${search.trim()}%`);
  }

  const { data: rawData, error } = await query;

  if (error) {
    console.error('offers API error:', error);
    return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 });
  }

  // Filter to approved vendors in launch cities only
  const filtered = (rawData ?? []).filter((o) => {
    const vendor = o.vendor as { city?: string; is_verified?: boolean } | null;
    const vendorCity = vendor?.city ?? '';
    if (!LAUNCH_CITIES.includes(vendorCity)) return false;
    if (city && LAUNCH_CITIES.includes(city) && vendorCity !== city) return false;
    // Only show offers from approved (verified) vendors
    if (vendor?.is_verified !== true) return false;
    return true;
  });

  return NextResponse.json({ offers: filtered });
}
