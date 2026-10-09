// =============================================================================
// app/auth/callback/route.ts
// Handles the email verification redirect from Supabase.
// After a user clicks the "Confirm your email" link in their inbox, Supabase
// redirects to this URL with a one-time code. We exchange it for a session,
// create the user's profile in the DB if it doesn't exist, then redirect to
// their role-appropriate dashboard.
// =============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { findInstitutionForEmail } from '@/lib/utils/institution-domain';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '';

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !user) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
  }

  // Use admin client to bypass RLS when creating the profile
  const admin = createAdminClient();

  // Check if profile already exists (e.g. user signed in a second time)
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  // Role comes from sign-up metadata, which the user controls — only ever
  // accept 'student' or 'vendor' from it (never 'admin').
  const metaRole = user.user_metadata?.role;
  const signupRole: 'student' | 'vendor' = metaRole === 'vendor' ? 'vendor' : 'student';

  if (!existingProfile) {
    const meta = user.user_metadata;
    const userRole = signupRole;

    // Split full_name into first/last — matches actual profiles schema
    const fullName = (meta?.full_name as string) ?? '';
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // 1. Create the base profile (correct column names from schema)
    await admin.from('profiles').insert({
      id: user.id,
      role: userRole,
      first_name: firstName || null,
      last_name: lastName || null,
      display_name: fullName || (user.email?.split('@')[0] ?? ''),
    });

    // 2. Create student sub-profile. The sign-up email has just been confirmed,
    //    so auto-verify only if its domain belongs to a known Hungarian
    //    institution (exact domain or subdomain — no substring matching).
    if (userRole === 'student') {
      const email = (user.email ?? '').toLowerCase();
      const institution = email && user.email_confirmed_at
        ? await findInstitutionForEmail(admin, email)
        : null;

      await admin.from('student_profiles').insert({
        user_id: user.id,
        verification_status: institution ? 'verified' : 'unverified',
        verification_method: institution ? 'edu_email' : null,
        verified_at: institution ? new Date().toISOString() : null,
        student_email: institution ? email : null,
        institution_id: institution?.id ?? null,
      });
    }
    // vendor_profiles has required city — vendor fills this in profile settings
  }

  // Handle password reset flow
  if (next === '/reset-password') {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  const role = existingProfile?.role ?? signupRole;
  const dashboardPath = role === 'vendor' ? '/vendor' : role === 'admin' ? '/admin' : '/dashboard';

  return NextResponse.redirect(`${origin}${dashboardPath}`);
}
