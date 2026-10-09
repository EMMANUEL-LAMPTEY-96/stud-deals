/**
 * DELETE /api/account/delete
 *
 * GDPR-compliant full account deletion.
 * Deletes: Storage ID documents, redemptions/stamps + offer views (as student
 * or vendor), student/vendor profile (cascading saved offers, reviews,
 * referrals, loyalty cards, offers, flash deals), verification attempts,
 * profile (cascading notifications) and finally the auth user.
 *
 * Requires: authenticated session + confirmation token in body.
 * Records a PII-free audit log entry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeLog } from '@/lib/utils/safe-logger';

// Supabase admin client uses SERVICE_ROLE to bypass RLS for cascade deletes
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { isDemoUser, demoForbiddenResponse } from '@/lib/utils/demo';

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

    // Public demo accounts can't be deleted (their password is published).
    if (await isDemoUser(userId)) return demoForbiddenResponse('be deleted');
    const admin = getAdminClient();

    // Every step must succeed before the auth user is removed — otherwise we'd
    // report success while leaving personal data behind.
    const failures: string[] = [];
    const check = (step: string, res: { error: { message: string } | null }) => {
      if (res.error) failures.push(`${step}: ${res.error.message}`);
    };

    // 3. Fetch the user's role
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const userRole = profile?.role ?? 'unknown';

    // 4. Student data. redemptions.student_id and offer_views.student_id
    //    reference student_profiles.id (NOT auth user id) with no cascade, so
    //    they must go before the student profile. saved_offers, vendor_reviews,
    //    referrals and loyalty_cards cascade from student_profiles.
    const { data: studentProfile } = await admin
      .from('student_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (studentProfile) {
      // ID documents live in the private student-ids bucket under {userId}/
      const { data: files } = await admin.storage.from('student-ids').list(userId, { limit: 1000 });
      if (files?.length) {
        const { error: storageError } = await admin.storage
          .from('student-ids')
          .remove(files.map((f) => `${userId}/${f.name}`));
        if (storageError) failures.push(`storage: ${storageError.message}`);
        else safeLog.audit('gdpr_storage_deleted', { userId, bucket: 'student-ids', count: files.length });
      }

      check('redemptions', await admin.from('redemptions').delete().eq('student_id', studentProfile.id));
      check('offer_views', await admin.from('offer_views').delete().eq('student_id', studentProfile.id));
      if (!failures.length) {
        check('student_profiles', await admin.from('student_profiles').delete().eq('id', studentProfile.id));
      }
    }

    // 5. Vendor data. redemptions/offer_views reference vendor_profiles.id
    //    without cascade; offers, flash_deals, reviews and loyalty_cards cascade.
    const { data: vendorProfile } = await admin
      .from('vendor_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (vendorProfile && !failures.length) {
      check('vendor redemptions', await admin.from('redemptions').delete().eq('vendor_id', vendorProfile.id));
      check('vendor offer_views', await admin.from('offer_views').delete().eq('vendor_id', vendorProfile.id));
      if (!failures.length) {
        check('vendor_profiles', await admin.from('vendor_profiles').delete().eq('id', vendorProfile.id));
      }
    }

    // 6. Rows that reference the user's profile without cascade
    if (!failures.length) {
      check('confirmed_by', await admin.from('redemptions').update({ confirmed_by_vendor_user_id: null }).eq('confirmed_by_vendor_user_id', userId));
      check('verified_by', await admin.from('student_profiles').update({ verified_by: null }).eq('verified_by', userId));
      check('verification_attempts', await admin.from('verification_attempts').delete().eq('user_id', userId));
    }

    // 7. Delete the profile row (notifications cascade)
    if (!failures.length) {
      check('profiles', await admin.from('profiles').delete().eq('id', userId));
    }

    if (failures.length) {
      safeLog.error('GDPR delete: aborted before auth deletion', failures);
      return NextResponse.json(
        { error: 'Account deletion could not be completed. Please contact support.' },
        { status: 500 }
      );
    }

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
