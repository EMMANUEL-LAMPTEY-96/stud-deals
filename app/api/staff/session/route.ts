// GET /api/staff/session — current staff scan-mode session (from the HttpOnly cookie).

import { NextRequest, NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/utils/staff-session';

export async function GET(request: NextRequest) {
  const session = await getStaffSession(request);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  return NextResponse.json({ session });
}
