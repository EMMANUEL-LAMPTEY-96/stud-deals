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

  // Fetch all vendors with profile data
  const { data: vendors, error } = await admin
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
      created_at
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get auth emails for vendors
  const emailMap: Record<string, string> = {};
  await Promise.all(
    (vendors ?? []).map(async (vp) => {
      try {
        const { data } = await admin.auth.admin.getUserById(vp.user_id as string);
        if (data.user?.email) emailMap[vp.user_id as string] = data.user.email;
      } catch (_) { /* skip */ }
    })
  );

  // Get active offer counts per vendor
  const vpIds = (vendors ?? []).map((v) => v.id as string);
  const { data: offers } = vpIds.length
    ? await admin.from('offers').select('vendor_id, status').in('vendor_id', vpIds)
    : { data: [] };

  const offerCountMap: Record<string, number> = {};
  for (const o of offers ?? []) {
    if (o.status === 'active') {
      offerCountMap[o.vendor_id as string] = (offerCountMap[o.vendor_id as string] ?? 0) + 1;
    }
  }

  // Filter by status
  const filtered = (vendors ?? [])
    .map((vp) => ({
      ...vp,
      approval_status: getVendorStatus({ is_verified: vp.is_verified as boolean, verified_at: vp.verified_at as string | null }),
      email: emailMap[vp.user_id as string] ?? null,
      active_offers: offerCountMap[vp.id as string] ?? 0,
    }))
    .filter((vp) => statusFilter === 'all' || vp.approval_status === statusFilter);

  return NextResponse.json({ vendors: filtered, total: filtered.length });
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

  const update =
    action === 'approve'
      ? { is_verified: true, verified_at: new Date().toISOString() }
      : { is_verified: false, verified_at: new Date().toISOString() }; // rejected: set verified_at but keep is_verified=false

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

  return NextResponse.json({ success: true, action });
}
