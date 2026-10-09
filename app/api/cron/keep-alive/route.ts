// =============================================================================
// GET /api/cron/keep-alive
//
// Called once a day by Vercel Cron (vercel.json) so the free-tier Supabase
// project sees activity and isn't paused. Runs one cheap query.
//
// Auth: Vercel sends "Authorization: Bearer <CRON_SECRET>" when the
// CRON_SECRET env var is set. Without a configured secret the route refuses
// every request.
// =============================================================================

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { safeLog } from '@/lib/utils/safe-logger';

export const dynamic = 'force-dynamic';

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('institutions').select('id').limit(1);
  if (error) {
    safeLog.error('[cron/keep-alive] query failed', error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
