// =============================================================================
// app/api/billing/webhook/route.ts
//
// POST /api/billing/webhook
//
// Stripe webhook handler. Verifies the Stripe-Signature header then updates
// vendor plan_tier and plan_status in response to subscription lifecycle events.
//
// Events handled:
//   checkout.session.completed       → subscription created, mark active
//   customer.subscription.updated    → plan changed or status updated
//   customer.subscription.deleted    → cancelled → downgrade to free
//   invoice.payment_succeeded        → ensure status = active
//   invoice.payment_failed           → mark past_due
//
// IMPORTANT: This route must NOT parse the body as JSON — Stripe needs the
// raw body bytes to verify the webhook signature. Next.js App Router sends
// raw bytes when you call request.text() or request.arrayBuffer().
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';
import type { PlanTier, PlanStatus } from '@/lib/utils/plan-tier';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-04-30.basil',
});

// Map Stripe subscription status → our plan_status
function mapStripeStatus(stripeStatus: string): PlanStatus {
  switch (stripeStatus) {
    case 'active':   return 'active';
    case 'trialing': return 'trialing';
    case 'past_due': return 'past_due';
    case 'canceled':
    case 'cancelled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'cancelled';
    default:         return 'past_due';
  }
}

// Map Stripe Price ID → our plan_tier
function tierFromPriceId(priceId: string): PlanTier {
  if (
    priceId === process.env.STRIPE_PRO_PRICE_ID ||
    priceId === process.env.STRIPE_PRO_ANNUAL_PRICE_ID
  ) return 'pro';

  if (
    priceId === process.env.STRIPE_GROWTH_PRICE_ID ||
    priceId === process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID
  ) return 'growth';

  return 'free';
}

async function updateVendorPlan(
  vendorId: string,
  subscription: Stripe.Subscription
) {
  const adminSupabase = createAdminClient();
  const priceId = subscription.items.data[0]?.price?.id ?? '';
  const tier    = tierFromPriceId(priceId);
  const status  = mapStripeStatus(subscription.status);

  // Cast required: plan_status, stripe_subscription_id, trial_ends_at added in
  // migration 010_billing after last type regeneration. Safe — columns exist in DB.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminSupabase.from('vendor_profiles') as any)
    .update({
      plan_tier:              tier,
      plan_status:            status,
      stripe_subscription_id: subscription.id,
      // Clear trial when real subscription is active
      ...(status === 'active' ? { trial_ends_at: null } : {}),
    })
    .eq('stripe_customer_id', subscription.customer as string);
}

async function downgradeToFree(customerId: string) {
  const adminSupabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminSupabase.from('vendor_profiles') as any)
    .update({
      plan_tier:              'free',
      plan_status:            'cancelled',
      stripe_subscription_id: null,
      trial_ends_at:          null,
    })
    .eq('stripe_customer_id', customerId);
}

export async function POST(request: NextRequest) {
  const body      = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';
  const secret    = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.CheckoutSession;
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          await updateVendorPlan(
            session.metadata?.vendor_id ?? '',
            sub
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await updateVendorPlan('', sub);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await downgradeToFree(sub.customer as string);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          );
          await updateVendorPlan('', sub);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const adminSupabase = createAdminClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminSupabase.from('vendor_profiles') as any)
          .update({ plan_status: 'past_due' })
          .eq('stripe_customer_id', invoice.customer as string);
        break;
      }

      default:
        // Unhandled event types — safe to ignore
        break;
    }
  } catch (err) {
    console.error(`[webhook] Error handling ${event.type}:`, err);
    // Return 200 so Stripe doesn't retry — log and investigate separately
    return NextResponse.json({ received: true, error: String(err) });
  }

  return NextResponse.json({ received: true });
}
