// =============================================================================
// app/api/billing/checkout/route.ts
//
// POST /api/billing/checkout
//
// Creates a Stripe Checkout session for the vendor to subscribe.
// Body: { priceId: string }  — the Stripe Price ID for Growth or Pro
//
// Returns: { url: string }  — the Checkout hosted page URL
// =============================================================================

import { safeLog } from '@/lib/utils/safe-logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-04-30.basil',
});

// Accept both NEXT_PUBLIC_ and server-only variants of price IDs so the same
// value works whether it was declared public (for the billing page client read)
// or private (server-only). In practice .env.local uses NEXT_PUBLIC_ names.
const ALLOWED_PRICE_IDS = new Set([
  process.env.STRIPE_GROWTH_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID,
  process.env.STRIPE_PRO_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
  process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_GROWTH_ANNUAL_PRICE_ID,
  process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID,
].filter(Boolean));

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { priceId } = body;

    if (!priceId || !ALLOWED_PRICE_IDS.has(priceId)) {
      return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 });
    }

    // Fetch vendor profile
    const adminSupabase = createAdminClient();
    const { data: vendor } = await adminSupabase
      .from('vendor_profiles')
      .select('id, stripe_customer_id, plan_tier')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
    }

    // Fetch email for Stripe customer creation
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle();

    // Reuse existing Stripe customer or create new one
    let stripeCustomerId = vendor.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.display_name ?? undefined,
        metadata: { vendor_id: vendor.id, user_id: user.id },
      });
      stripeCustomerId = customer.id;

      await adminSupabase
        .from('vendor_profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', vendor.id);
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://studeals.vercel.app';

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/vendor/billing?success=1`,
      cancel_url:  `${appUrl}/vendor/billing?cancelled=1`,
      metadata: { vendor_id: vendor.id, user_id: user.id },
      subscription_data: {
        metadata: { vendor_id: vendor.id, user_id: user.id },
        // Founding vendor: 25% off for life if still in trial
        ...(vendor.plan_tier === 'growth' || vendor.plan_tier === 'free'
          ? {}
          : {}),
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    safeLog.error('[billing/checkout]', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
