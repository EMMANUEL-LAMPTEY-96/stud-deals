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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

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
    .single();

  if (!existingProfile) {
    const meta = user.user_metadata;
    const userRole = (meta?.role as string) ?? 'student';
    const isEmailVerified =
      userRole === 'student' && meta?.verification_method === 'email_domain';

    // 1. Create the base profile
    await admin.from('profiles').insert({
      id: user.id,
      email: user.email!,
      full_name: (meta?.full_name as string) ?? '',
      role: userRole,
      verification_status: isEmailVerified ? 'verified' : 'pending',
    });

    // 2. Create role-specific profile
    if (userRole === 'student') {
      await admin.from('student_profiles').insert({ id: user.id });
    } else if (userRole === 'vendor') {
      await admin.from('vendor_profiles').insert({
        id: user.id,
        business_name: (meta?.business_name as string) ?? '',
        business_category: (meta?.business_category as string) ?? 'food_drink',
      });
    }
  }

  const role = existingProfile?.role ?? (user.user_metadata?.role as string) ?? 'student';
  const dashboardPath = role === 'vendor' ? '/vendor' : '/dashboard';

  return NextResponse.redirect(`${origin}${dashboardPath}`);
}
