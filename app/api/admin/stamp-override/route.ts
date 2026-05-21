// @ts-nocheck
// =============================================================================
// POST /api/admin/stamp-override
//
// Manually credit or debit stamps on a specific student-vendor pairing.
// Each adjustment is a real row in the redemptions table (status = 'stamp' for
// credit, 'voided' for debit), so the student's punch card count stays accurate.
//
// Body:
//   {
//     student_id:  string,
//     vendor_id:   string,   // vendor_profile.id (= offer.vendor_id)
//     offer_id:    string,   // the punch-card offer to adjust
//     delta:       number,   // positive = add stamps, negative = remove (max ±20)
//     reason:      string    // mandatory explanation
//   }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: callerProfile } = await admin
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { student_id: string; vendor_id: string; offer_id: string; delta: number; reason: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { student_id, vendor_id, offer_id, delta, reason } = body;

  if (!student_id || !vendor_id || !offer_id) {
    return NextResponse.json({ error: 'student_id, vendor_id, and offer_id are required' }, { status: 400 });
  }
  if (!reason || reason.trim().length < 5) {
    return NextResponse.json({ error: 'A reason of at least 5 characters is required' }, { status: 400 });
  }
  if (!delta || delta === 0 || Math.abs(delta) > 20) {
    return NextResponse.json({ error: 'delta must be a non-zero integer between -20 and +20' }, { status: 400 });
  }

  const absDelta = Math.abs(delta);
  const isCredit = delta > 0;

  // For credits: insert N stamp rows
  // For debits:  insert N voided rows (negative stamps — deducted in count queries)
  const rows = Array.from({ length: absDelta }, () => ({
    student_id,
    vendor_id,
    offer_id,
    status: isCredit ? 'stamp' : 'admin_void',
    redemption_code: `ADMIN-${isCredit ? 'CREDIT' : 'DEBIT'}-${Date.now()}`,
    metadata: JSON.stringify({ admin_override: true, admin_id: user.id, reason }),
  }));

  const { error } = await admin.from('redemptions').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // In-app notification to student
  // VULN-08 fix: notifications.user_id expects profiles.id (auth UUID), NOT
  // student_profiles.id. Look up the auth user_id from student_profiles first.
  try {
    const [vpRes, spRes] = await Promise.all([
      admin.from('vendor_profiles').select('business_name').eq('id', vendor_id).maybeSingle(),
      admin.from('student_profiles').select('user_id').eq('id', student_id).maybeSingle(),
    ]);
    const vp = vpRes.data;
    const notifUserId = spRes.data?.user_id;

    if (!notifUserId) {
      // Student profile not found — skip notification but don't fail the request
      safeLog.error?.('[stamp-override] Could not resolve user_id for student_id:', student_id);
    } else {
    await admin.from('notifications').insert({
      user_id: notifUserId,  // auth UUID — correct mapping to profiles.id
      title:   isCredit
        ? `${absDelta} stamp${absDelta > 1 ? 's' : ''} added by platform`
        : `${absDelta} stamp${absDelta > 1 ? 's' : ''} removed by platform`,
      body: isCredit
        ? `${absDelta} stamp${absDelta > 1 ? 's' : ''} were added to your ${vp?.business_name ?? 'loyalty'} card. Reason: ${reason}`
        : `${absDelta} stamp${absDelta > 1 ? 's' : ''} were removed from your ${vp?.business_name ?? 'loyalty'} card. Reason: ${reason}`,
      type:    'stamp_override',
      is_read: false,
    });
    } // end if (notifUserId)
  } catch { /* non-fatal */ }

  // Audit log
  await admin.from('admin_audit_log').insert({
    admin_id:    user.id,
    action:      isCredit ? 'stamps_credited' : 'stamps_debited',
    entity_type: 'redemption',
    entity_id:   student_id,
    metadata:    { student_id, vendor_id, offer_id, delta, reason },
  }).catch(() => {});

  return NextResponse.json({ success: true, delta, rows_inserted: absDelta });
}
