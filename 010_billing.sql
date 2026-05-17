-- =============================================================================
-- 010_billing.sql
--
-- Billing & subscription management for Unideals vendor accounts.
--
-- Tiers:
--   free    — 1 active offer, basic stamp card, no analytics
--   growth  — 10 active offers, full analytics, flash deals, staff PIN (13,990 HUF/mo)
--   pro     — unlimited offers, everything + priority placement (27,990 HUF/mo)
--
-- Status lifecycle:
--   trialing  → vendor is in the 60-day free rollout window
--   active    → paid subscription confirmed by Stripe webhook
--   past_due  → payment failed; grace period before downgrade
--   cancelled → subscription ended; downgraded to free
--   free      → explicitly on free tier (no trial, no sub)
--
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New query
-- =============================================================================

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS plan_tier    TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_tier IN ('free', 'growth', 'pro')),
  ADD COLUMN IF NOT EXISTS plan_status  TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_status IN ('trialing', 'active', 'past_due', 'cancelled', 'free')),
  ADD COLUMN IF NOT EXISTS trial_ends_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Unique index so we can look up vendors by Stripe IDs efficiently
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_profiles_stripe_customer
  ON vendor_profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_profiles_stripe_subscription
  ON vendor_profiles (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ── Founding vendor rollout ───────────────────────────────────────────────────
-- All existing (approved) vendors start on a 60-day Growth trial.
-- New vendors will have trial_ends_at set by the sign-up API.
UPDATE vendor_profiles
SET
  plan_tier    = 'growth',
  plan_status  = 'trialing',
  trial_ends_at = NOW() + INTERVAL '60 days'
WHERE is_verified = true
  AND plan_status = 'free';
