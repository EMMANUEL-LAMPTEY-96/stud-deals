// @ts-nocheck
// =============================================================================
// GET /api/admin/pending-counts
//
// Lightweight endpoint returning only pending action counts for nav badges.
// Runs 3 fast COUNT queries in parallel.
// =============================================================================

import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
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

  const [verificationRes, vendorRes, reviewsRes] = await Promise.all([
    // Students awaiting ID review
    admin
      .from('student_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'pending_review'),
    // Vendors awaiting approval
    admin
      .from('vendor_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_verified', false)
      .is('verified_at', null),
    // Total reviews (so admin knows if there are any)
    admin
      .from('vendor_reviews')
      .select('id', { count: 'exact', head: true }),
  ]);

  return NextResponse.json({
    pending_verifications: verificationRes.count ?? 0,
    pending_vendors:       vendorRes.count       ?? 0,
    total_reviews:         reviewsRes.count       ?? 0,
  });
}
