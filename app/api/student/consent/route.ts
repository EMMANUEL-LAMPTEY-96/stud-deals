// =============================================================================
// app/api/student/consent/route.ts
// PATCH /api/student/consent
//
// Updates the student's marketing consent preference (share_with_vendors).
// GDPR-compliant: records consent_updated_at timestamp for audit trail.
//
// Auth: requires a signed-in student.
// Body: { share_with_vendors: boolean }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeLog } from '@/lib/utils/safe-logger';

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Auth ──────────────────────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 });
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await request.json();
    const { share_with_vendors } = body;

    if (typeof share_with_vendors !== 'boolean') {
      return NextResponse.json(
        { error: 'share_with_vendors must be a boolean.' },
        { status: 400 }
      );
    }

    // ── Verify this user has a student_profile ────────────────────────────────
    const { data: sp } = await supabase
      .from('student_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!sp) {
      return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 });
    }

    // ── Update consent ────────────────────────────────────────────────────────
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('student_profiles')
      .update({
        share_with_vendors,
        consent_updated_at: now,
        updated_at: now,
      })
      .eq('user_id', user.id);

    if (updateError) {
      safeLog.error('[student/consent] DB update error', updateError.message);
      return NextResponse.json(
        { error: 'Failed to update consent preference.' },
        { status: 500 }
      );
    }

    safeLog.info('[student/consent] Consent updated', {
      userId: user.id,
      share_with_vendors,
    });

    return NextResponse.json({
      success: true,
      share_with_vendors,
      updated_at: now,
      message: share_with_vendors
        ? 'Consent granted — vendors can now see your anonymised activity.'
        : 'Consent withdrawn — your data will no longer be shared with vendors.',
    });
  } catch (err) {
    safeLog.error('[student/consent] Unexpected error', (err as Error).message);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
