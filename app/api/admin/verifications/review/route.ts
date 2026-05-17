// =============================================================================
// DEPRECATED — use POST /api/admin/verify-student instead.
// This endpoint duplicated verify-student with a different field naming
// convention. Consolidated in May 2026. Returns 410 Gone.
// =============================================================================

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint has been removed. Use POST /api/admin/verify-student instead.' },
    { status: 410 }
  );
}
