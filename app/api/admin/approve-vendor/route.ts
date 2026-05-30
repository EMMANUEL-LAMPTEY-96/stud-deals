// =============================================================================
// /api/admin/approve-vendor
//
// GET  — list vendor profiles filtered by approval status
//        ?status=pending|approved|rejected  (default: pending)
// POST — approve or reject a vendor
//        { vendor_profile_id, action: 'approve'|'reject', notes?: string }
//
// Protected: role = 'admin' required.
//
// Approval model:
//   is_verified = true  → approved, offers visible to students
//   is_verified = false + approved_status = 'rejected' → rejected
//   is_verified = false + no approved_status → pending
//
// Since vendor_profiles has no approval_status column we repurpose
// verification_document_url as a notes/status carrier using a JSON prefix:
//   "[[APPROVAL:{status,notes,reviewed_at,reviewed_by}]]...original_url"
// But simpler: we add the status to a JSON field in the existing
// 'description' column is risky. Instead, track via is_verified:
//   pending  → is_verified = false AND verified_at IS NULL
//   approved → is_verified = true
//   rejected → is_verified = false AND verified_at IS NOT NULL  (use verified_at as rejection marker)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

function getVendorStatus(vp: { is_verified: boolean; verified_at: string | null }): string {
  if (vp.is_verified) return 'approved';
  if (!vp.is_verified && vp.verified_at) return 'rejected'; // verified_at set but is_verified false = rejected
  return 'pending';
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status') ?? 'pending';
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const offset = (page - 1) * limit;

  // Build status filter in DB (not client-side) to get accurate pagination counts
  let vendorQuery = admin
    .from('vendor_profiles')
    .select(`
      id,
      user_id,
      business_name,
      business_type,
      description,
      city,
      business_email,
      business_phone,
      website_url,
      logo_url,
      is_verified,
      verified_at,
      rejection_notes,
      created_at,
      plan_tier,
      plan_status
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  // Filter in DB so pagination counts are accurate
  if (statusFilter === 'pending') {
    vendorQuery = vendorQuery.eq('is_verified', false).is('verified_at', null);
  } else if (statusFilter === 'approved') {
    vendorQuery = vendorQuery.eq('is_verified', true);
  } else if (statusFilter === 'rejected') {
    vendorQuery = vendorQuery.eq('is_verified', false).not('verified_at', 'is', null);
  }

  vendorQuery = vendorQuery.range(offset, offset + limit - 1);

  const { data: vendors, error, count: totalCount } = await vendorQuery;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get auth emails — single listUsers call instead of N getUserById calls
  const emailMap: Record<string, string> = {};
  try {
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap[u.id] = u.email;
    }
  } catch (_) { /* skip — emails fall back to null */ }

  // Get active offer counts per vendor (only fetch active status)
  const vpIds = (vendors ?? []).map((v) => v.id as string);
  const { data: activeOfferRows } = vpIds.length
    ? await admin.from('offers').select('vendor_id').eq('status', 'active').in('vendor_id', vpIds)
    : { data: [] };

  const offerCountMap: Record<string, number> = {};
  for (const o of activeOfferRows ?? []) {
    offerCountMap[o.vendor_id as string] = (offerCountMap[o.vendor_id as string] ?? 0) + 1;
  }

  const enriched = (vendors ?? []).map((vp) => ({
    ...vp,
    approval_status: getVendorStatus({ is_verified: vp.is_verified as boolean, verified_at: vp.verified_at as string | null }),
    email: emailMap[vp.user_id as string] ?? null,
    active_offers: offerCountMap[vp.id as string] ?? 0,
  }));

  const total = totalCount ?? enriched.length;
  return NextResponse.json({ vendors: enriched, total, page, limit, total_pages: Math.ceil(total / limit) });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { vendor_profile_id: string; action: 'approve' | 'reject'; notes?: string };
  try { body = await request.json(); } catch (_) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { vendor_profile_id, action, notes } = body;
  if (!vendor_profile_id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'vendor_profile_id and action are required' }, { status: 400 });
  }

  // On approval start a 60-day Growth trial automatically
  const trialEndsAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const update =
    action === 'approve'
      ? {
          is_verified:     true,
          verified_at:     new Date().toISOString(),
          plan_tier:       'growth',
          plan_status:     'trialing',
          trial_ends_at:   trialEndsAt,
          rejection_notes: null, // clear any previous rejection notes on approval
        }
      : {
          is_verified:     false,
          verified_at:     new Date().toISOString(),
          rejection_notes: notes ?? null, // persist rejection reason for next review
        };

  const { error } = await admin
    .from('vendor_profiles')
    .update(update)
    .eq('id', vendor_profile_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send in-app notification to vendor
  const { data: vp } = await admin
    .from('vendor_profiles')
    .select('user_id, business_name')
    .eq('id', vendor_profile_id)
    .maybeSingle();

  if (vp) {
    await admin.from('notifications').insert({
      user_id: vp.user_id,
      title: action === 'approve'
        ? `${vp.business_name}: Application approved!`
        : `${vp.business_name}: Application update`,
      body: action === 'approve'
        ? 'Your business has been approved on Stud Deals. Your offers are now visible to students!'
        : `Your application needs attention. ${notes ?? 'Please review your business details and resubmit.'}`,
      type: action === 'approve' ? 'vendor_approved' : 'vendor_rejected',
      is_read: false,
      data: JSON.stringify({ vendor_profile_id, action }),
    });
  }

  // ── Audit log ────────────────────────────────────────────────────────────
  await admin.from('admin_audit_log').insert({
    admin_id:    user.id,
    action:      action === 'approve' ? 'vendor_approved' : 'vendor_rejected',
    entity_type: 'vendor_profile',
    entity_id:   vendor_profile_id,
    metadata:    {
      ...(notes ? { notes } : {}),
      ...(action === 'approve' ? { plan_tier: 'growth', plan_status: 'trialing' } : {}),
    },
  });
  // Non-fatal — failure here should not block the response

  return NextResponse.json({ success: true, action });
}
