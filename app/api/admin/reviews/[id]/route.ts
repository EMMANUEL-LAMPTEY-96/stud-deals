// =============================================================================
// DELETE /api/admin/reviews/[id]
//
// Admin removes an abusive/spam/fake review permanently.
// Audit-logged.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { safeLog } from '@/lib/utils/safe-logger';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const reviewId = params.id;

  const { data: review } = await admin
    .from('vendor_reviews')
    .select('id, student_id, vendor_id, rating')
    .eq('id', reviewId)
    .maybeSingle();

  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

  const { error } = await admin.from('vendor_reviews').delete().eq('id', reviewId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('admin_audit_log').insert({
    admin_id:    user.id,
    action:      'review_deleted',
    entity_type: 'vendor_review',
    entity_id:   reviewId,
    metadata:    { student_id: review.student_id, vendor_id: review.vendor_id, rating: review.rating },
  });

  safeLog.info('[admin/reviews] Review deleted', { adminId: user.id, reviewId });

  return NextResponse.json({ success: true, review_id: reviewId });
}
