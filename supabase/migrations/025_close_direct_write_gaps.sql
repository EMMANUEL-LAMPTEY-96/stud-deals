-- =============================================================================
-- 025 · Close direct-write gaps + RLS hygiene  (2026-10-31)
--
-- Security
--  1. (Dropped: gating offers on vendor approval — owner's decision 2026-10-31.)
--  2. No user-session writes to redemptions. Claim/confirm/expire run through
--     the API with the service role after the route's checks. Before, a student
--     could insert a claim with any discount_value_applied / expires_at, and a
--     vendor could edit any column of its own redemptions.
--  3. guard_offers: vendors can't set view/redemption/save counters or move an
--     offer to another vendor.
--  4. guard_offer_views: vendor_id comes from the offer, so a view can't be
--     credited to a different vendor.
--  5. notifications: users can read, mark read and delete their own, not insert.
--  6. Dropped "service role manages referrals" (service role bypasses RLS).
--
-- Performance / advisor lints
--  - auth.uid() wrapped as (select auth.uid()) and policies scoped TO
--    authenticated (they never matched anon: auth.uid() is null).
--  - Indexes on the 9 unindexed foreign keys.
--  - Explicit deny policies on service-role-only tables.
-- =============================================================================

-- ── admin_audit_log ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can read audit log" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

-- ── flash_deals ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vendors_read_own_flash_deals ON public.flash_deals;
CREATE POLICY vendors_read_own_flash_deals ON public.flash_deals FOR SELECT TO authenticated
  USING (vendor_id IN (SELECT vp.id FROM public.vendor_profiles vp WHERE vp.user_id = (SELECT auth.uid())));

-- ── loyalty_cards ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS students_read_own_loyalty_cards ON public.loyalty_cards;
CREATE POLICY students_read_own_loyalty_cards ON public.loyalty_cards FOR SELECT TO authenticated
  USING (student_id IN (SELECT sp.id FROM public.student_profiles sp WHERE sp.user_id = (SELECT auth.uid())));

-- ── notifications ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── offer_views ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Students can log offer views" ON public.offer_views;
CREATE POLICY "Students can log offer views" ON public.offer_views FOR INSERT TO authenticated
  WITH CHECK (student_id IN (SELECT sp.id FROM public.student_profiles sp WHERE sp.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "Vendors can see views on their offers" ON public.offer_views;
CREATE POLICY "Vendors can see views on their offers" ON public.offer_views FOR SELECT TO authenticated
  USING (vendor_id IN (SELECT vp.id FROM public.vendor_profiles vp WHERE vp.user_id = (SELECT auth.uid())));

-- ── offers ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all offers" ON public.offers;
CREATE POLICY "Admins can view all offers" ON public.offers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));
DROP POLICY IF EXISTS "Vendors manage own offers" ON public.offers;
CREATE POLICY "Vendors manage own offers" ON public.offers FOR ALL TO authenticated
  USING      (vendor_id IN (SELECT vp.id FROM public.vendor_profiles vp WHERE vp.user_id = (SELECT auth.uid())))
  WITH CHECK (vendor_id IN (SELECT vp.id FROM public.vendor_profiles vp WHERE vp.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "Verified students can view active offers" ON public.offers;
CREATE POLICY "Verified students can view active offers" ON public.offers FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
    AND EXISTS (SELECT 1 FROM public.student_profiles sp
                WHERE sp.user_id = (SELECT auth.uid()) AND sp.verification_status = 'verified')
  );

-- ── platform_config ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS admins_can_read_config ON public.platform_config;
CREATE POLICY admins_can_read_config ON public.platform_config FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

-- ── profiles ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- ── redemptions: read-only for users ────────────────────────────────────────
DROP POLICY IF EXISTS "Students create own claims" ON public.redemptions;
DROP POLICY IF EXISTS "Vendors update own redemptions" ON public.redemptions;

-- ── referrals ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service role manages referrals" ON public.referrals;
DROP POLICY IF EXISTS "student can read own referral as referred" ON public.referrals;
CREATE POLICY "student can read own referral as referred" ON public.referrals FOR SELECT TO authenticated
  USING (referred_id IN (SELECT sp.id FROM public.student_profiles sp WHERE sp.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "student can read own referrals as referrer" ON public.referrals;
CREATE POLICY "student can read own referrals as referrer" ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id IN (SELECT sp.id FROM public.student_profiles sp WHERE sp.user_id = (SELECT auth.uid())));

-- ── saved_offers ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Students manage own saved offers" ON public.saved_offers;
CREATE POLICY "Students manage own saved offers" ON public.saved_offers FOR ALL TO authenticated
  USING      (student_id IN (SELECT sp.id FROM public.student_profiles sp WHERE sp.user_id = (SELECT auth.uid())))
  WITH CHECK (student_id IN (SELECT sp.id FROM public.student_profiles sp WHERE sp.user_id = (SELECT auth.uid())));

-- ── student_profiles / vendor_profiles ──────────────────────────────────────
DROP POLICY IF EXISTS "Students manage own student profile" ON public.student_profiles;
CREATE POLICY "Students manage own student profile" ON public.student_profiles FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Vendors manage own vendor profile" ON public.vendor_profiles;
CREATE POLICY "Vendors manage own vendor profile" ON public.vendor_profiles FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- ── vendor_reviews ("Students read all visible reviews" unchanged) ──────────
DROP POLICY IF EXISTS "Admin full access vendor_reviews" ON public.vendor_reviews;
CREATE POLICY "Admin full access vendor_reviews" ON public.vendor_reviews FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));
DROP POLICY IF EXISTS "Students read own reviews" ON public.vendor_reviews;
CREATE POLICY "Students read own reviews" ON public.vendor_reviews FOR SELECT TO authenticated
  USING (student_id IN (SELECT sp.id FROM public.student_profiles sp WHERE sp.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "Students update own reviews" ON public.vendor_reviews;
CREATE POLICY "Students update own reviews" ON public.vendor_reviews FOR UPDATE TO authenticated
  USING      (student_id IN (SELECT sp.id FROM public.student_profiles sp WHERE sp.user_id = (SELECT auth.uid())))
  WITH CHECK (student_id IN (SELECT sp.id FROM public.student_profiles sp WHERE sp.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "Vendors read own reviews" ON public.vendor_reviews;
CREATE POLICY "Vendors read own reviews" ON public.vendor_reviews FOR SELECT TO authenticated
  USING (vendor_id IN (SELECT vp.id FROM public.vendor_profiles vp WHERE vp.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "Vendors update own replies" ON public.vendor_reviews;
CREATE POLICY "Vendors update own replies" ON public.vendor_reviews FOR UPDATE TO authenticated
  USING      (vendor_id IN (SELECT vp.id FROM public.vendor_profiles vp WHERE vp.user_id = (SELECT auth.uid())))
  WITH CHECK (vendor_id IN (SELECT vp.id FROM public.vendor_profiles vp WHERE vp.user_id = (SELECT auth.uid())));

-- ── service-role-only tables: make the intent explicit ──────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['deletion_audit', 'staff_login_attempts', 'verification_attempts'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "No direct access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "No direct access" ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)', t);
  END LOOP;
END $$;

-- ── guard_offers ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_offers()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.view_count := 0; NEW.redemption_count := 0; NEW.save_count := 0; NEW.created_at := now();
    ELSE
      NEW.id := OLD.id; NEW.vendor_id := OLD.vendor_id; NEW.created_at := OLD.created_at;
      NEW.view_count := OLD.view_count; NEW.redemption_count := OLD.redemption_count; NEW.save_count := OLD.save_count;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_offers() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_guard_offers ON public.offers;
CREATE TRIGGER trg_guard_offers BEFORE INSERT OR UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.guard_offers();

-- ── guard_offer_views ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_offer_views()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    -- Runs as the student, so only offers the student can see resolve.
    SELECT o.vendor_id INTO NEW.vendor_id FROM public.offers o WHERE o.id = NEW.offer_id;
    IF NEW.vendor_id IS NULL THEN
      RAISE EXCEPTION 'offer not available' USING ERRCODE = '42501';
    END IF;
    NEW.viewed_at := now();
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_offer_views() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_guard_offer_views ON public.offer_views;
CREATE TRIGGER trg_guard_offer_views BEFORE INSERT ON public.offer_views
  FOR EACH ROW EXECUTE FUNCTION public.guard_offer_views();

-- ── indexes for unindexed foreign keys ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_offer_id            ON public.loyalty_cards (offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_views_student_id            ON public.offer_views (student_id);
CREATE INDEX IF NOT EXISTS idx_platform_config_updated_by        ON public.platform_config (updated_by);
CREATE INDEX IF NOT EXISTS idx_redemptions_confirmed_by          ON public.redemptions (confirmed_by_vendor_user_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_student_institution   ON public.redemptions (student_institution_id);
CREATE INDEX IF NOT EXISTS idx_referrals_reward_offer_id         ON public.referrals (reward_offer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_reward_vendor_id        ON public.referrals (reward_vendor_id);
CREATE INDEX IF NOT EXISTS idx_saved_offers_offer_id             ON public.saved_offers (offer_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_verified_by      ON public.student_profiles (verified_by);
