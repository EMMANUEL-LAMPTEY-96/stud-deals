-- =============================================================================
-- 021_analytics_schema.sql — growth analytics views for BI (Looker Studio)
--
-- Additive only: creates schema `analytics`, read-only views over the existing
-- tables, and a read-only login role `looker_reader`. No table is changed.
--
--  - `analytics` is NOT exposed through the Supabase Data API: anon and
--    authenticated have no USAGE on it, and it must not be added to
--    Settings → API → Exposed schemas.
--  - Every view excludes demo accounts (profiles.is_demo) — demo students,
--    and anything that happened at a demo vendor.
--  - The views run with their owner's rights (postgres) so `looker_reader`
--    needs SELECT on the views only, never on the underlying tables. That is
--    deliberate: the views are the access boundary and expose no PII (no
--    names, emails, codes — only ids, dates, cities, categories and counts).
--  - Weeks and days are in Europe/Budapest time; weeks start on Monday.
--  - `looker_reader` is created WITHOUT a password. Set one yourself:
--      ALTER ROLE looker_reader WITH PASSWORD '<strong password>';
--    See docs/analytics/dashboard.md.
--
-- Definitions (also in docs/analytics/dashboard.md):
--   claim       voucher claimed: status claimed | confirmed | expired | cancelled
--   redemption  voucher confirmed by the vendor: status confirmed
--   stamp       loyalty stamp: status stamp | reward_earned | tier_reward
--   reward      stamp that unlocked a reward: status reward_earned | tier_reward
--   visit       an in-store, vendor-confirmed interaction = redemption or stamp
--   Bonus rows (referral_bonus, birthday_bonus) and voided rows are excluded.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS analytics;
COMMENT ON SCHEMA analytics IS
  'Growth analytics views for BI tools. Not exposed through the Data API. Demo accounts excluded.';
REVOKE ALL ON SCHEMA analytics FROM PUBLIC;
REVOKE ALL ON SCHEMA analytics FROM anon, authenticated;

-- ── Building blocks ──────────────────────────────────────────────────────────

-- Every redemptions row between a real student and a real vendor, with a
-- single event timestamp, city and category filled in.
CREATE OR REPLACE VIEW analytics.real_redemptions AS
SELECT
  r.id                                                    AS redemption_id,
  r.student_id,
  r.vendor_id,
  r.offer_id,
  r.status::text                                          AS status,
  CASE
    WHEN r.status IN ('claimed', 'expired', 'cancelled') THEN COALESCE(r.claimed_at, r.created_at)
    ELSE COALESCE(r.confirmed_at, r.claimed_at, r.created_at)
  END                                                     AS event_at,
  COALESCE(r.claimed_at, r.created_at)                    AS claimed_at,
  r.confirmed_at,
  COALESCE(NULLIF(r.vendor_city, ''), vp.city, 'Unknown') AS city,
  COALESCE(r.offer_category::text, o.category::text, 'unknown') AS category,
  r.discount_value_applied                                AS discount_value_huf,
  r.estimated_transaction_value                           AS transaction_value_huf
FROM public.redemptions r
JOIN public.student_profiles sp ON sp.id = r.student_id
JOIN public.profiles sprof      ON sprof.id = sp.user_id AND NOT COALESCE(sprof.is_demo, false)
JOIN public.vendor_profiles vp  ON vp.id = r.vendor_id
JOIN public.profiles vprof      ON vprof.id = vp.user_id AND NOT COALESCE(vprof.is_demo, false)
LEFT JOIN public.offers o       ON o.id = r.offer_id
WHERE r.status NOT IN ('admin_void', 'voided');

COMMENT ON VIEW analytics.real_redemptions IS
  'Redemptions rows (vouchers + stamps) between real students and real vendors; one event_at per row.';

-- One row per visit (confirmed voucher or loyalty stamp).
CREATE OR REPLACE VIEW analytics.student_visits AS
SELECT
  redemption_id,
  student_id,
  vendor_id,
  CASE WHEN status = 'confirmed' THEN 'voucher' ELSE 'stamp' END AS visit_type,
  event_at                                                        AS visit_at,
  (event_at AT TIME ZONE 'Europe/Budapest')::date                 AS visit_date,
  city,
  category
