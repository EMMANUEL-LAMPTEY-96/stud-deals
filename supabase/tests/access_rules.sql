-- =============================================================================
-- supabase/tests/access_rules.sql — repeatable access-rule (RLS + guard) tests
--
-- Run after any migration that touches policies or guard triggers:
--   paste into the Supabase SQL editor and run, or run via the Supabase MCP.
-- Everything happens inside one transaction that is ROLLED BACK — no data changes.
-- Uses the demo accounts from supabase/seed/demo_accounts.sql (stable IDs).
-- Expected result: every row says PASS.
-- =============================================================================
BEGIN;

CREATE TEMP TABLE t_results (n serial, test text, ok boolean, detail text) ON COMMIT DROP;
GRANT ALL ON t_results TO anon, authenticated;
GRANT USAGE ON SEQUENCE t_results_n_seq TO anon, authenticated;

-- Demo IDs
--   student user  de300000-0000-4000-a000-000000000012   student profile de300000-0000-4000-a000-000000000112
--   vendor user   de300000-0000-4000-a000-000000000002   vendor profile  de300000-0000-4000-a000-000000000201
--   offer         de300000-0000-4000-a000-000000000303

-- ── anonymous visitor ───────────────────────────────────────────────────────
SET LOCAL ROLE anon;
INSERT INTO t_results(test, ok, detail) SELECT 'anon cannot read profiles', count(*) = 0, count(*)::text FROM public.profiles;
INSERT INTO t_results(test, ok, detail) SELECT 'anon cannot read redemptions', count(*) = 0, count(*)::text FROM public.redemptions;
INSERT INTO t_results(test, ok, detail) SELECT 'anon can read listed cafés', count(*) > 0, count(*)::text FROM public.listed_cafes;
RESET ROLE;

