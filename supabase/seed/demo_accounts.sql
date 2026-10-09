-- =============================================================================
-- supabase/seed/demo_accounts.sql — portfolio demo data
--
-- Creates (or resets) the public demo accounts and their data. Safe to re-run:
-- it only deletes/rewrites rows where BOTH sides are demo accounts, so real
-- users' data is never touched. Run it from the Supabase SQL editor (as
-- postgres) after migration 020.
--
--   demo-student@studeals.demo  — verified ELTE student, Budapest
--   demo-vendor@studeals.demo   — verified café with 4 active offers + loyalty card
--   3 non-login demo customers  — give the vendor's analytics/customer list data
--
-- The login password is public on purpose (shown on the sign-in page via
-- NEXT_PUBLIC_DEMO_PASSWORD). Keep the two in sync if you change it.
-- =============================================================================

BEGIN;

-- ── Fixed IDs ────────────────────────────────────────────────────────────────
CREATE TEMP TABLE demo_users (id uuid, email text, full_name text, role public.user_role, loginable boolean) ON COMMIT DROP;
INSERT INTO demo_users VALUES
  ('de300000-0000-4000-a000-000000000001', 'demo-student@studeals.demo',    'Alex Demo',    'student', true),
  ('de300000-0000-4000-a000-000000000002', 'demo-vendor@studeals.demo',     'Demo Café',    'vendor',  true),
  ('de300000-0000-4000-a000-000000000011', 'demo-customer-1@studeals.demo', 'Bence Demo',   'student', false),
  ('de300000-0000-4000-a000-000000000012', 'demo-customer-2@studeals.demo', 'Csilla Demo',  'student', false),
  ('de300000-0000-4000-a000-000000000013', 'demo-customer-3@studeals.demo', 'Dóra Demo',    'student', false);

-- ── Auth users (+ email identities) ──────────────────────────────────────────
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
SELECT
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt(
    CASE WHEN u.loginable THEN 'StudealsDemo!2026' ELSE gen_random_uuid()::text END,
    extensions.gen_salt('bf')
  ),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name, 'role', u.role),
  now() - interval '45 days', now(),
  '', '', '', ''
FROM demo_users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
FROM demo_users u
WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email');

-- ── Profiles ─────────────────────────────────────────────────────────────────
INSERT INTO public.profiles (id, role, first_name, last_name, display_name, city, country, is_demo)
SELECT u.id, u.role, split_part(u.full_name, ' ', 1), split_part(u.full_name, ' ', 2), u.full_name, 'Budapest', 'Hungary', true
FROM demo_users u
ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role, display_name = EXCLUDED.display_name, is_demo = true, is_active = true;

INSERT INTO public.student_profiles (
  id, user_id, institution_id, student_email, graduation_year, major,
  verification_status, verification_method, verified_at, share_with_vendors
) VALUES
  ('de300000-0000-4000-a000-000000000101', 'de300000-0000-4000-a000-000000000001', 'b3a15d28-f3f7-44ac-ae8b-e5870d8484c0', 'demo-student@studeals.demo',    2027, 'Computer Science', 'verified', 'edu_email', now() - interval '40 days', true),
  ('de300000-0000-4000-a000-000000000111', 'de300000-0000-4000-a000-000000000011', 'b3a15d28-f3f7-44ac-ae8b-e5870d8484c0', 'demo-customer-1@studeals.demo', 2026, 'Economics',        'verified', 'edu_email', now() - interval '40 days', true),
  ('de300000-0000-4000-a000-000000000112', 'de300000-0000-4000-a000-000000000012', '465dc0e2-21cc-4674-bead-cd4a3de5d94f', 'demo-customer-2@studeals.demo', 2028, 'Architecture',     'verified', 'edu_email', now() - interval '40 days', true),
  ('de300000-0000-4000-a000-000000000113', 'de300000-0000-4000-a000-000000000013', '50a1fc24-68da-4e02-a7b1-bf197bbc8668', 'demo-customer-3@studeals.demo', 2027, 'Business',         'verified', 'edu_email', now() - interval '40 days', false)
