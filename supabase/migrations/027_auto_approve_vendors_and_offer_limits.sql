-- =============================================================================
-- 027 · New businesses go live without approval + per-plan offer limits
--     (owner's decisions, 2026-11-01)
--
-- 1. guard_vendor_profiles: a vendor's own INSERT now starts APPROVED
--    (is_verified = true, verified_at = now()). Before, it was forced to false,
--    which hid the business name from students and made its offers unclaimable.
--    Admins can still un-approve/reject (service role is not guarded), and a
--    vendor can still deactivate itself (is_verified can go true → false only).
--
-- 2. enforce_offer_plan_limit: caps ACTIVE, unexpired offers per vendor, using
--    the plans sold on /vendor/billing:  Free = 1 · Growth = 10 · Pro = unlimited.
--    Effective plan mirrors lib/utils/plan-tier.ts hasAccess(): status
--    'cancelled' or 'free' → Free limits; trialing / active / past_due → plan_tier.
--    Legacy 'starter' counts as Growth. Only checked when an offer BECOMES active
--    (insert as active, or status changes to active), so existing offers are never
--    switched off. Admin/service-role writes are not limited.
-- =============================================================================

-- ── 1 · auto-approve on signup ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_vendor_profiles()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_verified := true; NEW.verified_at := now();          -- live immediately (no approval step)
      NEW.plan_tier := 'free'; NEW.plan_status := 'free';
      NEW.plan_started_at := NULL; NEW.plan_expires_at := NULL; NEW.trial_ends_at := NULL; NEW.stripe_customer_id := NULL;
      NEW.stripe_subscription_id := NULL; NEW.rejection_notes := NULL; NEW.total_lifetime_redemptions := 0; NEW.total_lifetime_views := 0;
    ELSE
      NEW.is_verified := OLD.is_verified AND NEW.is_verified; NEW.verified_at := OLD.verified_at;
      NEW.plan_tier := OLD.plan_tier; NEW.plan_status := OLD.plan_status; NEW.plan_started_at := OLD.plan_started_at;
      NEW.plan_expires_at := OLD.plan_expires_at; NEW.trial_ends_at := OLD.trial_ends_at; NEW.stripe_customer_id := OLD.stripe_customer_id;
      NEW.stripe_subscription_id := OLD.stripe_subscription_id; NEW.rejection_notes := OLD.rejection_notes;
      NEW.total_lifetime_redemptions := OLD.total_lifetime_redemptions; NEW.total_lifetime_views := OLD.total_lifetime_views; NEW.user_id := OLD.user_id;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

COMMENT ON COLUMN public.vendor_profiles.plan_tier IS
  'Monetisation gate (see /vendor/billing). Active-offer limits: free = 1, growth = 10 (legacy starter = growth), pro = unlimited. Enforced by enforce_offer_plan_limit (migration 027).';

-- ── 2 · per-plan active-offer limit ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_offer_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
-- Runs as the caller (no SECURITY DEFINER): current_user must stay 'authenticated'
-- for the check below, and vendors can already read their own offers and plan.
SET search_path TO ''
AS $function$
DECLARE
  v_tier   text;
  v_status text;
  v_limit  int;
  v_active int;
  v_name   text;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN RETURN NEW; END IF;   -- admin / service role
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active'
     AND (OLD.expires_at IS NULL OR OLD.expires_at > now()) THEN RETURN NEW; END IF;  -- already counted
  IF NEW.expires_at IS NOT NULL AND NEW.expires_at <= now() THEN RETURN NEW; END IF;

  SELECT vp.plan_tier::text, vp.plan_status INTO v_tier, v_status
  FROM public.vendor_profiles vp WHERE vp.id = NEW.vendor_id;

  IF v_status IN ('cancelled', 'free') OR v_tier IS NULL THEN v_tier := 'free'; END IF;
  v_limit := CASE v_tier WHEN 'pro' THEN NULL WHEN 'growth' THEN 10 WHEN 'starter' THEN 10 ELSE 1 END;
  IF v_limit IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_active FROM public.offers o
  WHERE o.vendor_id = NEW.vendor_id AND o.status = 'active' AND o.id <> NEW.id
    AND (o.expires_at IS NULL OR o.expires_at > now());

  IF v_active >= v_limit THEN
    v_name := CASE v_tier WHEN 'growth' THEN 'Growth' WHEN 'starter' THEN 'Growth' ELSE 'Free' END;
    RAISE EXCEPTION 'Your % plan allows % active offer%. Pause another offer or upgrade your plan in Billing.',
      v_name, v_limit, CASE WHEN v_limit = 1 THEN '' ELSE 's' END
      USING ERRCODE = 'P0001', HINT = 'plan_limit';
  END IF;
  RETURN NEW;
END; $function$;

REVOKE ALL ON FUNCTION public.enforce_offer_plan_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_offer_plan_limit ON public.offers;
CREATE TRIGGER trg_enforce_offer_plan_limit
  BEFORE INSERT OR UPDATE OF status, expires_at ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_offer_plan_limit();
