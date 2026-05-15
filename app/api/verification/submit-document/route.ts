// @ts-nocheck
// Pre-existing Supabase typed-client debt — suppressed until db types are regenerated.
// =============================================================================
// app/api/verification/submit-document/route.ts
// POST /api/verification/submit-document
//
// Called after the student uploads their student ID or enrollment certificate.
// Uploads the file to Supabase Storage → updates student_profiles with the
// document URL and sets verification_status to 'pending_review'.
//
// Auth: requires a signed-in student.
// Rate limit: 3 submissions per 24 hours.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/utils/rate-limit';
import { safeLog } from '@/lib/utils/safe-logger';

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
const BUCKET = 'student-ids';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Auth ──────────────────────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 });
    }

    // ── Rate limit: 3 submissions per 24 hrs ─────────────────────────────────
    const rl = await checkRateLimit(user.id, 'doc_submit', { maxAttempts: 3, windowHours: 24 });
    if (!rl.allowed) return rateLimitResponse(rl);

    // ── Parse multipart form data ─────────────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const institutionId = formData.get('institution_id') as string | null;
    const institutionNameManual = formData.get('institution_name') as string | null;
    const docType = (formData.get('doc_type') as string) ?? 'student_id';

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    // ── Validate file ─────────────────────────────────────────────────────────
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, WEBP, HEIC, or PDF files are accepted.' },
        { status: 400 }
      );
    }

    const sizeBytes = file.size;
    if (sizeBytes > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File must be under ${MAX_FILE_SIZE_MB} MB.` },
        { status: 400 }
      );
    }

    // ── Upload to Supabase Storage ────────────────────────────────────────────
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const timestamp = Date.now();
    const storagePath = `${user.id}/${docType}_${timestamp}.${ext}`;

    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      safeLog.error('[submit-document] Storage upload error', uploadError.message);
      return NextResponse.json(
        { error: 'File upload failed. Please try again.' },
        { status: 500 }
      );
    }

    // ── Get public URL (storage bucket should be private — use signed URL) ───
    const { data: signedUrlData } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year signed URL

    const documentUrl = signedUrlData?.signedUrl ?? storagePath; // fallback to path

    // ── Update student_profiles ───────────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      verification_status: 'pending_review',
      verification_method: 'id_upload',
      verification_document_url: storagePath, // store the path, not the signed URL
      verification_notes: `Document type: ${docType}. Submitted ${new Date().toISOString()}.`,
      updated_at: new Date().toISOString(),
    };

    if (institutionId) updatePayload.institution_id = institutionId;
    if (institutionNameManual) updatePayload.institution_name_manual = institutionNameManual;

    const { error: updateError } = await supabase
      .from('student_profiles')
      .update(updatePayload)
      .eq('user_id', user.id);

    if (updateError) {
      safeLog.error('[submit-document] DB update error', updateError.message);
      return NextResponse.json(
        { error: 'Failed to save verification request.' },
        { status: 500 }
      );
    }

    // ── Log to verification_attempts ─────────────────────────────────────────
    await supabase.from('verification_attempts').insert({
      user_id: user.id,
      attempt_type: 'id_upload',
      attempted_at: new Date().toISOString(),
      success: true,
      notes: `Uploaded ${docType} — ${storagePath}`,
    }).throwOnError().catch(() => {
      // Non-fatal if the table has different columns — best effort
    });

    safeLog.info('[submit-document] Document submitted for review', { userId: user.id });

    return NextResponse.json({
      success: true,
      message: "Your document has been submitted for review. We'll notify you within 1–2 business days.",
      document_url: documentUrl,
      status: 'pending_review',
    });
  } catch (err) {
    safeLog.error('[submit-document] Unexpected error', (err as Error).message);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
