// =============================================================================
// app/api/student/profile/route.ts
//
// GET  — returns the current student's profile + student_profile data
// POST — updates profile fields and/or user_metadata (consent, etc.)
//
// Body (POST):
//   {
//     first_name?: string
//     last_name?: string
//     display_name?: string
//     share_with_vendors?: boolean   // GDPR marketing consent
//   }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const { data: studentProfile } = await admin
    .from('student_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const share_with_vendors = user.user_metadata?.share_with_vendors !== false;

  return NextResponse.json({
    profile,
    student_profile: studentProfile,
    email: user.email,
    share_with_vendors,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const LAUNCH_CITIES = ['Budapest', 'Szeged'];

  let body: {
    first_name?: string;
    last_name?: string;
    display_name?: string;
    city?: string;
    share_with_vendors?: boolean;
  };

  try { body = await request.json(); } catch (_) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { first_name, last_name, display_name, city, share_with_vendors } = body;

  // Update profiles table
  const profileUpdates: Record<string, string | null> = {};
  if (first_name !== undefined) profileUpdates.first_name = first_name.trim() || null;
  if (last_name !== undefined)  profileUpdates.last_name  = last_name.trim()  || null;
  if (display_name !== undefined) {
    const fallback = first_name ? `${first_name} ${last_name ?? ''}`.trim() : '';
    profileUpdates.display_name = display_name.trim() || fallback;
  }
  if (city !== undefined && LAUNCH_CITIES.includes(city)) {
    profileUpdates.city = city;
  }

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await admin
      .from('profiles')
      .update({ ...profileUpdates, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update user_metadata for consent
  if (share_with_vendors !== undefined) {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        share_with_vendors,
      },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
