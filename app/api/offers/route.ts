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
        address_line1
      )
    `)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('redemption_count', { ascending: false })
    .limit(40);

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  if (search?.trim()) {
    query = query.ilike('title', `%${search.trim()}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('offers API error:', error);
    return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 });
  }

  return NextResponse.json({ offers: data ?? [] });
}
