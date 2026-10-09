// =============================================================================
// lib/analytics/index.ts — PostHog product analytics (browser only)
//
//  - Optional: everything is a no-op when NEXT_PUBLIC_POSTHOG_KEY is unset.
//  - GDPR: PostHog is only initialised after the user opts in to analytics in
//    the cookie banner (AnalyticsProvider calls initAnalytics()). Before that,
//    track() drops events — nothing is queued or sent.
//  - Users are identified by their profile id (= auth user id) only. Person
//    properties: role, is_demo, city, institution. Never email or name.
//  - EU cloud (eu.i.posthog.com), so data stays in the EU.
// =============================================================================

import posthog from 'posthog-js';
import type { AnalyticsEvent, EventProperties } from './events';

export type { AnalyticsEvent, EventProperties } from './events';

const POSTHOG_KEY  = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';
const ONCE_PREFIX  = 'studeals_tracked:';

let initialised = false;

export function isAnalyticsConfigured(): boolean {
  return !!POSTHOG_KEY;
}

/** Starts PostHog. Call only after analytics consent. Returns true if running. */
export function initAnalytics(): boolean {
  if (initialised) {
    // Consent given again after a withdrawal in the same session
    if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing();
    return true;
  }
  if (!POSTHOG_KEY || typeof window === 'undefined') return false;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    ui_host: 'https://eu.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: 'history_change', // App Router client-side navigations
    capture_pageleave: true,
    // Only the explicit events in lib/analytics/events.ts — autocapture could
    // pick up names or codes rendered in buttons and links.
    autocapture: false,
    disable_session_recording: true,
    disable_surveys: true,
    respect_dnt: true,
  });
  initialised = true;
  return true;
}

/** Consent withdrawn: stop capturing and drop the PostHog identity. */
export function stopAnalytics() {
  if (!initialised) return;
  posthog.opt_out_capturing();
  posthog.reset();
}

export function track(
  event: AnalyticsEvent,
  properties?: EventProperties,
  options?: { timestamp?: Date; uuid?: string },
) {
  if (!initialised) return;
  posthog.capture(event, properties, options);
}

/** Deterministic UUID (v5 layout, SHA-1) for an event/entity pair. */
async function eventUuid(name: string): Promise<string | undefined> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return undefined;
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`studeals:${name}`)));
  const b = hash.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Tracks a milestone at most once for `key` (usually the row id it is about).
 *
 * Used for state changes made by someone else — an admin approves a vendor, a
 * vendor confirms a voucher — which the subject's own browser reports when it
 * next sees the new state, back-dated to when it happened. That keeps every
 * event under the subject's own consent, with no server-side tracking.
 *
 * Dedupe: localStorage per browser, plus a deterministic event uuid so PostHog
 * can drop copies sent from a second device (best effort).
 */
export async function trackOnce(
  key: string,
  event: AnalyticsEvent,
  properties?: EventProperties,
  happenedAt?: string | null,
) {
  if (!initialised) return;
  const storageKey = `${ONCE_PREFIX}${event}:${key}`;
  try {
    if (localStorage.getItem(storageKey)) return;
    localStorage.setItem(storageKey, '1');
  } catch {
    return; // no storage → can't dedupe, so don't risk double counting
  }
  track(event, properties, {
    timestamp: happenedAt ? new Date(happenedAt) : undefined,
    uuid: await eventUuid(`${event}:${key}`),
  });
}

export interface PersonProperties {
  role: string;
  is_demo: boolean;
  city: string | null;
  institution: string | null;
}

export function identify(profileId: string, person?: PersonProperties) {
  if (!initialised) return;
  posthog.identify(profileId, person);
  if (person) posthog.register({ role: person.role, is_demo: person.is_demo });
}

export function resetAnalytics() {
  if (!initialised) return;
  posthog.reset();
}

/** Standard properties for offer events (offer_viewed, offer_saved, voucher_claimed). */
export function offerProperties(offer: {
  id: string;
  vendor_id: string;
  category?: string | null;
  discount_type?: string | null;
}): EventProperties {
  return {
    offer_id: offer.id,
    vendor_id: offer.vendor_id,
    category: offer.category ?? null,
    discount_type: offer.discount_type ?? null,
  };
}

/** Shape of a successful POST /api/loyalty/stamp response (fields used here). */
interface StampResponse {
  offer_id?: string;
  loyalty_mode?: string;
  stamps_awarded?: number;
  stamps_in_cycle?: number;
  required_visits?: number;
  is_first_visit?: boolean;
  double_stamp?: boolean;
  reward_triggered?: boolean;
  main_reward_triggered?: boolean;
  tier_rewards?: unknown[];
}

/** stamp_earned, plus reward_earned when the stamp completed a card or reached a tier. */
export function trackStampResult(vendorId: string, result: StampResponse, source: string) {
  const base = { vendor_id: vendorId, offer_id: result.offer_id ?? null, loyalty_mode: result.loyalty_mode ?? null, source };
  track('stamp_earned', {
    ...base,
    stamps_awarded: result.stamps_awarded ?? 1,
    stamps_in_cycle: result.stamps_in_cycle ?? null,
    required_visits: result.required_visits ?? null,
    is_first_visit: result.is_first_visit ?? false,
    double_stamp: result.double_stamp ?? false,
  });
  if (result.reward_triggered) {
    track('reward_earned', {
      ...base,
      reward_kind: result.main_reward_triggered ? 'card_complete' : 'tier',
      tier_rewards: result.tier_rewards?.length ?? 0,
    });
  }
}
