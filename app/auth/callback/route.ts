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
  const next = searchParams.get('next') ?? '';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
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

    // 2. Create student sub-profile
    if (userRole === 'student') {
      const UNI_DOMAINS = [
        // Hungarian university domains
        '.hu',
        // International
        '.ac.uk', '.edu', '.edu.au', '.edu.ca', '.ac.nz', '.ac.za',
        '.edu.ng', '.ac.gh', '.edu.gh', '.ac.in', '.edu.sg', '.ac.jp', '.edu.hk',
      ];
      const email = user.email ?? '';
      const domain = email.toLowerCase().split('@')[1] ?? '';
      // .hu check: must look like a university (has edu/stud/hallgato prefix OR known patterns)
      const isHuniEmail = domain.endsWith('.hu') && (
        domain.includes('edu.') || domain.includes('stud.') ||
        domain.includes('hallgato.') || domain.includes('student.') ||
        domain.includes('caesar.') || domain.includes('unimail.')
      );
      const isOtherUniEmail = UNI_DOMAINS.filter(d => d !== '.hu').some(d => email.toLowerCase().endsWith(d));
      const isUniEmail = isHuniEmail || isOtherUniEmail;

      await admin.from('student_profiles').insert({
        user_id: user.id,
        verification_status: isUniEmail ? 'verified' : 'unverified',
        verification_method: isUniEmail ? 'edu_email' : null,
        verified_at: isUniEmail ? new Date().toISOString() : null,
        student_email: isUniEmail ? email : null,
      });
    }
    // vendor_profiles has required city — vendor fills this in profile settings
  }

  // Handle password reset flow
  if (next === '/reset-password') {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  const role = existingProfile?.role ?? (user.user_metadata?.role as string) ?? 'student';
  const dashboardPath = role === 'vendor' ? '/vendor' : '/dashboard';

  return NextResponse.redirect(`${origin}${dashboardPath}`);
}
