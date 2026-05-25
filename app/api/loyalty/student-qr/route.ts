// @ts-nocheck
// =============================================================================
// app/api/loyalty/student-qr/route.ts
//
// GET — Returns a time-limited signed QR payload for the authenticated student.
//
// The student's Loyalty page polls this every 60 seconds to get a fresh code.
// The QR encodes a STUDEALS_STAMP:v1:... payload that expires in 90 seconds.
// The vendor then scans this QR using their LoyaltyScanner (POST /api/loyalty/vendor-stamp).
//
// Why server-generated QR?
//   The HMAC secret never leaves the server — even if someone reads the client
//   bundle they cannot forge a valid payload. Expiry means screenshots can't be
//   shared between students to game stamps.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { generateStampPayload, STAMP_QR_TTL_SECONDS } from '@/lib/utils/stamp-qr';

export async function GET(_request: NextRequest) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Fetch student profile ───────────────────────────────────────────────
  const admin = createAdminClient();
  const { data: studentProfile } = await admin
    .from('student_profiles')
    .select('id, verification_status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!studentProfile) {
    return NextResponse.json(
      { error: 'Student profile not found. Complete your profile first.' },
      { status: 404 }
    );
  }

  // ── 3. Verified students only ─────────────────────────────────────────────
  if (studentProfile.verification_status !== 'verified') {
    return NextResponse.json(
      {
        error: 'Student verification required to earn stamps.',
        verification_status: studentProfile.verification_status,
        redirect_to: '/verification',
      },
      { status: 403 }
    );
  }

  // ── 4. Generate signed payload ────────────────────────────────────────────
  const { payload, expiresAt } = generateStampPayload(studentProfile.id);

  // Cache for half the TTL so clients don't get stale codes
  return NextResponse.json(
    {
      payload,
      expiresAt,       // Unix seconds
      ttl_seconds: STAMP_QR_TTL_SECONDS,
    },
    {
      headers: {
        'Cache-Control': `private, max-age=${Math.floor(STAMP_QR_TTL_SECONDS / 2)}`,
      },
    }
  );
}
