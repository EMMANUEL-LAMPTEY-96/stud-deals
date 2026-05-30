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

import { safeLog } from '@/lib/utils/safe-logger';
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
// VULN-16 fix: throw on unrecognised price IDs instead of silently falling back
// to 'free', which would incorrectly downgrade paying customers when env vars
// are missing or misconfigured. The caller (webhook handler) catches this,
// logs it, and returns HTTP 200 so Stripe doesn't retry — but the subscription
// row is NOT updated, protecting paying customers from silent downgrades.
function tierFromPriceId(priceId: string): PlanTier {
  if (!priceId) {
    safeLog.error('[webhook] tierFromPriceId called with empty or missing priceId');
    throw new Error('Missing or empty Stripe price ID — cannot determine plan tier');
  }

  // Match both NEXT_PUBLIC_ prefixed and server-only env var names so this
  // works regardless of how the price IDs were declared in .env.local.
  if (
    priceId === process.env.STRIPE_PRO_PRICE_ID ||
    priceId === process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ||
    priceId === process.env.STRIPE_PRO_ANNUAL_PRICE_ID ||
    priceId === process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID
  ) return 'pro';

  if (
    priceId === process.env.STRIPE_GROWTH_PRICE_ID ||
    priceId === process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID ||
    priceId === process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID ||
    priceId === process.env.NEXT_PUBLIC_STRIPE_GROWTH_ANNUAL_PRICE_ID
  ) return 'growth';

  // Unknown price ID — alert ops, do NOT silently downgrade to free
  safeLog.error(`[webhook] Unknown Stripe price ID: "${priceId}" — check STRIPE_*_PRICE_ID env vars`);
  throw new Error(`Unknown Stripe price ID: ${priceId}`);
}

async function updateVendorPlan(
  vendorId: string,
  subscription: Stripe.Subscription
) {
  const adminSupabase = createAdminClient();
  const priceId = subscription.items.data[0]?.price?.id ?? '';
  const tier    = tierFromPriceId(priceId);
  const status  = mapStripeStatus(subscription.status);

  await adminSupabase
    .from('vendor_profiles')
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
  await adminSupabase
    .from('vendor_profiles')
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
    safeLog.error('[webhook] Signature verification failed:', err);
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
        await adminSupabase
          .from('vendor_profiles')
          .update({ plan_status: 'past_due' })
          .eq('stripe_customer_id', invoice.customer as string);
        break;
      }

      default:
        // Unhandled event types — safe to ignore
        break;
    }
  } catch (err) {
    safeLog.error(`[webhook] Error handling ${event.type}:`, err);
    // VULN-15 fix: Return 200 so Stripe doesn't retry, but do NOT include
    // error details in the response body — they leak internal implementation details.
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