ON CONFLICT (id) DO UPDATE SET
  verification_status = 'verified', verification_method = 'edu_email',
  share_with_vendors = EXCLUDED.share_with_vendors,
  total_redemptions = 0, total_savings_usd = 0;

INSERT INTO public.vendor_profiles (
  id, user_id, business_name, business_type, description, city, country,
  address_line1, postal_code, latitude, longitude, business_phone, business_email,
  is_verified, verified_at, plan_tier, plan_status, slug, logo_url
) VALUES (
  'de300000-0000-4000-a000-000000000201', 'de300000-0000-4000-a000-000000000002',
  'Demo Café', 'cafe',
  'A cosy campus café next to ELTE — specialty coffee, fresh pastries and a shelf of second-hand textbooks. (Demo business for the StudDeals portfolio.)',
  'Budapest', 'Hungary', 'Egyetem tér 5', '1053', 47.4905, 19.0587,
  '+36 1 000 0000', 'demo-vendor@studeals.demo',
  true, now() - interval '40 days', 'growth', 'active', 'demo-cafe', '/demo/demo-cafe-logo.svg'
)
ON CONFLICT (id) DO UPDATE SET
  is_verified = true, plan_tier = 'growth', plan_status = 'active',
  logo_url = EXCLUDED.logo_url,
  total_lifetime_redemptions = 0, total_lifetime_views = 0;

-- ── Offers ───────────────────────────────────────────────────────────────────
INSERT INTO public.offers (
  id, vendor_id, title, description, discount_label, discount_type, discount_value,
  min_purchase_amount, category, terms_and_conditions, status, starts_at, max_uses_per_student
) VALUES
  ('de300000-0000-4000-a000-000000000301', 'de300000-0000-4000-a000-000000000201',
   'Coffee loyalty card', 'Collect a stamp with every coffee — your 8th one is on us.',
   'Every 8th coffee free', 'free_item', NULL, NULL, 'food_drink',
   '[[LOYALTY:{"mode":"punch_card","required_visits":8,"reward_label":"Free coffee","reward_type":"free_item","first_visit_bonus":1}]]One stamp per visit. Scan the QR at the counter.',
   'active', now() - interval '35 days', 1),
  ('de300000-0000-4000-a000-000000000302', 'de300000-0000-4000-a000-000000000201',
   '20% off all pastries', 'Croissants, pogácsa and cakes — 20% off with your student voucher.',
   '20% off', 'percentage', 20, NULL, 'food_drink', 'One voucher per visit.',
   'active', now() - interval '35 days', 5),
  ('de300000-0000-4000-a000-000000000303', 'de300000-0000-4000-a000-000000000201',
   'Free cookie with any drink', 'Grab a free cookie when you buy any hot or cold drink.',
   'Free cookie', 'free_item', NULL, NULL, 'food_drink', 'While stocks last.',
   'active', now() - interval '20 days', 3),
  ('de300000-0000-4000-a000-000000000304', 'de300000-0000-4000-a000-000000000201',
   '1 500 Ft off second-hand textbooks', 'Spend 6 000 Ft or more on our textbook shelf and save 1 500 Ft.',
   '1 500 Ft off', 'fixed_amount', 1500, 6000, 'books_stationery', 'Minimum spend 6 000 Ft.',
   'active', now() - interval '10 days', 2)
ON CONFLICT (id) DO UPDATE SET
  status = 'active', view_count = 0, redemption_count = 0, save_count = 0,
  terms_and_conditions = EXCLUDED.terms_and_conditions;

-- A finished boost campaign, so the vendor's onboarding checklist ("Launch your
-- first boost") is complete and /vendor/boost has history. Kept 'expired' so it
-- never shows in the student feed.
INSERT INTO public.offers (
  id, vendor_id, title, description, discount_label, discount_type, discount_value,
  category, terms_and_conditions, status, starts_at, expires_at, created_at,
  view_count, redemption_count, save_count
) VALUES (
  'de300000-0000-4000-a000-000000000305', 'de300000-0000-4000-a000-000000000201',
  '⚡ Flash Sale — Demo Café', 'Limited-time boost: 20% OFF. Active for 4 hours.',
  '20% OFF', 'percentage', 20, 'food_drink',
  '[[BOOST:{"template":"flash_sale","discount_label":"20% OFF","custom_title":"⚡ Flash Sale — Demo Café","duration_hours":4,"audience":"all","created_at":"2026-01-01T10:00:00.000Z"}]]',
  'expired', now() - interval '12 days', now() - interval '12 days' + interval '4 hours', now() - interval '12 days',
  38, 0, 0
)
ON CONFLICT (id) DO UPDATE SET
  status = 'expired', terms_and_conditions = EXCLUDED.terms_and_conditions,
  starts_at = EXCLUDED.starts_at, expires_at = EXCLUDED.expires_at;

