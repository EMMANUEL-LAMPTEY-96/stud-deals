# Product analytics — event taxonomy

StudDeals sends product events to **PostHog EU cloud** (`eu.i.posthog.com`). This page lists every
event, when it fires, its properties and the funnel step it measures.

- **Code:** event names are typed in [`lib/analytics/events.ts`](../../lib/analytics/events.ts). The
  client is [`lib/analytics/index.ts`](../../lib/analytics/index.ts), and consent plus identity are handled
  by [`components/shared/AnalyticsProvider.tsx`](../../components/shared/AnalyticsProvider.tsx).
- **Source of truth for counts:** the SQL views in the `analytics` schema
  ([dashboard.md](dashboard.md)). PostHog is for behaviour: paths, drop-off between screens and time to
  convert. Some PostHog events will be missing because of consent declines and ad blockers. The database
  sees every transaction.

## Consent, identity and privacy

| Rule | How |
|---|---|
| Off unless configured | Everything is a no-op when `NEXT_PUBLIC_POSTHOG_KEY` is unset. |
| GDPR opt-in | PostHog is initialised only after the visitor turns on analytics in the cookie banner ("Accept all", or the Analytics toggle → Save). Nothing is queued before that. Choosing "Essential only" means PostHog never loads. Browsers that send Do-Not-Track are respected. |
| Identity | `posthog.identify(profiles.id)`, which is the auth user id. Never an email or a name. |
| Person properties | `role` (student / vendor / admin), `is_demo`, `city`, `institution` (university name, for students). `role` and `is_demo` are also registered as super-properties on every event. |
| No autocapture | `autocapture` and session recording are off. Only the events below are sent, plus `$pageview` / `$pageleave` on route changes. |
| No PII in properties | Properties hold ids, categories, counts and flags. They never hold names, emails, voucher codes or free text. |
| Demo accounts | Tracked like everyone else, but tagged `is_demo = true`. Filter them out in PostHog with a cohort or a global filter on `is_demo != true`. |

### Client-side only, including "observed" milestones

All events are sent from the browser of the person they are about, so each one is covered by that
person's own consent. No server-side tracking means no consent gaps.

Some milestones are caused by someone else: an admin approves an ID, a vendor confirms a voucher, or a
referred friend makes their first claim. These are reported by the subject's browser **the next time they
open the app** (`trackOnce` in `AnalyticsProvider`):

- the event is back-dated to the database timestamp (`verified_at`, `confirmed_at`, …)
- it is deduplicated per browser with localStorage
- it gets a deterministic event `uuid`, so PostHog can drop copies sent from a second device (best effort)
- the lookback window is 90 days

These events are marked **observed** below.

## Student events

| Event | Trigger | Properties | Funnel step |
|---|---|---|---|
| `signup_started` | First focus on any field of the student sign-up form (`/sign-up/student`) | `role`, `has_referral_code` | Acquisition: 0. Form started |
| `signed_up` | `supabase.auth.signUp` succeeded on the student form. Also calls `identify` | `role`, `university_email`, `id_uploaded`, `has_referral_code` | Acquisition: 1. Signed up |
| `verification_started` | Student picks a method on `/verification` | `method` (`edu_email` \| `id_upload`) | Activation: 2a |
| `verification_submitted` | University email accepted and OTP sent, **or** ID photo uploaded for review | `method`, `institution_matched` (email only) | Activation: 2b |
| `verified` | OTP accepted (immediate), **or** observed: admin approved the ID (`student_profiles.verified_at`) | `method` | Activation: 2. Verified |
| `offer_viewed` | Offer detail page `/offer/[id]` loaded | `offer_id`, `vendor_id`, `category`, `discount_type`, `source` | Engagement |
| `offer_saved` | Offer bookmarked (offer page heart or offer card heart); not on un-save | `offer_id`, `vendor_id`, `category`, `discount_type`, `source` (`offer_page` \| `offer_card`) | Engagement |
| `voucher_claimed` | `POST /api/redemptions/claim` succeeded | `offer_id`, `vendor_id`, `category`, `discount_type`, `source` (`offer_page` \| `dashboard` \| `explore`) | Activation: 3. First claim |
| `voucher_redeemed` | **Observed:** the vendor confirmed the voucher (`redemptions.status = 'confirmed'`, back-dated to `confirmed_at`) | `offer_id`, `vendor_id`, `category`, `discount_value_huf` | Activation: 4. First redemption |
| `stamp_earned` | `POST /api/loyalty/stamp` succeeded (stamp landing page or in-app scanner) | `vendor_id`, `offer_id`, `loyalty_mode`, `stamps_awarded`, `stamps_in_cycle`, `required_visits`, `is_first_visit`, `double_stamp`, `source` (`stamp_page` \| `in_app_scanner`) | Retention: visit |
| `reward_earned` | The same stamp completed the card or reached a tier | `vendor_id`, `offer_id`, `loyalty_mode`, `reward_kind` (`card_complete` \| `tier`), `tier_rewards`, `source` | Retention: reward |
| `referral_link_shared` | Copy-link button, or the native share sheet completed on `/referral` | `method` (`copy_link` \| `web_share`) | Referral: invite |
| `referral_completed` | **Observed** by the referrer: a friend they referred made their first claim (`referrals.status = 'completed'`) | `side` (`referrer`) | Referral: conversion |

