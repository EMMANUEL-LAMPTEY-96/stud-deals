// =============================================================================
// GET  /api/staff/rewards        — pending loyalty rewards for the staff's shop
// POST /api/staff/rewards { id } — mark a pending reward as handed over
//
// Auth: staff_session cookie (see lib/utils/staff-session.ts). All reads and
// writes are scoped to the session's vendor.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getStaffSession } from '@/lib/utils/staff-session';
import { REWARD_STATUSES, markRewardHandedOver } from '@/lib/utils/reward-claim';

export async function GET(request: NextRequest) {
  const session = await getStaffSession(request);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const admin = createAdminClient();
  const { data: redsRaw } = await admin
    .from('redemptions')
    .select('id, status, created_at, offer_id, student_id')
    .eq('vendor_id', session.vendorId)
    .in('status', REWARD_STATUSES)
    .is('metadata->reward_claimed_at', null)
    .order('created_at', { ascending: false })
    .limit(20);
  const reds = (redsRaw ?? []) as { id: string; status: string; created_at: string; offer_id: string; student_id: string }[];
  if (!reds.length) return NextResponse.json({ rewards: [] });

  const offerIds = [...new Set(reds.map((r) => r.offer_id))];
  const studentIds = [...new Set(reds.map((r) => r.student_id))];

  const [{ data: offersRaw }, { data: spRaw }] = await Promise.all([
    admin.from('offers').select('id, title, terms_and_conditions, discount_label').in('id', offerIds),
    admin.from('student_profiles').select('id, user_id').in('id', studentIds),
  ]);
  const offers = (offersRaw ?? []) as { id: string; title: string; terms_and_conditions: string | null; discount_label: string | null }[];
  const sps = (spRaw ?? []) as { id: string; user_id: string }[];

  const { data: profRaw } = sps.length
    ? await admin.from('profiles').select('id, first_name, display_name').in('id', sps.map((s) => s.user_id))
    : { data: [] };
  const profs = (profRaw ?? []) as { id: string; first_name: string | null; display_name: string | null }[];

  const nameByUser: Record<string, string> = {};
  profs.forEach((p) => { nameByUser[p.id] = p.first_name || p.display_name || 'Student'; });
  const nameByStudent: Record<string, string> = {};
  sps.forEach((s) => { nameByStudent[s.id] = nameByUser[s.user_id] ?? 'Student'; });
  const offerMap = Object.fromEntries(offers.map((o) => [o.id, o]));

  const rewards = reds.map((r) => {
    const offer = offerMap[r.offer_id];
    let rewardLabel = offer?.discount_label ?? 'Reward';
    try {
      const m = (offer?.terms_and_conditions ?? '').match(/^\[\[LOYALTY:({.*?})\]\]/s);
      if (m) rewardLabel = JSON.parse(m[1]).reward_label ?? rewardLabel;
    } catch (_) { /* keep default */ }
    return {
      id: r.id,
      student_name: nameByStudent[r.student_id] ?? 'Student',
      offer_title: offer?.title ?? 'Offer',
      reward_label: rewardLabel,
      status: r.status,
      created_at: r.created_at,
    };
  });

  return NextResponse.json({ rewards });
}

export async function POST(request: NextRequest) {
  const session = await getStaffSession(request);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: { id?: string };
  try { body = await request.json(); } catch (_) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const result = await markRewardHandedOver(createAdminClient(), session.vendorId, body.id, { staff_id: session.staffId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true });
}
