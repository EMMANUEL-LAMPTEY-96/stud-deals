// @ts-nocheck
// Pre-existing Supabase typed-client debt — suppressed until db types are regenerated.
// =============================================================================
// POST /api/verification/upload-id
//
// Handles student ID card photo uploads.
// Accepts: multipart/form-data with a single 'file' field (image or PDF).
//
// Flow:
//   1. Auth check
//   2. Validate file size (max 10MB)
//   3. Read actual bytes and verify against magic-byte signatures (VULN-04 fix)
//      — Never trust client-supplied file.type or file.name
//   4. Upload to Supabase Storage bucket 'student-ids' (must be PRIVATE bucket)
//      — Filename is a UUID, not derived from user input (VULN-04 fix)
//   5. Store the storage PATH (not a public URL) in student_profiles (VULN-03 fix)
//      — Admin viewers use the dedicated signed-URL endpoint to access files
//   6. Update student_profiles:
//      - verification_document_path = storage path (NOT a public URL)
//      - verification_status = 'pending_review'
//      - verification_method = 'id_upload'
//
// IMPORTANT: The 'student-ids' Supabase Storage bucket MUST be configured as
// PRIVATE (not public). Run migration 014_private_storage_bucket.sql to enforce
// this. Admin review pages must use /api/admin/signed-id-url to fetch a
// short-lived signed URL for display.
// =============================================================================

import { safeLog } from '@/lib/utils/safe-logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Magic-byte detection (VULN-04 fix) ──────────────────────────────────────
// Detect actual file type from content bytes, ignoring the client-supplied
// Content-Type header entirely.
interface MimeResult { mime: string; ext: string }

function detectMimeFromBytes(buf: Uint8Array): MimeResult | null {
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return { mime: 'image/png', ext: 'png' };
  }
  // WebP: RIFF????WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  // PDF: %PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return { mime: 'application/pdf', ext: 'pdf' };
  }
  // HEIC/HEIF: ftyp box at offset 4 with brand heic/heif/mif1/msf1
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
    if (['heic', 'heif', 'mif1', 'msf1'].includes(brand)) {
      return { mime: 'image/heic', ext: 'heic' };
    }
  }
  return null; // Unknown / unsupported
}

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']);

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

  // ── Size check (before reading full bytes) ────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({
      error: 'File too large. Maximum size is 10 MB.',
    }, { status: 400 });
  }

  // ── VULN-04 fix: Read actual bytes and check magic signature ─────────────
  // Never trust file.type (client-controlled). Inspect real file content.
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const detected = detectMimeFromBytes(buffer);
  if (!detected || !ALLOWED_MIMES.has(detected.mime)) {
    return NextResponse.json({
      error: 'Invalid file type. Please upload a JPEG, PNG, WEBP, HEIC image, or PDF.',
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

  // ── VULN-04 fix: UUID filename — never use user-supplied file.name ────────
  // VULN-03 fix: Store the path, not a public URL (bucket must be PRIVATE)
  const fileId   = randomUUID();
  const filePath = `${user.id}/${fileId}.${detected.ext}`;

  const { error: uploadError } = await admin.storage
    .from('student-ids')
    .upload(filePath, buffer, {
      contentType: detected.mime, // use server-detected MIME, not client-supplied
      upsert: false,              // never overwrite — each upload gets a new UUID
    });

  if (uploadError) {
    safeLog.error('ID upload error:', uploadError);
    return NextResponse.json({ error: 'Failed to upload file. Please try again.' }, { status: 500 });
  }

  // ── VULN-03 fix: Store the storage PATH, not a public URL ─────────────────
  // The 'student-ids' bucket is PRIVATE. Admin reviewers must call
  // POST /api/admin/signed-id-url to get a short-lived signed URL.
  const { error: updateError } = await admin
    .from('student_profiles')
    .update({
      verification_status: 'pending_review',
      verification_method: 'id_upload',
      verification_document_url: filePath,           // storage path, not public URL
      verification_notes: JSON.stringify({ submitted_at: new Date().toISOString() }),
    })
    .eq('id', sp.id);

  if (updateError) {
    safeLog.error('profile update error:', updateError);
    return NextResponse.json({ error: 'Upload succeeded but profile update failed.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'ID uploaded successfully. We\'ll review it within 24 hours.',
  });
}