FROM analytics.real_redemptions
WHERE status IN ('confirmed', 'stamp', 'reward_earned', 'tier_reward');

COMMENT ON VIEW analytics.student_visits IS
  'In-store visits by real students: vendor-confirmed vouchers and loyalty stamps.';

-- One row per real student with the timestamp of each lifecycle milestone.
CREATE OR REPLACE VIEW analytics.student_milestones AS
WITH students AS (
  SELECT
    sp.id                                        AS student_id,
    p.created_at                                 AS signed_up_at,
    CASE WHEN sp.verification_status = 'verified'
         THEN COALESCE(sp.verified_at, sp.updated_at) END AS verified_at,
    sp.verification_method::text                 AS verification_method,
    COALESCE(i.city, p.city)                     AS city,
    COALESCE(i.name, sp.institution_name_manual) AS institution
  FROM public.student_profiles sp
  JOIN public.profiles p ON p.id = sp.user_id
  LEFT JOIN public.institutions i ON i.id = sp.institution_id
  WHERE p.role = 'student' AND NOT COALESCE(p.is_demo, false)
),
claims AS (
  SELECT student_id, MIN(claimed_at) AS first_claim_at, COUNT(*) AS claims
  FROM analytics.real_redemptions
  WHERE status IN ('claimed', 'confirmed', 'expired', 'cancelled')
  GROUP BY student_id
),
visit_days AS (
  -- first visit on each distinct day; a "2nd visit" must be on a later day
  SELECT student_id, visit_date, MIN(visit_at) AS first_visit_that_day
  FROM analytics.student_visits
  GROUP BY student_id, visit_date
),
ranked AS (
  SELECT student_id, first_visit_that_day,
         ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY first_visit_that_day) AS n
  FROM visit_days
),
visit_totals AS (
  SELECT student_id, COUNT(*) AS visits, MAX(visit_at) AS last_visit_at
  FROM analytics.student_visits
  GROUP BY student_id
)
SELECT
  s.student_id,
  s.signed_up_at,
  (DATE_TRUNC('week', s.signed_up_at AT TIME ZONE 'Europe/Budapest'))::date AS signup_week,
  s.verified_at,
  s.verification_method,
  c.first_claim_at,
  r1.first_visit_that_day AS first_redemption_at,
  r2.first_visit_that_day AS second_visit_at,
  COALESCE(c.claims, 0)   AS claims,
  COALESCE(vt.visits, 0)  AS visits,
  vt.last_visit_at,
  s.city,
  s.institution
FROM students s
LEFT JOIN claims c        ON c.student_id = s.student_id
LEFT JOIN ranked r1       ON r1.student_id = s.student_id AND r1.n = 1
LEFT JOIN ranked r2       ON r2.student_id = s.student_id AND r2.n = 2
LEFT JOIN visit_totals vt ON vt.student_id = s.student_id;

COMMENT ON VIEW analytics.student_milestones IS
  'One row per real student: signup, verification, first claim, first redemption (first visit) and 2nd-day visit.';

-- One row per real vendor with the timestamp of each activation milestone.
CREATE OR REPLACE VIEW analytics.vendor_milestones AS
SELECT
  vp.id                                                                  AS vendor_id,
  COALESCE(vp.city, 'Unknown')                                           AS city,
  vp.business_type,
  p.created_at                                                           AS signed_up_at,
  (DATE_TRUNC('week', p.created_at AT TIME ZONE 'Europe/Budapest'))::date AS signup_week,
  CASE WHEN vp.is_verified THEN COALESCE(vp.verified_at, vp.updated_at) END AS approved_at,
  fo.first_offer_at,
  fv.first_redemption_at,
  vp.plan_tier::text                                                     AS plan_tier,
  vp.plan_status
FROM public.vendor_profiles vp
JOIN public.profiles p ON p.id = vp.user_id
LEFT JOIN LATERAL (
  SELECT MIN(o.created_at) AS first_offer_at
  FROM public.offers o
  WHERE o.vendor_id = vp.id AND o.status <> 'draft'
) fo ON true
LEFT JOIN LATERAL (
  SELECT MIN(v.visit_at) AS first_redemption_at
  FROM analytics.student_visits v
  WHERE v.vendor_id = vp.id
) fv ON true
WHERE NOT COALESCE(p.is_demo, false);

