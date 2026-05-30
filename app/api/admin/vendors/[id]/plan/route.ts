// =============================================================================
// PATCH /api/admin/vendors/[id]/plan
//
// Allows admin to manually set a vendor's plan tier and status,
// and optionally extend / reset their trial.
//
// Body: { plan_tier: 'free'|'growth'|'pro', plan_status?: 'active'|'trialing'|'canceled', extend_trial_days?: number }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const VALID_TIERS   = ['free', 'growth', 'pro'] as const;
const VALID_STATUSES = ['active', 'trialing', 'canceled', 'past_due'] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: callerProfile } = await admin
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const vendorProfileId = params.id;

  let body: { plan_tier?: string; plan_status?: string; extend_trial_days?: number };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { plan_tier, plan_status, extend_trial_days } = body;

  if (plan_tier && !VALID_TIERS.includes(plan_tier as typeof VALID_TIERS[number])) {
    return NextResponse.json({ error: `plan_tier must be one of: ${VALID_TIERS.join(', ')}` }, { status: 400 });
  }
  if (plan_status && !VALID_STATUSES.includes(plan_status as typeof VALID_STATUSES[number])) {
    return NextResponse.json({ error: `plan_status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  // Read current values for audit log
  const { data: current } = await admin
    .from('vendor_profiles')
    .select('plan_tier, plan_status, trial_ends_at, business_name')
    .eq('id', vendorProfileId)
    .maybeSingle();

  if (!current) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (plan_tier)   update.plan_tier   = plan_tier;
  if (plan_status) update.plan_status = plan_status;

  if (extend_trial_days && extend_trial_days > 0) {
    const base = current.trial_ends_at
      ? new Date(current.trial_ends_at)
      : new Date();
    base.setDate(base.getDate() + extend_trial_days);
    update.trial_ends_at = base.toISOString();
    if (!plan_status) update.plan_status = 'trialing';
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { error } = await admin
    .from('vendor_profiles')
    .update(update)
    .eq('id', vendorProfileId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log
  await admin.from('admin_audit_log').insert({
    admin_id:    user.id,
    action:      'plan_updated',
    entity_type: 'vendor_profile',
    entity_id:   vendorProfileId,
    metadata: {
      business_name:    current.business_name,
      old_plan_tier:    current.plan_tier,
      new_plan_tier:    plan_tier ?? current.plan_tier,
      old_plan_status:  current.plan_status,
      new_plan_status:  plan_status ?? current.plan_status,
      ...(extend_trial_days ? { extended_trial_days: extend_trial_days } : {}),
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, updated: update });
}
