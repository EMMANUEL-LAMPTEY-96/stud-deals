// @ts-nocheck
// =============================================================================
// GET /api/admin/reviews
//
// Returns all vendor reviews for admin moderation.
// Includes student name and vendor business name.
//
// Query params:
//   ?rating=1|2|3|4|5     filter by star rating
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
  const ratingFilter = searchParams.get('rating') ? parseInt(searchParams.get('rating')!, 10) : null;
  const search       = searchParams.get('search')?.toLowerCase() ?? '';
  const page         = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
  const limit        = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const offset       = (page - 1) * limit;

  let q = admin
    .from('vendor_reviews')
    .select(`
      id, rating, review_text, vendor_reply, created_at,
      student_id, vendor_id,
      vendor_profiles!inner ( business_name, city )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (ratingFilter) q = q.eq('rating', ratingFilter);

  const { data: reviews, count: totalCount, error } = await q;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!reviews?.length) return NextResponse.json({ reviews: [], total: 0, page, limit, total_pages: 0 });

  // Enrich with student names
  const studentIds = [...new Set(reviews.map((r) => r.student_id))];
  const { data: studentProfiles } = await admin
    .from('profiles')
    .select('id, first_name, last_name, display_name')
    .in('id', studentIds);

  const studentMap: Record<string, string> = {};
  for (const p of studentProfiles ?? []) {
    studentMap[p.id] = p.first_name
      ? `${p.first_name} ${p.last_name ?? ''}`.trim()
      : p.display_name ?? 'Student';
  }

  let mapped = reviews.map((r) => ({
    id:            r.id,
    rating:        r.rating,
    review_text:   r.review_text,
    vendor_reply:  r.vendor_reply,
    created_at:    r.created_at,
    student_id:    r.student_id,
    student_name:  studentMap[r.student_id] ?? 'Unknown',
    vendor_id:     r.vendor_id,
    business_name: (r.vendor_profiles as any)?.business_name ?? null,
    city:          (r.vendor_profiles as any)?.city ?? null,
  }));

  if (search) {
    mapped = mapped.filter((r) =>
      (r.review_text ?? '').toLowerCase().includes(search) ||
      (r.student_name).toLowerCase().includes(search) ||
      (r.business_name ?? '').toLowerCase().includes(search)
    );
  }

  const total       = totalCount ?? mapped.length;
  const total_pages = Math.ceil(total / limit);

  return NextResponse.json({ reviews: mapped, total, page, limit, total_pages });
}