COMMENT ON VIEW analytics.vendor_milestones IS
  'One row per real vendor: signup, approval, first published offer, first student visit.';

-- ── Growth views ─────────────────────────────────────────────────────────────

-- Student funnel by signup week. Steps are nested: each step counts students
-- who reached it AND every earlier step.
CREATE OR REPLACE VIEW analytics.funnel_students AS
WITH counts AS (
  SELECT
    signup_week,
    COUNT(*) AS signed_up,
    COUNT(*) FILTER (WHERE verified_at IS NOT NULL) AS verified,
    COUNT(*) FILTER (WHERE verified_at IS NOT NULL AND first_claim_at IS NOT NULL) AS first_claim,
    COUNT(*) FILTER (WHERE verified_at IS NOT NULL AND first_claim_at IS NOT NULL
                       AND first_redemption_at IS NOT NULL) AS first_redemption,
    COUNT(*) FILTER (WHERE verified_at IS NOT NULL AND first_claim_at IS NOT NULL
                       AND first_redemption_at IS NOT NULL AND second_visit_at IS NOT NULL) AS second_visit
  FROM analytics.student_milestones
  GROUP BY signup_week
)
SELECT
  signup_week,
  signed_up,
  verified,
  first_claim,
  first_redemption,
  second_visit,
  ROUND(100.0 * verified         / NULLIF(signed_up, 0), 1)        AS verified_pct,
  ROUND(100.0 * first_claim      / NULLIF(verified, 0), 1)         AS claim_pct_of_verified,
  ROUND(100.0 * first_redemption / NULLIF(first_claim, 0), 1)      AS redemption_pct_of_claimed,
  ROUND(100.0 * second_visit     / NULLIF(first_redemption, 0), 1) AS second_visit_pct_of_redeemed,
  ROUND(100.0 * second_visit     / NULLIF(signed_up, 0), 1)        AS overall_pct
FROM counts;

COMMENT ON VIEW analytics.funnel_students IS
  'Student funnel by signup week: signed up → verified → first claim → first redemption → 2nd visit (nested counts + step conversion %).';

-- Weekly cohort retention: share of each signup-week cohort with ≥1 visit
-- (confirmed voucher or stamp) N weeks after signing up.
CREATE OR REPLACE VIEW analytics.retention_weekly_cohorts AS
WITH cohorts AS (
  SELECT signup_week AS cohort_week, COUNT(*) AS cohort_size
  FROM analytics.student_milestones
  GROUP BY signup_week
),
grid AS (
  SELECT c.cohort_week, c.cohort_size, w AS weeks_since_signup
  FROM cohorts c
  CROSS JOIN LATERAL generate_series(
    0,
    ((DATE_TRUNC('week', now() AT TIME ZONE 'Europe/Budapest'))::date - c.cohort_week) / 7
  ) AS w
),
activity AS (
  SELECT
    m.signup_week AS cohort_week,
    ((DATE_TRUNC('week', v.visit_at AT TIME ZONE 'Europe/Budapest'))::date - m.signup_week) / 7 AS weeks_since_signup,
    COUNT(DISTINCT v.student_id) AS active_students
  FROM analytics.student_visits v
  JOIN analytics.student_milestones m ON m.student_id = v.student_id
  GROUP BY 1, 2
)
SELECT
  g.cohort_week,
  g.cohort_size,
  g.weeks_since_signup,
  COALESCE(a.active_students, 0) AS active_students,
  ROUND(100.0 * COALESCE(a.active_students, 0) / NULLIF(g.cohort_size, 0), 1) AS retention_pct
FROM grid g
LEFT JOIN activity a
  ON a.cohort_week = g.cohort_week AND a.weeks_since_signup = g.weeks_since_signup;

COMMENT ON VIEW analytics.retention_weekly_cohorts IS
  'Students by signup week × weeks since signup with ≥1 visit (confirmed voucher or stamp). The current week is partial.';

