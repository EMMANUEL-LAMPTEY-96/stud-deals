// =============================================================================
// POST /api/admin/verify-student
//
// Admin-only endpoint to approve or reject a student ID upload.
// Caller must have role = 'admin' in their profiles row.
//
// Body: { student_profile_id: string, action: 'approve' | 'reject', notes?: string }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check caller is admin
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { student_profile_id: string; action: 'approve' | 'reject'; notes?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { student_profile_id, action, notes } = body;
  if (!student_profile_id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'student_profile_id and action (approve|reject) are required' }, { status: 400 });
  }

  const newStatus = action === 'approve' ? 'verified' : 'rejected';

  const { error } = await admin
    .from('student_profiles')
    .update({
      verification_status: newStatus,
      verified_at: action === 'approve' ? new Date().toISOString() : null,
      verified_by: user.id,
      verification_notes: notes ?? (action === 'reject' ? 'ID rejected by admin' : null),
    })
    .eq('id', student_profile_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, new_status: newStatus });
}

// GET — list students pending review
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'pending_review';

  const { data, error } = await admin
    .from('student_profiles')
    .select(`
      id,
      user_id,
      verification_status,
      verification_document_url,
      verification_method,
      verification_notes,
      institution_name_manual,
      student_email,
      created_at,
      profile:profiles!user_id (
        first_name,
        last_name,
        display_name,
        avatar_url
      ),
      institution:institutions (
        name,
        short_name
      )
    `)
    .eq('verification_status', status)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ students: data ?? [] });
}
