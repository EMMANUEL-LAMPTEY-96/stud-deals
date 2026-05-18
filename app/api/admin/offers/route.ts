// @ts-nocheck
// =============================================================================
// GET /api/admin/offers
//
// Returns all offers across all vendors for admin moderation.
// Includes vendor business name and city for context.
//
// Query params:
//   ?status=active|inactive|draft|all   (default: all)
//   ?city=Budapest|Szeged
//   ?search=string
//   ?page=1&limit=50
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'all';
  const city   = searchParams.get('city')   ?? '';
  const search = searchParams.get('search')?.toLowerCase() ?? '';
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const offset = (page - 1) * limit;

  // Fetch offers with vendor profile join
  let q = admin
    .from('offers')
    .select(`
      id, title, description, category, status, created_at, updated_at,
      discount_value, discount_type,
      vendor_id,
      vendor_profiles!inner ( user_id, business_name, city )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== 'all') q = q.eq('status', status);
  if (city) q = q.eq('vendor_profiles.city', city);
  // Push search to DB so pagination counts stay accurate (no client-side filter)
  if (search) {
    q = q.or(
      `title.ilike.%${search}%,category.ilike.%${search}%,vendor_profiles.business_name.ilike.%${search}%`
    );
  }

  const { data: offers, count: totalCount, error } = await q;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!offers?.length) return NextResponse.json({ offers: [], total: 0, page, limit, total_pages: 0 });

  const mapped = offers.map((o) => ({
    id:             o.id,
    title:          o.title,
    description:    o.description,
    category:       o.category,
    status:         o.status,
    discount_value: o.discount_value,
    discount_type:  o.discount_type,
    created_at:     o.created_at,
    updated_at:     o.updated_at,
    vendor_id:      o.vendor_id,
    business_name:  (o.vendor_profiles as any)?.business_name ?? null,
    city:           (o.vendor_profiles as any)?.city ?? null,
  }));

  const total       = totalCount ?? mapped.length;
  const total_pages = Math.ceil(total / limit);

  return NextResponse.json({ offers: mapped, total, page, limit, total_pages });
}