-- Vendor activation by signup week (nested steps) and time to first redemption.
CREATE OR REPLACE VIEW analytics.vendor_activation AS
SELECT
  signup_week,
  COUNT(*) AS signed_up,
  COUNT(*) FILTER (WHERE approved_at IS NOT NULL) AS approved,
  COUNT(*) FILTER (WHERE approved_at IS NOT NULL AND first_offer_at IS NOT NULL) AS first_offer,
  COUNT(*) FILTER (WHERE approved_at IS NOT NULL AND first_offer_at IS NOT NULL
                     AND first_redemption_at IS NOT NULL) AS first_redemption,
  ROUND(100.0 * COUNT(*) FILTER (WHERE approved_at IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS approved_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE approved_at IS NOT NULL AND first_offer_at IS NOT NULL
                                   AND first_redemption_at IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS activated_pct,
  ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM first_redemption_at - signed_up_at) / 86400.0))::numeric, 1)
    AS median_days_signup_to_first_redemption,
  ROUND(AVG(EXTRACT(EPOCH FROM first_redemption_at - signed_up_at) / 86400.0)::numeric, 1)
    AS avg_days_signup_to_first_redemption,
  ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM first_redemption_at - approved_at) / 86400.0))::numeric, 1)
    AS median_days_approval_to_first_redemption
FROM analytics.vendor_milestones
GROUP BY signup_week;

COMMENT ON VIEW analytics.vendor_activation IS
  'Vendors by signup week → approved → first published offer → first student visit, with time to first redemption (days).';

-- Daily activity by vendor city and offer category.
CREATE OR REPLACE VIEW analytics.redemptions_daily AS
WITH events AS (
  SELECT r.*, e.kind
  FROM analytics.real_redemptions r
  CROSS JOIN LATERAL (
    SELECT 'claim' AS kind      WHERE r.status IN ('claimed', 'confirmed', 'expired', 'cancelled')
    UNION ALL SELECT 'redemption' WHERE r.status = 'confirmed'
    UNION ALL SELECT 'stamp'      WHERE r.status IN ('stamp', 'reward_earned', 'tier_reward')
    UNION ALL SELECT 'reward'     WHERE r.status IN ('reward_earned', 'tier_reward')
  ) e
)
SELECT
  (CASE WHEN kind = 'claim' THEN claimed_at ELSE event_at END AT TIME ZONE 'Europe/Budapest')::date AS day,
  city,
  category,
  COUNT(*) FILTER (WHERE kind = 'claim')      AS claims,
  COUNT(*) FILTER (WHERE kind = 'redemption') AS redemptions,
  COUNT(*) FILTER (WHERE kind = 'stamp')      AS stamps,
  COUNT(*) FILTER (WHERE kind = 'reward')     AS rewards,
  COUNT(DISTINCT student_id) FILTER (WHERE kind IN ('redemption', 'stamp')) AS visiting_students,
  COALESCE(SUM(discount_value_huf) FILTER (WHERE kind = 'redemption'), 0)    AS discount_value_huf,
  COALESCE(SUM(transaction_value_huf) FILTER (WHERE kind = 'redemption'), 0) AS transaction_value_huf
FROM events
GROUP BY 1, 2, 3;

COMMENT ON VIEW analytics.redemptions_daily IS
  'Claims, redemptions, stamps and rewards per day (Europe/Budapest) × vendor city × offer category.';

