-- =============================================================================
-- Migration 015a: Profile guard triggers + stamp status enum fix
--
-- STATUS: Already applied to Supabase project mktqusaucpunasdnfulx
--         (schema_migrations version 20261005061729). Committed here for history.
--
-- PURPOSE:
--   * Block privilege escalation via direct profile writes from API roles
--     (role, is_active, verification, plan/billing and counter columns).
--   * Add the loyalty/stamp values used by the app to redemption_status.
--   * Pin search_path on SECURITY-sensitive functions; make analytics views
--     security_invoker so RLS applies.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guard_profiles()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated', 'service_role') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.role = 'admin' THEN NEW.role := 'student'; END IF;
      IF current_user <> 'service_role' THEN NEW.is_active := true; END IF;
    ELSE
      NEW.role := OLD.role;
      IF current_user <> 'service_role' THEN NEW.is_active := OLD.is_active; END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_guard_profiles BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles();

CREATE OR REPLACE FUNCTION public.guard_student_profiles()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verification_status := 'unverified'; NEW.verification_method := NULL; NEW.verification_document_url := NULL;
      NEW.verification_notes := NULL; NEW.verified_at := NULL; NEW.verified_by := NULL; NEW.verification_expires_at := NULL;
      NEW.student_email := NULL; NEW.total_savings_usd := 0; NEW.total_redemptions := 0; NEW.total_offers_saved := 0;
      NEW.referral_code := NULL; NEW.referred_by_id := NULL; NEW.birthday_bonus_claimed_year := NULL;
    ELSE
      NEW.verification_status := OLD.verification_status; NEW.verification_method := OLD.verification_method;
      NEW.verification_document_url := OLD.verification_document_url; NEW.verification_notes := OLD.verification_notes;
      NEW.verified_at := OLD.verified_at; NEW.verified_by := OLD.verified_by; NEW.verification_expires_at := OLD.verification_expires_at;
      NEW.student_email := OLD.student_email; NEW.total_savings_usd := OLD.total_savings_usd; NEW.total_redemptions := OLD.total_redemptions;
      NEW.total_offers_saved := OLD.total_offers_saved; NEW.referral_code := OLD.referral_code; NEW.referred_by_id := OLD.referred_by_id;
      NEW.birthday_bonus_claimed_year := OLD.birthday_bonus_claimed_year; NEW.user_id := OLD.user_id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_guard_student_profiles BEFORE INSERT OR UPDATE ON public.student_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_student_profiles();

CREATE OR REPLACE FUNCTION public.guard_vendor_profiles()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_verified := false; NEW.verified_at := NULL; NEW.plan_tier := 'free'; NEW.plan_status := 'free';
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
END; $$;
CREATE TRIGGER trg_guard_vendor_profiles BEFORE INSERT OR UPDATE ON public.vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_profiles();

ALTER TYPE public.redemption_status ADD VALUE IF NOT EXISTS 'stamp';
ALTER TYPE public.redemption_status ADD VALUE IF NOT EXISTS 'reward_earned';
ALTER TYPE public.redemption_status ADD VALUE IF NOT EXISTS 'tier_reward';
ALTER TYPE public.redemption_status ADD VALUE IF NOT EXISTS 'referral_bonus';
ALTER TYPE public.redemption_status ADD VALUE IF NOT EXISTS 'birthday_bonus';
ALTER TYPE public.redemption_status ADD VALUE IF NOT EXISTS 'admin_void';
ALTER TYPE public.redemption_status ADD VALUE IF NOT EXISTS 'voided';
ALTER TABLE public.redemptions ALTER COLUMN redemption_code TYPE varchar(64);
ALTER TABLE public.redemptions ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');
ALTER TABLE public.redemptions ADD COLUMN IF NOT EXISTS metadata jsonb;

ALTER FUNCTION public.handle_updated_at()              SET search_path = public;
ALTER FUNCTION public.handle_new_offer_view()          SET search_path = public;
ALTER FUNCTION public.handle_redemption_confirmed()    SET search_path = public;
ALTER FUNCTION public.populate_redemption_analytics()  SET search_path = public;
ALTER FUNCTION public.expire_stale_redemptions()       SET search_path = public;
ALTER FUNCTION public.handle_new_user()                SET search_path = public;
ALTER FUNCTION public.slugify(text)                    SET search_path = public, extensions;
ALTER FUNCTION public.generate_vendor_slug(text, uuid) SET search_path = public, extensions;
ALTER FUNCTION public.vendor_profile_set_slug()        SET search_path = public, extensions;

ALTER VIEW public.v_vendor_performance_summary SET (security_invoker = true);
ALTER VIEW public.v_redemptions_by_day_of_week SET (security_invoker = true);
ALTER VIEW public.v_redemptions_by_hour        SET (security_invoker = true);
ALTER VIEW public.v_monthly_redemption_trend   SET (security_invoker = true);
ALTER VIEW public.v_redemptions_by_institution SET (security_invoker = true);
