// =============================================================================
// POST /api/admin/vendor-plan — an admin changes a business's plan by hand.
//
// Online payments were removed on 2026-11-13: businesses email to upgrade and
// an admin sets the plan here (used by /admin/billing).
//
// Body: {
//   vendor_profile_id: uuid,
//   plan_tier:   'free' | 'growth' | 'pro',
//   plan_status: 'free' | 'trialing' | 'active' | 'past_due' | 'cancelled',
//   paid_until?: 'YYYY-MM-DD' | null,   // plan_expires_at (or trial end when trialing)
//   pause_extra_offers?: boolean,       // default true — on a downgrade, pause the
//                                       // newest active offers above the new limit
// }
//
// Admin + two-factor session required (middleware enforces aal2 on /api/admin/*).
// Writes go through the service-role client; every change is audit-logged and
// the business gets an in-app notification.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ACTIVE_OFFER_LIMIT } from '@/lib/utils/plan-tier';
import { safeLog } from '@/lib/utils/safe-logger';

const Body = z.object({
  vendor_profile_id:  z.string().uuid(),
  plan_tier:          z.enum(['free', 'growth', 'pro']),
  plan_status:        z.enum(['free', 'trialing', 'active', 'past_due', 'cancelled']),
  paid_until:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  pause_extra_offers: z.boolean().optional(),
});

const TIER_NAME: Record<string, string> = { free: 'Free', growth: 'Growth', pro: 'Pro' };

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (caller?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 });
    }
    const { vendor_profile_id, paid_until = null, pause_extra_offers = true } = parsed.data;
    let { plan_tier, plan_status } = parsed.data;

    // Keep tier and status consistent: Free tier ⇔ 'free' status.
    if (plan_tier === 'free') plan_status = 'free';
    if (plan_status === 'free') plan_tier = 'free';
    if (plan_status === 'trialing' && !paid_until) {
      return NextResponse.json({ error: 'A trial needs an end date.' }, { status: 400 });
    }
    if (paid_until && Number.isNaN(Date.parse(`${paid_until}T23:59:59Z`))) {
      return NextResponse.json({ error: 'Invalid date.' }, { status: 400 });
    }

    const { data: vp } = await admin
      .from('vendor_profiles')
      .select('id, user_id, business_name, plan_tier, plan_status, plan_started_at')
      .eq('id', vendor_profile_id)
      .maybeSingle();
    if (!vp) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const endOfDay = paid_until ? new Date(`${paid_until}T23:59:59Z`).toISOString() : null;
    const tierChanged = vp.plan_tier !== plan_tier;
    const nowIso = new Date().toISOString();

    const { error: updErr } = await admin
      .from('vendor_profiles')
      .update({
        plan_tier,
        plan_status,
        plan_started_at: plan_tier === 'free' ? null : (tierChanged || !vp.plan_started_at ? nowIso : vp.plan_started_at),
        plan_expires_at: plan_status === 'trialing' || plan_tier === 'free' ? null : endOfDay,
        trial_ends_at:   plan_status === 'trialing' ? endOfDay : null,
      })
      .eq('id', vp.id);
    if (updErr) {
      safeLog.error('[admin/vendor-plan] update failed', { code: updErr.code });
      return NextResponse.json({ error: 'Could not update the plan.' }, { status: 500 });
    }

    // On a downgrade, pause the newest active offers above the new limit.
    // (The database limit only applies when an offer is switched on.)
    const effectiveTier = plan_status === 'cancelled' ? 'free' : plan_tier;
    const limit = ACTIVE_OFFER_LIMIT[effectiveTier];
    let paused = 0;
    let overLimit = 0;
    if (limit !== null) {
      const { data: active } = await admin
        .from('offers')
        .select('id, expires_at')
        .eq('vendor_id', vp.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true });
      const live = (active ?? []).filter((o) => !o.expires_at || new Date(o.expires_at).getTime() > Date.now());
      const extra = live.slice(limit);
      overLimit = extra.length;
      if (extra.length && pause_extra_offers) {
        const { error: pauseErr } = await admin
          .from('offers')
          .update({ status: 'paused' })
          .in('id', extra.map((o) => o.id));
        if (!pauseErr) paused = extra.length;
      }
    }

    const planLabel = TIER_NAME[plan_tier];
    const statusText: Record<string, string> = {
      free:      'You are now on the Free plan.',
      trialing:  `Your ${planLabel} trial is active${paid_until ? ` until ${new Date(endOfDay!).toLocaleDateString('hu-HU')}` : ''}.`,
      active:    `Your ${planLabel} plan is active${paid_until ? ` until ${new Date(endOfDay!).toLocaleDateString('hu-HU')}` : ''}.`,
      past_due:  `Your ${planLabel} payment is overdue — please get in touch.`,
      cancelled: `Your ${planLabel} plan has been cancelled; Free plan limits now apply.`,
    };

    await admin.from('notifications').insert({
      user_id: vp.user_id,
      type: 'plan_changed',
      title: 'Your plan was updated',
      body: statusText[plan_status] + (paused ? ` ${paused} offer${paused === 1 ? ' was' : 's were'} paused to fit the plan's limit.` : ''),
      is_read: false,
      related_entity_type: 'vendor',
      related_entity_id: vp.id,
    });

    await admin.from('admin_audit_log').insert({
      admin_id:    user.id,
      action:      'vendor_plan_changed',
      entity_type: 'vendor_profile',
      entity_id:   vp.id,
      metadata:    {
        from: { plan_tier: vp.plan_tier, plan_status: vp.plan_status },
        to:   { plan_tier, plan_status, paid_until },
        offers_paused: paused,
      },
    });

    return NextResponse.json({
      success: true,
      plan_tier,
      plan_status,
      offers_paused: paused,
      offers_over_limit: overLimit - paused,
    });
  } catch (err) {
    safeLog.error('[admin/vendor-plan] unexpected error', { message: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
