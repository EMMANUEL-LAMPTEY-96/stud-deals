// =============================================================================
// app/api/admin/verifications/review/route.ts
// POST /api/admin/verifications/review
//
// Admin approves or rejects a student document verification submission.
// On approval  → sets verification_status = 'verified', records verified_at + verified_by
// On rejection → sets verification_status = 'rejected', records rejection reason in notes
// In both cases, a notification row is inserted for the student.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeLog } from '@/lib/utils/safe-logger';

interface ReviewRequest {
  student_profile_id: string;
  decision: 'approve' | 'reject';
  rejection_reason?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Auth + role check ─────────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const body: ReviewRequest = await request.json();
    const { student_profile_id, decision, rejection_reason } = body;

    if (!student_profile_id || !decision) {
      return NextResponse.json({ error: 'student_profile_id and decision are required.' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(decision)) {
      return NextResponse.json({ error: 'decision must be "approve" or "reject".' }, { status: 400 });
    }

    if (decision === 'reject' && !rejection_reason?.trim()) {
      return NextResponse.json({ error: 'A rejection reason is required.' }, { status: 400 });
    }

    // ── Fetch the student profile ─────────────────────────────────────────────
    const { data: studentProfile, error: fetchError } = await supabase
      .from('student_profiles')
      .select('id, user_id, verification_status')
      .eq('id', student_profile_id)
      .maybeSingle();

    if (fetchError || !studentProfile) {
      return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 });
    }

    if (studentProfile.verification_status !== 'pending_review') {
      return NextResponse.json(
        { error: 'This submission is not in pending_review status.' },
        { status: 409 }
      );
    }

    // ── Build update payload ─────────────────────────────────────────────────
    const now = new Date().toISOString();

    const updatePayload =
      decision === 'approve'
        ? {
            verification_status: 'verified' as const,
            verification_method: 'id_upload' as const,
            verified_at: now,
            verified_by: user.id,
            verification_notes: 'Approved by admin after document review.',
            updated_at: now,
          }
        : {
            verification_status: 'rejected' as const,
            verified_at: null,
            verified_by: null,
            verification_notes: `Rejected by admin: ${rejection_reason}`,
            updated_at: now,
          };

    const { error: updateError } = await supabase
      .from('student_profiles')
      .update(updatePayload)
      .eq('id', student_profile_id);

    if (updateError) {
      safeLog.error('[admin/verifications/review] Update error', updateError.message);
      return NextResponse.json({ error: 'Failed to update verification status.' }, { status: 500 });
    }

    // ── Insert notification for the student ──────────────────────────────────
    const notifTitle =
      decision === 'approve'
        ? 'You\'re verified! 🎉'
        : 'Verification update';

    const notifBody =
      decision === 'approve'
        ? 'Your student ID has been reviewed and approved. You now have full access to all student deals!'
        : `Your verification was not approved: ${rejection_reason}. You can re-upload a clearer document on your verification page.`;

    await supabase.from('notifications').insert({
      user_id: studentProfile.user_id,
      title: notifTitle,
      body: notifBody,
      type: decision === 'approve' ? 'verification_approved' : 'verification_rejected',
      related_entity_type: 'student_profile',
      related_entity_id: student_profile_id,
      is_read: false,
      created_at: now,
    }).throwOnError().catch(() => {
      // Non-fatal
    });

    safeLog.info('[admin/verifications/review] Decision recorded', {
      adminId: user.id,
      studentProfileId: student_profile_id,
      decision,
    });

    return NextResponse.json({
      success: true,
      decision,
      message:
        decision === 'approve'
          ? 'Student verified successfully.'
          : 'Submission rejected and student notified.',
    });
  } catch (err) {
    safeLog.error('[admin/verifications/review] Unexpected error', (err as Error).message);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
