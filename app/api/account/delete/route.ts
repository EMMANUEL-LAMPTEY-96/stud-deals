/**
 * DELETE /api/account/delete
 *
 * GDPR-compliant full account deletion.
 * Cascade deletes: auth user, profiles, student_profiles (+ Storage ID scan),
 * redemptions, loyalty_cards, stamps, notifications, verification_attempts.
 *
 * Requires: authenticated session + confirmation token in body.
 * Records a PII-free audit log entry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeLog } from '@/lib/utils/safe-logger';

// Supabase admin client uses SERVICE_ROLE to bypass RLS for cascade deletes
import { createClient as createAdminClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function DELETE(request: NextRequest) {
  try {
    // 1. Authenticate â must be a real logged-in user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    // 2. Require explicit confirmation in request body
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== 'DELETE_MY_ACCOUNT') {
      return NextResponse.json(
        { error: 'Please confirm deletion by sending { "confirm": "DELETE_MY_ACCOUNT" }' },
        { status: 400 }
      );
    }

    const userId = user.id;
    const admin = getAdminClient();

    // 3. Fetch the user's role and any storage document to delete
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const userRole = profile?.role ?? 'unknown';

    // 4. If student â delete the ID scan from Storage before removing DB rows
    if (userRole === 'student') {
      const { data: studentProfile } = await admin
        .from('student_profiles')
        .select('verification_document_url')
        .eq('user_id', userId)
        .maybeSingle();

      if (studentProfile?.verification_document_url) {
        // Extract storage path from full URL
        const storagePath = studentProfile.verification_document_url
          .replace(/.*\/storage\/v1\/object\/public\//, '')
          .replace(/.*\/storage\/v1\/object\//, '');

        const [bucket, ...pathParts] = storagePath.split('/');
        const filePath = pathParts.join('/');

        if (bucket && filePath) {
          const { error: storageError } = await admin.storage
            .from(bucket)
            .remove([filePath]);

          if (storageError) {
            safeLog.warn('GDPR delete: storage removal issue', storageError.message);
          } else {
            safeLog.audit('gdpr_storage_deleted', { userId, bucket });
          }
        }
      }

      // Delete student-specific tables
      await admin.from('student_profiles').delete().eq('user_id', userId);
    }

    // 5. If vendor â delete vendor_profiles
    if (userRole === 'vendor') {
      // Offers, stamps etc. will cascade if FK is ON DELETE CASCADE
      // Flash deals, redemptions linked to vendor also cascade
      await admin.from('vendor_profiles').delete().eq('user_id', userId);
    }

    // 6. Delete shared tables (cascade from profiles should handle most)
    await Promise.allSettled([
      admin.from('verification_attempts').delete().eq('user_id', userId),
      admin.from('redemptions').delete().eq('student_id', userId),
      admin.from('loyalty_cards').delete().eq('student_id', userId),
      admin.from('notifications').delete().eq('user_id', userId),
    ]);

    // 7. Delete the profile row
    await admin.from('profiles').delete().eq('id', userId);

    // 8. Delete the auth.users record (this is the nuclear step)
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      safeLog.error('GDPR delete: auth user deletion failed', deleteAuthError.message);
      return NextResponse.json(
        { error: 'Account deletion partially failed. Please contact support.' },
        { status: 500 }
      );
    }

    // 9. Write PII-free audit record
    await admin.from('deletion_audit').insert({
      role: userRole,
      reason: 'user_requested',
    });

    safeLog.audit('account_deleted', { role: userRole });

    return NextResponse.json({ success: true, message: 'Your account and all associated data have been permanently deleted.' });

  } catch (err) {
    safeLog.error('GDPR delete: unexpected error', (err as Error).message);
    return NextResponse.json({ error: 'Unexpected error during deletion.' }, { status: 500 });
  }
}