-- ── Reset demo-only activity ─────────────────────────────────────────────────
-- Only rows where the student is a demo student AND the vendor is the demo vendor.
DELETE FROM public.redemptions
 WHERE vendor_id = 'de300000-0000-4000-a000-000000000201'
   AND student_id IN (SELECT sp.id FROM public.student_profiles sp JOIN demo_users u ON u.id = sp.user_id);
DELETE FROM public.offer_views
 WHERE vendor_id = 'de300000-0000-4000-a000-000000000201'
   AND (student_id IS NULL OR student_id IN (SELECT sp.id FROM public.student_profiles sp JOIN demo_users u ON u.id = sp.user_id));
DELETE FROM public.saved_offers
 WHERE student_id = 'de300000-0000-4000-a000-000000000101';
DELETE FROM public.vendor_reviews
 WHERE vendor_id = 'de300000-0000-4000-a000-000000000201'
   AND student_id IN (SELECT sp.id FROM public.student_profiles sp JOIN demo_users u ON u.id = sp.user_id);
DELETE FROM public.notifications
 WHERE user_id IN (SELECT id FROM demo_users);

-- ── Loyalty stamps (offer 301) ───────────────────────────────────────────────
-- stamps(student, n, every_n_days, rewarded_handed_over)
WITH plan(student_id, n, gap) AS (VALUES
  ('de300000-0000-4000-a000-000000000101'::uuid, 5, 4),   -- demo student: 5/8
  ('de300000-0000-4000-a000-000000000111'::uuid, 8, 3),   -- reward earned, waiting to be handed over
  ('de300000-0000-4000-a000-000000000112'::uuid, 3, 6),
  ('de300000-0000-4000-a000-000000000113'::uuid, 11, 2)   -- reward handed over, 3 into the next card
),
stamp_rows AS (
  SELECT p.student_id, g AS seq, p.n,
         now() - make_interval(days => (p.n - g) * p.gap, hours => 8 + (g * 3) % 9) AS at
  FROM plan p, generate_series(1, p.n) g
)
INSERT INTO public.redemptions (
  offer_id, student_id, vendor_id, redemption_code, status, claimed_at, confirmed_at,
  expires_at, created_at, redemption_source, vendor_city, metadata
)
SELECT 'de300000-0000-4000-a000-000000000301', r.student_id, 'de300000-0000-4000-a000-000000000201',
       'DEMO-STAMP-' || upper(substr(md5(r.student_id::text || r.seq), 1, 10)),
       (CASE WHEN r.seq = 8 THEN 'reward_earned' ELSE 'stamp' END)::public.redemption_status,
       r.at, r.at, r.at + interval '24 hours', r.at, 'demo_seed', 'Budapest',
       CASE WHEN r.seq = 8 AND r.n > 8
            THEN jsonb_build_object('reward_claimed_at', r.at + interval '10 minutes', 'reward_claimed_by', jsonb_build_object('staff_id', 'demo'))
       END
FROM stamp_rows r;