**Second visit:** a student's second `voucher_redeemed` or `stamp_earned` on a different day. Build it in
PostHog as a funnel step ("performed event ≥ 2 times"). In SQL it is the last step of
`analytics.funnel_students`.

## Vendor events

| Event | Trigger | Properties | Funnel step |
|---|---|---|---|
| `vendor_signed_up` | `supabase.auth.signUp` succeeded on `/sign-up/vendor`. Also calls `identify` | `business_category` | Vendor: 1. Signed up |
| `vendor_approved` | **Observed:** admin approved the business (`vendor_profiles.is_verified`, back-dated to `verified_at`) | — | Vendor: 2. Approved |
| `offer_created` | Offer inserted: create form, duplicate, or boost | `vendor_id`, `category`, `discount_type`, `status` (`active` \| `draft`), `source` (`create_form` \| `duplicate` \| `boost`); create form adds `mode`, `is_loyalty`; boost adds `boost_template`, `duration_hours` | Vendor: 3. First offer |
| `loyalty_program_created` | Create form saved with a loyalty mode (fires together with `offer_created`) | `offer_created` props + `required_visits`, `has_tiers`, `first_visit_bonus`, `stamp_expiry`, `double_stamp_windows` | Vendor: 3b. Loyalty live |
| `flash_deal_created` | `POST /api/vendor/flash-deal` succeeded | `duration_minutes`, `max_redemptions`, `radius_km`, `students_notified` | Vendor engagement |
| `plan_page_viewed` | `/vendor/billing` loaded | `current_tier`, `plan_status` | Monetisation: 1. Saw plans |
| `upgrade_clicked` | Subscribe button on a Growth/Pro plan card | `tier`, `billing_interval`, `current_tier`, `plan_status`, `payments_enabled` | Monetisation: 2. Upgrade intent |

> In the demo deployment (no Stripe key) the subscribe buttons are disabled, so `upgrade_clicked` only
> fires where billing is enabled.

## Suggested PostHog insights

1. **Student activation funnel:** `signed_up` → `verified` → `voucher_claimed` → `voucher_redeemed` →
   `voucher_redeemed` or `stamp_earned` (2nd time). Conversion window: 30 days. Break down by
   `institution`.
2. **Verification drop-off:** `verification_started` → `verification_submitted` → `verified`, broken down
   by `method`.
3. **Vendor activation:** `vendor_signed_up` → `vendor_approved` → `offer_created` → first
   redemption. The last step comes from SQL (`analytics.vendor_activation`), because redemptions happen in
   the student's session.
4. **Loyalty engagement:** weekly `stamp_earned` by `loyalty_mode`, and the ratio of `reward_earned` to
   `stamp_earned`.
5. **Monetisation intent:** `plan_page_viewed` → `upgrade_clicked`, broken down by `current_tier`.
6. **Referral loop:** `referral_link_shared` per active student, and `referral_completed` per share.

## Adding an event

1. Add the name to `lib/analytics/events.ts`. TypeScript then rejects unknown names.
2. Call `track('event_name', { ... })` after the action **succeeds**. Use `trackOnce` for state that
   another user changes.
3. Add a row to the table above.
