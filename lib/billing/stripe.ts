// =============================================================================
// lib/billing/stripe.ts
//
// Lazily-created Stripe client. StudDeals runs as a demo without payments when
// STRIPE_SECRET_KEY is unset: getStripe() returns null, the billing routes
// answer 503 { demo: true }, and the billing page shows a disabled state.
// With the key set, the real Stripe code paths run unchanged.
// =============================================================================

import Stripe from 'stripe';
import { NextResponse } from 'next/server';

let client: Stripe | null = null;

export function isBillingEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) client = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  return client;
}

export function billingDisabledResponse() {
  return NextResponse.json(
    { error: 'Demo — payments are disabled on this deployment.', demo: true },
    { status: 503 }
  );
}
