// POST /api/vendor/rewards/claim { id } — vendor owner marks a loyalty reward as handed over.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { markRewardHandedOver } from '@/lib/utils/reward-claim';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { id?: string };
  try { body = await request.json(); } catch (_) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const admin = createAdminClient();
  const { data: vp } = await admin.from('vendor_profiles').select('id').eq('user_id', user.id).maybeSingle();
  if (!vp) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 403 });

  const result = await markRewardHandedOver(admin, (vp as { id: string }).id, body.id, { user_id: user.id });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true, claimed_at: result.claimed_at });
}
