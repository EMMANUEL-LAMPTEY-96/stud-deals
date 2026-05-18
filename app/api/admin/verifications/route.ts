// @ts-nocheck
// Pre-existing Supabase typed-client debt — suppressed until db types are regenerated.
// =============================================================================
// app/api/admin/verifications/route.ts
// GET /api/admin/verifications
//
// Returns paginated list of student verification submissions pending review.
// Admin only — checks profile.role === 'admin'.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeLog } from '@/lib/utils/safe-logger';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Auth + role check ─────────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // ── Query params ──────────────────────────────────────────────────────────
    const url = new URL(request.url);
    const status = url.searchParams.get('status') ?? 'pending_review';
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50);
    const offset = (page - 1) * limit;

    // ── Fetch student_profiles with related profile data ─────────────────────
    const { data: submissions, error, count } = await supabase
      .from('student_profiles')
      .select(`
        id,
        user_id,
        verification_status,
        verification_method,
        verification_document_url,
        verification_notes,
        institution_id,
        institution_name_manual,
        created_at,
        updated_at,
        profiles!inner (
          id,
          display_name,
          first_name,
          last_name
        ),
        institutions (
          id,
          name
        )
      `, { count: 'exact' })
      .eq('verification_status', status)
      .eq('verification_method', 'id_upload')
      .order('updated_at', { ascending: true }) // oldest first — FIFO review queue
      .range(offset, offset + limit - 1);

    if (error) {
      safeLog.error('[admin/verifications] DB query error', error.message);
      return NextResponse.json({ error: 'Failed to fetch submissions.' }, { status: 500 });
    }

    // ── Generate signed URLs for documents ────────────────────────────────────
    const enriched = await Promise.all(
      (submissions ?? []).map(async (s) => {
        let documentSignedUrl: string | null = null;

        if (s.verification_document_url) {
          const { data } = await supabase.storage
            .from('student-ids')
            .createSignedUrl(s.verification_document_url, 60 * 30); // 30 min
          documentSignedUrl = data?.signedUrl ?? null;
        }

        return {
          ...s,
          document_signed_url: documentSignedUrl,
        };
      })
    );

    return NextResponse.json({
      students: enriched,
      total: count ?? 0,
      page,
      limit,
      total_pages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    safeLog.error('[admin/verifications] Unexpected error', (err as Error).message);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