-- ── Vouchers (offers 302–304) ────────────────────────────────────────────────
INSERT INTO public.redemptions (
  offer_id, student_id, vendor_id, redemption_code, qr_code_payload, status,
  claimed_at, confirmed_at, expires_at, created_at, discount_value_applied,
  estimated_transaction_value, redemption_source, vendor_city, offer_category,
  confirmed_by_vendor_user_id, time_to_confirm_seconds
)
SELECT v.offer_id, v.student_id, 'de300000-0000-4000-a000-000000000201',
       'DEMO-' || upper(substr(md5(v.student_id::text || v.offer_id || v.days_ago), 1, 8)),
       'DEMO-' || upper(substr(md5(v.student_id::text || v.offer_id || v.days_ago), 1, 8)),
       v.status::public.redemption_status,
       now() - make_interval(days => v.days_ago, hours => 3),
       CASE WHEN v.status = 'confirmed' THEN now() - make_interval(days => v.days_ago, hours => 3) + interval '4 minutes' END,
       now() - make_interval(days => v.days_ago, hours => 3) + interval '24 hours',
       now() - make_interval(days => v.days_ago, hours => 3),
       CASE WHEN v.status = 'confirmed' THEN v.saved END,
       CASE WHEN v.status = 'confirmed' THEN v.spend END,
       'demo_seed', 'Budapest',
       CASE WHEN v.offer_id = 'de300000-0000-4000-a000-000000000304' THEN 'books_stationery' ELSE 'food_drink' END::public.offer_category,
       CASE WHEN v.status = 'confirmed' THEN 'de300000-0000-4000-a000-000000000002'::uuid END,
       CASE WHEN v.status = 'confirmed' THEN 240 END
FROM (VALUES
  -- student, offer, status, days_ago, saved HUF, spend HUF
  ('de300000-0000-4000-a000-000000000101'::uuid, 'de300000-0000-4000-a000-000000000302'::uuid, 'claimed',   0,    0,    0),
  ('de300000-0000-4000-a000-000000000101'::uuid, 'de300000-0000-4000-a000-000000000303'::uuid, 'confirmed', 6,  450,  950),
  ('de300000-0000-4000-a000-000000000101'::uuid, 'de300000-0000-4000-a000-000000000302'::uuid, 'confirmed', 13, 380, 1900),
  ('de300000-0000-4000-a000-000000000101'::uuid, 'de300000-0000-4000-a000-000000000304'::uuid, 'expired',   4,    0,    0),
  ('de300000-0000-4000-a000-000000000111'::uuid, 'de300000-0000-4000-a000-000000000302'::uuid, 'confirmed', 2,  420, 2100),
  ('de300000-0000-4000-a000-000000000111'::uuid, 'de300000-0000-4000-a000-000000000304'::uuid, 'confirmed', 8, 1500, 7800),
  ('de300000-0000-4000-a000-000000000111'::uuid, 'de300000-0000-4000-a000-000000000303'::uuid, 'confirmed', 15, 450, 1100),
  ('de300000-0000-4000-a000-000000000112'::uuid, 'de300000-0000-4000-a000-000000000302'::uuid, 'confirmed', 5,  300, 1500),
  ('de300000-0000-4000-a000-000000000112'::uuid, 'de300000-0000-4000-a000-000000000303'::uuid, 'confirmed', 11, 450,  900),
  ('de300000-0000-4000-a000-000000000113'::uuid, 'de300000-0000-4000-a000-000000000302'::uuid, 'confirmed', 1,  560, 2800),
  ('de300000-0000-4000-a000-000000000113'::uuid, 'de300000-0000-4000-a000-000000000302'::uuid, 'confirmed', 9,  340, 1700),
  ('de300000-0000-4000-a000-000000000113'::uuid, 'de300000-0000-4000-a000-000000000304'::uuid, 'confirmed', 3, 1500, 6400),
  ('de300000-0000-4000-a000-000000000113'::uuid, 'de300000-0000-4000-a000-000000000303'::uuid, 'claimed',   20,   0,    0)
) AS v(student_id, offer_id, status, days_ago, saved, spend);

-- An old 'claimed' voucher is really expired.
UPDATE public.redemptions SET status = 'expired'
 WHERE redemption_source = 'demo_seed' AND status = 'claimed' AND expires_at < now();

