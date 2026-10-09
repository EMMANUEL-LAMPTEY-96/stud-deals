// GET /api/billing/status — whether real payments are enabled on this deployment.

import { NextResponse } from 'next/server';
import { isBillingEnabled } from '@/lib/billing/stripe';

// Read the env at request time, not at build time.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ enabled: isBillingEnabled() });
}
