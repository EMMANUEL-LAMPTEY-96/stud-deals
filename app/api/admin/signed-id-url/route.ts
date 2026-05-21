// =============================================================================
// POST /api/admin/signed-id-url
//
// Returns a short-lived (60-second) signed URL for a student's uploaded ID
// document stored in the private 'student-ids' Supabase Storage bucket.
//
// This endpoint exists because the bucket was made PRIVATE (VULN-03 fix).
// Admins must call this endpoint to retrieve a temporary view URL, rather
// than accessing the raw storage path directly.
//
// Body: { student_profile_id: string }
// Response: { signed_url: string; expires_in: 60 }
//
// Auth: admin role required.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { safeLog } from '@/lib/utils/safe-logger';

const SIGNED_URL_EXPIRY_SECONDS = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // ── Admin-only ────────────────────────────────────────────────────────────
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { student_profile_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { student_profile_id } = body;
  if (!student_profile_id) {
    return NextResponse.json({ error: 'student_profile_id is required' }, { status: 400 });
  }

  // ── Fetch the stored file path from student_profiles ─────────────────────
  const { data: sp } = await admin
    .from('student_profiles')
    .select('verification_document_url')
    .eq('id', student_profile_id)
    .maybeSingle();

  if (!sp) {
    return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
  }

  const filePath = sp.verification_document_url;
  if (!filePath) {
    return NextResponse.json({ error: 'No document uploaded for this student' }, { status: 404 });
  }

  // ── Generate a short-lived signed URL ─────────────────────────────────────
  const { data: signedData, error: signError } = await admin.storage
    .from('student-ids')
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY_SECONDS);

  if (signError || !signedData?.signedUrl) {
    safeLog.error('[signed-id-url] createSignedUrl error:', signError);
    return NextResponse.json({ error: 'Failed to generate document URL' }, { status: 500 });
  }

  return NextResponse.json({
    signed_url: signedData.signedUrl,
    expires_in: SIGNED_URL_EXPIRY_SECONDS,
  });
}
