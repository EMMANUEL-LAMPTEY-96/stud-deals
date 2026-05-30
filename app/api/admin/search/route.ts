// =============================================================================
// GET /api/admin/search?q=string
//
// Cross-entity admin search. Queries in parallel:
//   - profiles (name, email) → users
//   - vendor_profiles (business_name) → vendors
//   - offers (title) → offers
//
// Returns up to 5 results per entity type.
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

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ users: [], vendors: [], offers: [] });
  }

  // ── VULN-05 fix: Sanitize input before interpolating into PostgREST filters ─
  // Commas and parentheses in the user's query would break the .or() filter syntax.
  // LIKE wildcards (%, _) are also escaped so they match literally, not as patterns.
  // This prevents PostgREST injection and ensures the search behaves as expected.
  const sanitizeForPostgREST = (input: string): string =>
    input
      .replace(/%/g, '\\%')   // escape LIKE wildcard
      .replace(/_/g, '\\_')   // escape LIKE single-char wildcard
      .replace(/,/g, ' ')     // comma would inject new .or() clause
      .replace(/[()]/g, ' ')  // parentheses would break nested filter grouping
      .replace(/\./g, ' ')    // dot could inject column references
      .trim();

  const safeQ   = sanitizeForPostgREST(q);
  const pattern = `%${safeQ}%`;

  const [usersRes, vendorsRes, offersRes] = await Promise.all([
    // Users by name — use individual .ilike() fields joined in .or() with a safe pattern
    admin
      .from('profiles')
      .select('id, role, first_name, last_name, display_name, city')
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},display_name.ilike.${pattern}`)
      .limit(5),

    // Vendors by business name
    admin
      .from('vendor_profiles')
      .select('user_id, business_name, city, is_verified')
      .ilike('business_name', pattern)
      .limit(5),

    // Offers by title
    admin
      .from('offers')
      .select('id, title, status, vendor_id')
      .ilike('title', pattern)
      .limit(5),
  ]);

  const users = (usersRes.data ?? []).map((p) => ({
    id:   p.id,
    role: p.role,
    name: p.first_name ? `${p.first_name} ${p.last_name ?? ''}`.trim() : p.display_name ?? 'Unknown',
    city: p.city,
    href: `/admin/users?q=${encodeURIComponent(safeQ)}`,
  }));

  const vendors = (vendorsRes.data ?? []).map((v) => ({
    id:            v.user_id,
    business_name: v.business_name,
    city:          v.city,
    is_verified:   v.is_verified,
    href:          `/admin/vendors?q=${encodeURIComponent(safeQ)}`,
  }));

  const offers = (offersRes.data ?? []).map((o) => ({
    id:        o.id,
    title:     o.title,
    status:    o.status,
    vendor_id: o.vendor_id,
    href:      `/admin/offers?q=${encodeURIComponent(safeQ)}`,
  }));

  return NextResponse.json({ users, vendors, offers });
}
