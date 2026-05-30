/**
 * POST /api/vendor/flash-deal
 * Creates a flash deal and notifies eligible students.
 * Rate limited: vendors can send max 2 flash deals per 24 hours (free tier).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { safeLog } from '@/lib/utils/safe-logger';
import { haversineKm } from '@/lib/utils/distance';
import { z } from 'zod';
import { validationErrorResponse } from '@/lib/utils/validation';
import { getVendorPlan, hasAccess } from '@/lib/utils/plan-tier';

const FlashDealBodySchema = z.object({
  title: z.string().min(1, 'Title is required.').max(100, 'Title must be 100 characters or fewer.'),
  description: z.string().max(500, 'Description must be 500 characters or fewer.').optional(),
  discount_text: z.string().min(1, 'discount_text is required.').max(80, 'Discount text must be 80 characters or fewer.'),
  duration_minutes: z.number().int().min(15, 'Duration must be at least 15 minutes.').max(480, 'Duration cannot exceed 8 hours.').default(120),
  max_redemptions: z.number().int().min(1).max(1000).default(30),
  radius_km: z.number().min(0.1).max(50).default(2.0),
});

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const FREE_TIER_MAX_PER_DAY = 2;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { data: vendor, error: vendorError } = await supabase
      .from('vendor_profiles')
      .select('id, business_name, city, latitude, longitude, is_verified')
      .eq('user_id', user.id)
      .maybeSingle();

    if (vendorError || !vendor) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
    if (!vendor.is_verified) return NextResponse.json({ error: 'Your business must be verified to send flash deals' }, { status: 403 });

    // Plan gate: flash deals require Growth or Pro
    const plan = await getVendorPlan(supabase, user.id);
    if (!plan || !hasAccess(plan, 'growth')) {
      return NextResponse.json(
        { error: 'upgrade_required', message: 'Flash deals require a Growth or Pro plan.', tier: 'growth' },
        { status: 403 }
      );
    }

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: todayCount } = await supabase
      .from('flash_deals')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_id', vendor.id)
      .gte('created_at', yesterday);

    if ((todayCount ?? 0) >= FREE_TIER_MAX_PER_DAY) {
      return NextResponse.json(
        { error: `You can send up to ${FREE_TIER_MAX_PER_DAY} flash deals per 24 hours on the free plan.` },
        { status: 429 }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (_) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const parsedBody = FlashDealBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return validationErrorResponse(parsedBody.error);
    }

    const {
      title,
      description,
      discount_text,
      duration_minutes,
      max_redemptions,
      radius_km,
    } = parsedBody.data;

    const now = new Date();
    const endsAt = new Date(now.getTime() + duration_minutes * 60 * 1000);
    const admin = getAdminClient();

    const { data: flashDeal, error: insertError } = await admin
      .from('flash_deals')
      .insert({
        vendor_id: vendor.id,
        title,
        description: description ?? null,
        discount_text,
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        max_redemptions,
        radius_km,
        target_cities: [vendor.city].filter(Boolean),
        is_active: true,
      })
      .select()
      .maybeSingle();

    if (insertError || !flashDeal) {
      safeLog.error('flash-deal: insert failed', insertError?.message ?? 'unknown');
      return NextResponse.json({ error: 'Failed to create flash deal' }, { status: 500 });
    }

    let notifyCount = 0;

    if (vendor.latitude && vendor.longitude) {
      const { data: institutions } = await admin
        .from('institutions')
        .select('id, latitude, longitude')
        .not('latitude', 'is', null);

      const nearbyInstitutionIds = (institutions ?? [])
        .filter(inst => {
          if (!inst.latitude || !inst.longitude) return false;
          const km = haversineKm(vendor.latitude!, vendor.longitude!, inst.latitude, inst.longitude);
          return km <= radius_km;
        })
        .map(i => i.id);

      if (nearbyInstitutionIds.length > 0) {
        const { data: students } = await admin
          .from('student_profiles')
          .select('user_id')
          .in('institution_id', nearbyInstitutionIds)
          .eq('verification_status', 'verified');

        const userIds = (students ?? []).map(s => s.user_id);
        notifyCount = userIds.length;

        if (userIds.length > 0) {
          const notifications = userIds.slice(0, 500).map(uid => ({
            user_id: uid,
            type: 'flash_deal',
            title: `⚡ Flash Deal: ${vendor.business_name ?? 'Nearby Business'}`,
            message: `${discount_text} — ends ${endsAt.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}`,
            action_url: `/flash/${flashDeal.id}`,
            expires_at: endsAt.toISOString(),
          }));
          await admin.from('notifications').insert(notifications);
          safeLog.audit('flash_deal_notifications_sent', { vendorId: vendor.id, notifyCount, flashDealId: flashDeal.id });
        }
      }
    } else {
      const { data: cityInstitutions } = await admin
        .from('institutions')
        .select('id')
        .ilike('city', vendor.city ?? '');

      if (cityInstitutions?.length) {
        const { data: students } = await admin
          .from('student_profiles')
          .select('user_id')
          .in('institution_id', cityInstitutions.map(i => i.id))
          .eq('verification_status', 'verified');

        const userIds = (students ?? []).map(s => s.user_id);
        notifyCount = userIds.length;

        if (userIds.length > 0) {
          const notifications = userIds.slice(0, 500).map(uid => ({
            user_id: uid,
            type: 'flash_deal',
            title: `⚡ Flash Deal: ${vendor.business_name ?? 'Nearby Business'}`,
            message: `${discount_text} — ends at ${endsAt.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}`,
            action_url: `/flash/${flashDeal.id}`,
            expires_at: endsAt.toISOString(),
          }));
          await admin.from('notifications').insert(notifications);
        }
      }
    }

    return NextResponse.json({
      success: true,
      flash_deal_id: flashDeal.id,
      ends_at: flashDeal.ends_at,
      students_notified: notifyCount,
      message: `Flash deal live! ${notifyCount} students notified.`,
    });

  } catch (err) {
    safeLog.error('flash-deal: unexpected error', (err as Error).message);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { data: vendor } = await supabase
      .from('vendor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

    const { data: deals } = await supabase
      .from('flash_deals')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({ deals: deals ?? [] });
  } catch (err) {
    safeLog.error('flash-deal GET: error', (err as Error).message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