-- ── student ─────────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims', '{"sub":"de300000-0000-4000-a000-000000000012","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

INSERT INTO t_results(test, ok, detail) SELECT 'student reads only own profile', count(*) = 1, count(*)::text FROM public.profiles;
INSERT INTO t_results(test, ok, detail) SELECT 'student reads only own student profile', count(*) = 1, count(*)::text FROM public.student_profiles;
INSERT INTO t_results(test, ok, detail) SELECT 'student sees active offers', count(*) > 0, count(*)::text FROM public.offers;
INSERT INTO t_results(test, ok, detail)
  SELECT 'student reads only own redemptions', bool_and(student_id = 'de300000-0000-4000-a000-000000000112'), count(*)::text FROM public.redemptions;

DO $$ BEGIN
  BEGIN
    INSERT INTO public.redemptions(offer_id, student_id, vendor_id, redemption_code, status, discount_value_applied)
    VALUES ('de300000-0000-4000-a000-000000000303','de300000-0000-4000-a000-000000000112','de300000-0000-4000-a000-000000000201','RLS-TEST-1','claimed',999999);
    INSERT INTO t_results(test, ok, detail) VALUES ('student cannot write redemptions', false, 'insert allowed');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO t_results(test, ok, detail) VALUES ('student cannot write redemptions', true, 'blocked');
  END;
  BEGIN
    INSERT INTO public.notifications(user_id, title, type) VALUES ('de300000-0000-4000-a000-000000000012','x','x');
    INSERT INTO t_results(test, ok, detail) VALUES ('student cannot create notifications', false, 'insert allowed');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO t_results(test, ok, detail) VALUES ('student cannot create notifications', true, 'blocked');
  END;
END $$;

UPDATE public.student_profiles SET verification_status = 'verified', total_savings_usd = 999999
  WHERE user_id = 'de300000-0000-4000-a000-000000000012';
UPDATE public.profiles SET role = 'admin' WHERE id = 'de300000-0000-4000-a000-000000000012';
INSERT INTO public.offer_views(offer_id, student_id, vendor_id, source)
  VALUES ('de300000-0000-4000-a000-000000000303','de300000-0000-4000-a000-000000000112', gen_random_uuid(), 'rls-test');
RESET ROLE;

INSERT INTO t_results(test, ok, detail)
  SELECT 'student cannot change own savings', total_savings_usd < 999999, total_savings_usd::text
  FROM public.student_profiles WHERE user_id = 'de300000-0000-4000-a000-000000000012';
INSERT INTO t_results(test, ok, detail)
  SELECT 'student cannot make self admin', role <> 'admin', role::text FROM public.profiles WHERE id = 'de300000-0000-4000-a000-000000000012';
INSERT INTO t_results(test, ok, detail)
  SELECT 'offer view credited to the offer''s vendor', vendor_id = 'de300000-0000-4000-a000-000000000201', vendor_id::text
  FROM public.offer_views WHERE source = 'rls-test';

-- ── vendor ──────────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims', '{"sub":"de300000-0000-4000-a000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

WITH u AS (UPDATE public.redemptions SET discount_value_applied = 1
           WHERE vendor_id = 'de300000-0000-4000-a000-000000000201' RETURNING 1)
INSERT INTO t_results(test, ok, detail) SELECT 'vendor cannot edit redemptions', count(*) = 0, count(*)::text || ' rows changed' FROM u;

UPDATE public.offers SET view_count = 999999, title = title WHERE id = 'de300000-0000-4000-a000-000000000303';
UPDATE public.vendor_profiles SET plan_tier = 'pro', is_verified = true WHERE user_id = 'de300000-0000-4000-a000-000000000002';
UPDATE public.vendor_reviews SET rating = 1, is_visible = false, vendor_reply = 'Thanks for visiting!'
  WHERE vendor_id = 'de300000-0000-4000-a000-000000000201';
WITH u AS (UPDATE public.offers SET title = title WHERE id = 'de300000-0000-4000-a000-000000000303' RETURNING 1)
INSERT INTO t_results(test, ok, detail) SELECT 'vendor can edit own offer', count(*) = 1, count(*)::text FROM u;
RESET ROLE;

INSERT INTO t_results(test, ok, detail)
  SELECT 'vendor cannot fake view count', view_count < 999999, view_count::text FROM public.offers WHERE id = 'de300000-0000-4000-a000-000000000303';
INSERT INTO t_results(test, ok, detail)
  SELECT 'vendor cannot upgrade own plan', plan_tier <> 'pro' OR plan_tier IS NULL, plan_tier::text
  FROM public.vendor_profiles WHERE user_id = 'de300000-0000-4000-a000-000000000002';
INSERT INTO t_results(test, ok, detail)
  SELECT 'vendor cannot change ratings or hide reviews', bool_and(rating > 1 AND is_visible), string_agg(rating::text, ',')
  FROM public.vendor_reviews WHERE vendor_id = 'de300000-0000-4000-a000-000000000201';
INSERT INTO t_results(test, ok, detail)
  SELECT 'vendor can reply to reviews', bool_or(vendor_reply = 'Thanks for visiting!'), count(*)::text
  FROM public.vendor_reviews WHERE vendor_id = 'de300000-0000-4000-a000-000000000201';

-- ── a student who has written a review (after the vendor replied above) ─────
SELECT set_config('request.jwt.claims', json_build_object('sub', sp.user_id, 'role', 'authenticated')::text, true)
  FROM public.vendor_reviews r JOIN public.student_profiles sp ON sp.id = r.student_id
  WHERE r.vendor_id = 'de300000-0000-4000-a000-000000000201' ORDER BY r.created_at LIMIT 1;
SET LOCAL ROLE authenticated;
UPDATE public.vendor_reviews SET vendor_reply = 'fake reply by student', rating = 3
  WHERE student_id IN (SELECT id FROM public.student_profiles WHERE user_id = (SELECT auth.uid()));
RESET ROLE;
INSERT INTO t_results(test, ok, detail)
  SELECT 'student cannot write vendor reply', count(*) = 0, count(*)::text FROM public.vendor_reviews WHERE vendor_reply = 'fake reply by student';
INSERT INTO t_results(test, ok, detail)
  SELECT 'student can edit own review rating', count(*) >= 1, count(*)::text FROM public.vendor_reviews WHERE rating = 3
  AND student_id IN (SELECT sp.id FROM public.student_profiles sp WHERE sp.user_id = (current_setting('request.jwt.claims')::json->>'sub')::uuid);

SELECT n, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, test, detail FROM t_results ORDER BY n;

ROLLBACK;