-- ── Offer views (fires handle_new_offer_view → view counters) ────────────────
INSERT INTO public.offer_views (offer_id, vendor_id, student_id, source, viewed_at)
SELECT (ARRAY['de300000-0000-4000-a000-000000000301','de300000-0000-4000-a000-000000000302',
              'de300000-0000-4000-a000-000000000303','de300000-0000-4000-a000-000000000304'])[1 + g % 4]::uuid,
       'de300000-0000-4000-a000-000000000201',
       (ARRAY['de300000-0000-4000-a000-000000000101','de300000-0000-4000-a000-000000000111',
              'de300000-0000-4000-a000-000000000112','de300000-0000-4000-a000-000000000113'])[1 + (g * 7) % 4]::uuid,
       (ARRAY['feed','search','map','direct'])[1 + g % 4],
       now() - make_interval(days => (g * 13) % 30, hours => (g * 5) % 12)
FROM generate_series(1, 96) g;

-- ── Saved offers + reviews ───────────────────────────────────────────────────
INSERT INTO public.saved_offers (student_id, offer_id, saved_at) VALUES
  ('de300000-0000-4000-a000-000000000101', 'de300000-0000-4000-a000-000000000302', now() - interval '9 days'),
  ('de300000-0000-4000-a000-000000000101', 'de300000-0000-4000-a000-000000000304', now() - interval '3 days');

INSERT INTO public.vendor_reviews (vendor_id, student_id, rating, title, body, vendor_reply, vendor_replied_at, created_at) VALUES
  ('de300000-0000-4000-a000-000000000201', 'de300000-0000-4000-a000-000000000111', 5, 'Best flat white near ELTE',
   'Great coffee and the loyalty card actually adds up fast.', 'Köszönjük, Bence! See you at stamp #9.', now() - interval '6 days', now() - interval '7 days'),
  ('de300000-0000-4000-a000-000000000201', 'de300000-0000-4000-a000-000000000113', 4, 'Good textbook deals',
   'Found my microeconomics book for half price. Seating gets busy at lunch.', NULL, NULL, now() - interval '3 days'),
  ('de300000-0000-4000-a000-000000000201', 'de300000-0000-4000-a000-000000000101', 5, 'Cosy study spot',
   'Quiet in the mornings, fast wifi, and the pastry discount is real.', NULL, NULL, now() - interval '1 day');

-- ── Notifications for the demo student ───────────────────────────────────────
INSERT INTO public.notifications (user_id, type, title, body, related_entity_type, related_entity_id, is_read, created_at) VALUES
  ('de300000-0000-4000-a000-000000000001', 'promotion', 'Demo Café: pastries 20% off this week',
   'Show your StudDeals voucher at the counter.', 'offer', 'de300000-0000-4000-a000-000000000302', false, now() - interval '2 hours'),
  ('de300000-0000-4000-a000-000000000001', 'almost_there', 'You''re over halfway there',
   '5 of 8 stamps at Demo Café — 3 more for a free coffee.', 'vendor', 'de300000-0000-4000-a000-000000000201', true, now() - interval '1 day');

-- ── Counters the confirm/save triggers would normally maintain ───────────────
UPDATE public.offers o SET
  redemption_count = (SELECT count(*) FROM public.redemptions r WHERE r.offer_id = o.id AND r.status = 'confirmed'),
  save_count       = (SELECT count(*) FROM public.saved_offers s WHERE s.offer_id = o.id)
WHERE o.vendor_id = 'de300000-0000-4000-a000-000000000201';

UPDATE public.vendor_profiles v SET
  total_lifetime_redemptions = (SELECT count(*) FROM public.redemptions r WHERE r.vendor_id = v.id AND r.status = 'confirmed'),
  total_active_offers        = (SELECT count(*) FROM public.offers o WHERE o.vendor_id = v.id AND o.status = 'active')
WHERE v.id = 'de300000-0000-4000-a000-000000000201';

UPDATE public.student_profiles sp SET
  total_redemptions  = (SELECT count(*) FROM public.redemptions r WHERE r.student_id = sp.id AND r.status = 'confirmed'),
  total_savings_usd  = COALESCE((SELECT sum(discount_value_applied) FROM public.redemptions r WHERE r.student_id = sp.id AND r.status = 'confirmed'), 0),
  total_offers_saved = (SELECT count(*) FROM public.saved_offers s WHERE s.student_id = sp.id)
WHERE sp.user_id IN (SELECT id FROM demo_users);

COMMIT;
