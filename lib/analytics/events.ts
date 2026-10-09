// =============================================================================
// lib/analytics/events.ts — the product-analytics event taxonomy
//
// Every event the app sends to PostHog is listed here so names stay
// consistent. Documented (trigger, properties, funnel step) in
// docs/analytics/events.md — update both together.
// =============================================================================

export type StudentEvent =
  | 'signup_started'
  | 'signed_up'
  | 'verification_started'
  | 'verification_submitted'
  | 'verified'
  | 'offer_viewed'
  | 'offer_saved'
  | 'voucher_claimed'
  | 'voucher_redeemed'
  | 'stamp_earned'
  | 'reward_earned'
  | 'referral_link_shared'
  | 'referral_completed';

export type VendorEvent =
  | 'vendor_signed_up'
  | 'vendor_approved'
  | 'offer_created'
  | 'loyalty_program_created'
  | 'flash_deal_created'
  | 'plan_page_viewed'
  | 'upgrade_clicked';

export type AnalyticsEvent = StudentEvent | VendorEvent;

/** Event properties: flat, no PII (no names, emails, codes or free text). */
export type EventProperties = Record<string, string | number | boolean | null | undefined>;
