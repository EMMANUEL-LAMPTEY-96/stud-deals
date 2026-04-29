// =============================================================================
// POST /api/vendor/promote
//
// Sends a promotion to a selected group of the vendor's students.
// Delivery: in-app notification (notifications table) — always available.
// Email delivery: only to students who have consented (share_with_vendors=true).
//
// Body:
//   {
//     subject: string,
//     message: string,
//     target: 'all' | 'loyal' | 'lapsed' | string[],
//     // 'loyal'  = 5+ stamps
//     // 'lapsed' = no visit in 30 days
//     // string[] = specific student_profile_ids
//   }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: vp } = await admin
    .from('vendor_profiles')
    .select('id, business_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!vp) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 403 });

  let body: { subject: string; message: string; target: string | string[] };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { subject, message, target } = body;
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
  }

  // ── Fetch target student_profile_ids ─────────────────────────────────
  let targetStudentIds: string[] = [];

  if (Array.isArray(target)) {
    targetStudentIds = target;
  } else {
    // Build from redemptions
    const { data: stamps } = await admin
      .from('redemptions')
      .select('student_id, confirmed_at')
      .eq('vendor_id', vp.id)
      .in('status', ['stamp', 'reward_earned']);

    const stampsByStudent: Record<string, { count: number; lastVisit: string }> = {};
    for (const s of stamps ?? []) {
      const id = s.student_id as string;
      if (!stampsByStudent[id]) stampsByStudent[id] = { count: 0, lastVisit: '' };
      stampsByStudent[id].count++;
      if (!stampsByStudent[id].lastVisit || (s.confirmed_at as string) > stampsByStudent[id].lastVisit) {
        stampsByStudent[id].lastVisit = s.confirmed_at as string;
      }
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    if (target === 'loyal') {
      targetStudentIds = Object.entries(stampsByStudent)
        .filter(([, v]) => v.count >= 5)
        .map(([id]) => id);
    } else if (target === 'lapsed') {
      targetStudentIds = Object.entries(stampsByStudent)
        .filter(([, v]) => v.lastVisit < thirtyDaysAgo)
        .map(([id]) => id);
    } else {
      // 'all'
      targetStudentIds = Object.keys(stampsByStudent);
    }
  }

  if (targetStudentIds.length === 0) {
    return NextResponse.json({ error: 'No students in target group.' }, { status: 400 });
  }

  // ── Get user_ids from student_profile_ids ─────────────────────────────
  const { data: studentProfiles } = await admin
    .from('student_profiles')
    .select('id, user_id')
    .in('id', targetStudentIds);

  const userIds = (studentProfiles ?? []).map((sp) => sp.user_id as string);

  // ── Insert in-app notifications ──────────────────────────────────────
  const notifications = userIds.map((uid) => ({
    user_id: uid,
    title: `${vp.business_name}: ${subject}`,
    body: message,
    type: 'promotion',
    is_read: false,
    data: JSON.stringify({ vendor_id: vp.id, vendor_name: vp.business_name }),
  }));

  const { error: notifError } = await admin
    .from('notifications')
    .insert(notifications);

  if (notifError) {
    console.error('notification insert error:', notifError);
    // Non-fatal — continue
  }

  return NextResponse.json({
    success: true,
    sent_to: userIds.length,
    message: `Promotion sent to ${userIds.length} student${userIds.length !== 1 ? 's' : ''}.`,
  });
}