-- Referral loop by week. "Invites" are referral sign-ups (a friend registered
-- with a referral code); link shares themselves are only in PostHog.
CREATE OR REPLACE VIEW analytics.referrals AS
WITH weeks AS (
  SELECT generate_series(
    (SELECT MIN(signup_week) FROM analytics.student_milestones),
    (DATE_TRUNC('week', now() AT TIME ZONE 'Europe/Budapest'))::date,
    interval '1 week'
  )::date AS week
),
real_refs AS (
  SELECT rf.*
  FROM public.referrals rf
  JOIN analytics.student_milestones a ON a.student_id = rf.referrer_id
  JOIN analytics.student_milestones b ON b.student_id = rf.referred_id
),
signups AS (
  SELECT signup_week AS week, COUNT(*) AS new_students
  FROM analytics.student_milestones GROUP BY 1
),
invites AS (
  SELECT (DATE_TRUNC('week', created_at AT TIME ZONE 'Europe/Budapest'))::date AS week,
         COUNT(*) AS invites, COUNT(DISTINCT referrer_id) AS active_referrers
  FROM real_refs GROUP BY 1
),
completed AS (
  SELECT (DATE_TRUNC('week', COALESCE(reward_granted_at, created_at) AT TIME ZONE 'Europe/Budapest'))::date AS week,
         COUNT(*) AS completed_referrals
  FROM real_refs WHERE status = 'completed' GROUP BY 1
),
joined AS (
  SELECT
    w.week,
    COALESCE(s.new_students, 0)        AS new_students,
    COALESCE(i.invites, 0)             AS invites,
    COALESCE(i.active_referrers, 0)    AS active_referrers,
    COALESCE(c.completed_referrals, 0) AS completed_referrals,
    COALESCE(SUM(s.new_students) OVER (ORDER BY w.week ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)
      AS students_at_week_start
  FROM weeks w
  LEFT JOIN signups s   ON s.week = w.week
  LEFT JOIN invites i   ON i.week = w.week
  LEFT JOIN completed c ON c.week = w.week
)
SELECT
  week,
  new_students,
  invites,
  active_referrers,
  completed_referrals,
  students_at_week_start,
  ROUND(100.0 * invites / NULLIF(new_students, 0), 1)              AS referred_share_of_signups_pct,
  ROUND(100.0 * completed_referrals / NULLIF(invites, 0), 1)       AS invite_conversion_pct,
  ROUND(invites::numeric / NULLIF(students_at_week_start, 0), 3)   AS invites_per_student,
  ROUND(completed_referrals::numeric / NULLIF(students_at_week_start, 0), 3) AS k_factor
FROM joined;

COMMENT ON VIEW analytics.referrals IS
  'Weekly referral loop: invites (referral sign-ups), completed referrals and K-factor = completed referrals ÷ students at week start.';

-- Vendors by plan and theoretical MRR from list prices.
-- Prices mirror PLAN_PRICES_HUF in lib/utils/plan-tier.ts — update both together.
CREATE OR REPLACE VIEW analytics.vendor_plans AS
WITH prices(plan_tier, list_price_huf) AS (
  VALUES ('free', 0), ('starter', NULL::integer), ('growth', 13990), ('pro', 27990)
),
v AS (
  SELECT
    vp.plan_tier::text                         AS plan_tier,
    COALESCE(vp.plan_status, 'unknown')        AS plan_status,
    vp.is_verified
  FROM public.vendor_profiles vp
  JOIN public.profiles p ON p.id = vp.user_id
  WHERE NOT COALESCE(p.is_demo, false)
)
SELECT
  v.plan_tier,
  v.plan_status,
  COUNT(*)                                     AS vendors,
  COUNT(*) FILTER (WHERE v.is_verified)        AS approved_vendors,
  pr.list_price_huf,
  CASE WHEN v.plan_status IN ('active', 'past_due')
       THEN COUNT(*) * COALESCE(pr.list_price_huf, 0) ELSE 0 END AS mrr_huf,
  CASE WHEN v.plan_status = 'trialing'
       THEN COUNT(*) * COALESCE(pr.list_price_huf, 0) ELSE 0 END AS trial_pipeline_mrr_huf,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1)             AS pct_of_vendors
FROM v
LEFT JOIN prices pr ON pr.plan_tier = v.plan_tier
GROUP BY v.plan_tier, v.plan_status, pr.list_price_huf;

COMMENT ON VIEW analytics.vendor_plans IS
  'Real vendors by plan_tier × plan_status with theoretical MRR (HUF, monthly list price; active + past_due) and trial pipeline.';

-- ── Read-only BI role ────────────────────────────────────────────────────────
-- Created with LOGIN but no password, so nobody can sign in until the owner
-- runs ALTER ROLE looker_reader WITH PASSWORD '...'.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'looker_reader') THEN
    CREATE ROLE looker_reader WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      CONNECTION LIMIT 5;
  END IF;
END
$$;

ALTER ROLE looker_reader SET default_transaction_read_only = on;
ALTER ROLE looker_reader SET statement_timeout = '60s';
ALTER ROLE looker_reader SET search_path = analytics;

GRANT USAGE ON SCHEMA analytics TO looker_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO looker_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO looker_reader;
