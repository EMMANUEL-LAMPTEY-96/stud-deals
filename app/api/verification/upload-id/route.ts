// =============================================================================
// POST /api/verification/upload-id
//
// Handles student ID card photo uploads.
// Accepts: multipart/form-data with a single 'file' field (image).
//
// Flow:
//   1. Auth check
//   2. Validate file type (JPEG/PNG/WEBP/HEIC) and size (max 10MB)
//   3. Upload to Supabase Storage bucket 'student-ids'
//   4. Update student_profiles:
//      - verification_document_url = public URL
//      - verification_status = 'pending_review'
//      - verification_method = 'id_upload'
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (_) {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });

  // ── Validate ──────────────────────────────────────────────────────────────
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({
      error: 'Invalid file type. Please upload a JPEG, PNG, or WEBP image.',
    }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({
      error: 'File too large. Maximum size is 10 MB.',
    }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── Get student profile ───────────────────────────────────────────────────
  const { data: sp } = await admin
    .from('student_profiles')
    .select('id, verification_status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sp) return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 });
  if (sp.verification_status === 'verified') {
    return NextResponse.json({ error: 'Your account is already verified.' }, { status: 400 });
  }

  // ── Upload to Supabase Storage ────────────────────────────────────────────
  const ext = file.name.split('.').pop() ?? 'jpg';
  const filePath = `${user.id}/${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await admin.storage
    .from('student-ids')
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('ID upload error:', uploadError);
    return NextResponse.json({ error: 'Failed to upload file. Please try again.' }, { status: 500 });
  }

  // ── Get public URL ────────────────────────────────────────────────────────
  const { data: { publicUrl } } = admin.storage
    .from('student-ids')
    .getPublicUrl(filePath);

  // ── Update student profile ────────────────────────────────────────────────
  const { error: updateError } = await admin
    .from('student_profiles')
    .update({
      verification_status: 'pending_review',
      verification_method: 'id_upload',
      verification_document_url: publicUrl,
      verification_notes: JSON.stringify({ submitted_at: new Date().toISOString() }),
    })
    .eq('id', sp.id);

  if (updateError) {
    console.error('profile update error:', updateError);
    return NextResponse.json({ error: 'Upload succeeded but profile update failed.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    document_url: publicUrl,
    message: 'ID uploaded successfully. We\'ll review it within 24 hours.',
  });
}
