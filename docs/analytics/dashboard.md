# Growth analytics — SQL views & Looker Studio dashboard

Migration [`021_analytics_schema.sql`](../../supabase/migrations/021_analytics_schema.sql) creates a
Postgres schema called `analytics`. It holds read-only views over the production tables for growth and
RevOps reporting, plus a login role `looker_reader` for BI tools. It is applied to project
`mktqusaucpunasdnfulx`.

Use these views as the **source of truth for counts**: funnel sizes, retention, MRR. PostHog
([events.md](events.md)) is better for behaviour inside the app, but it only sees users who accepted
analytics cookies. The database sees every transaction.

## Ground rules

| Rule | Detail |
|---|---|
| Demo accounts excluded | Students with `profiles.is_demo = true` are excluded. So is everything that happened at a demo vendor (the demo vendor's own `profiles.is_demo`). |
| Not exposed via the API | `anon` and `authenticated` have no `USAGE` on `analytics`. Don't add it to **Settings → API → Exposed schemas**. |
| Views are the boundary | The views run with their owner's rights, so `looker_reader` needs `SELECT` on the views only, never on the tables. The views expose ids, dates, cities, categories and counts, but never names, emails or voucher codes. |
| Time zone | Days and weeks are in **Europe/Budapest**. Weeks start on **Monday** (`date_trunc('week')`). The current week is always partial. |
| Currency | HUF. |

### Metric definitions

These are based on `redemptions.status`. Stamps and vouchers share that table; see the README for why.

| Term | Definition |
|---|---|
| **Signup** | `profiles.created_at` of a real student or vendor |
| **Verified** | `student_profiles.verification_status = 'verified'`; time = `verified_at` |
| **Claim** | A voucher claimed: status `claimed`, `confirmed`, `expired` or `cancelled` (time = `claimed_at`) |
| **Redemption** | A voucher confirmed by the vendor in store: status `confirmed` (time = `confirmed_at`) |
| **Stamp** | A loyalty stamp: status `stamp`, `reward_earned` or `tier_reward` |
| **Reward** | A stamp that unlocked a reward: `reward_earned` (full card) or `tier_reward` (mid-card tier) |
| **Visit** | An in-store, vendor-confirmed interaction, meaning a **redemption or a stamp**. This is the core engagement unit for a loyalty product |
| **First redemption** (student funnel) | The student's first visit |
| **2nd visit** | A visit on a **later calendar day** than the first visit. Two stamps on the same day count as one visit-day |
| Excluded | `referral_bonus` and `birthday_bonus` rows are rewards, not visits; `admin_void` and `voided` rows are cancelled by an admin |

## The views

### Growth views (for the dashboard)

#### `analytics.funnel_students`

The student activation funnel by signup week.

| Column | Meaning |
|---|---|
| `signup_week` | Monday of the signup week |
| `signed_up`, `verified`, `first_claim`, `first_redemption`, `second_visit` | Students who reached the step **and every earlier step** (nested). So a student who only collects stamps and never claims a voucher stops at `verified` |
| `verified_pct` | verified ÷ signed_up |
| `claim_pct_of_verified` | first_claim ÷ verified |
| `redemption_pct_of_claimed` | first_redemption ÷ first_claim |
| `second_visit_pct_of_redeemed` | second_visit ÷ first_redemption |
| `overall_pct` | second_visit ÷ signed_up (signup → retained) |

Because steps have no time limit, recent cohorts look worse until they mature. Compare cohorts of the
same age, or use the retention view.

#### `analytics.retention_weekly_cohorts`

One row per (signup week × weeks since signup), including zero rows, so the cohort triangle has no gaps.

| Column | Meaning |
|---|---|
| `cohort_week` | Monday of the signup week |
| `cohort_size` | Real students who signed up that week |
| `weeks_since_signup` | 0 = the signup week itself |
| `active_students` | Students in the cohort with **≥ 1 visit** (redemption or stamp) during that week |
| `retention_pct` | active_students ÷ cohort_size |

#### `analytics.vendor_activation`

Vendor onboarding by signup week. Steps are nested.

| Column | Meaning |
|---|---|
| `signed_up` | Real vendors who signed up that week |
| `approved` | `vendor_profiles.is_verified` (approved by an admin) |
| `first_offer` | …and has at least one **published** (non-draft) offer |
| `first_redemption` | …and has at least one student visit at the shop |
| `approved_pct`, `activated_pct` | ÷ signed_up |
| `median_days_signup_to_first_redemption` / `avg_…` | Days from signup to the first student visit, for vendors who got one |
| `median_days_approval_to_first_redemption` | Days from approval to the first visit |

#### `analytics.redemptions_daily`

Daily activity by **vendor city** and **offer category**. Category comes from the offer; stamps take the
loyalty programme's category.

| Column | Meaning |
|---|---|
| `day`, `city`, `category` | Grain |
| `claims` | Vouchers claimed that day |
| `redemptions` | Vouchers confirmed in store that day |
| `stamps` | Stamps earned (including reward stamps) |
| `rewards` | Rewards unlocked (full card or tier) |
| `visiting_students` | Distinct students with a redemption or stamp. Don't sum this across days; it's a distinct count |
| `discount_value_huf` | Discount given on confirmed vouchers |
| `transaction_value_huf` | Estimated basket value on confirmed vouchers, where recorded |

#### `analytics.referrals`

The weekly referral loop. One row per week since the first real signup.

| Column | Meaning |
|---|---|
| `new_students` | Real student signups that week |
| `invites` | **Accepted invites**: friends who signed up with a referral code (`referrals` rows created). Link shares themselves exist only in PostHog (`referral_link_shared`) |
| `active_referrers` | Distinct students whose invite was accepted that week |
| `completed_referrals` | Referrals that **completed** that week, meaning the friend made their first claim and both earned bonus stamps (`reward_granted_at`) |
| `students_at_week_start` | Real students who signed up before the week |
| `referred_share_of_signups_pct` | invites ÷ new_students |
| `invite_conversion_pct` | completed ÷ invites (same week, so this is approximate for slow converters) |
| `invites_per_student` | invites ÷ students_at_week_start |
| **`k_factor`** | **completed_referrals ÷ students_at_week_start**: activated new users each existing user brought in that week (invites per user × invite conversion). K > 1 means viral growth |

#### `analytics.vendor_plans`

Real vendors by plan, with **theoretical MRR** from list prices.

| Column | Meaning |
|---|---|
| `plan_tier`, `plan_status` | From `vendor_profiles` (`trialing`, `active`, `past_due`, `cancelled`, `free`) |
| `vendors`, `approved_vendors` | Counts |
| `list_price_huf` | Monthly list price: free 0, Growth 13 990, Pro 27 990 (mirrors `PLAN_PRICES_HUF` in `lib/utils/plan-tier.ts`; update both together). `starter` is a legacy enum value with no price |
| `mrr_huf` | vendors × list price for `active` and `past_due` (still billed) |
| `trial_pipeline_mrr_huf` | The same for `trialing`: MRR if every trial converts |
| `pct_of_vendors` | Share of all real vendors |

"Theoretical" means two things. Annual plans are counted at the monthly list price, and Stripe discounts
are ignored. For booked revenue, use Stripe.

### Building blocks (also queryable)

| View | Grain | Use it for |
|---|---|---|
| `analytics.real_redemptions` | One `redemptions` row, real students × real vendors | Custom cuts; it has `event_at`, `city`, `category` and the HUF values |
| `analytics.student_visits` | One visit (`visit_type` = voucher or stamp) | Visit frequency, vendor loyalty |
| `analytics.student_milestones` | One real student | Per-student funnel timestamps, `city`, `institution`, counts of claims and visits, `last_visit_at` (churn and recency) |
| `analytics.vendor_milestones` | One real vendor | Per-vendor activation timestamps, plan |

## Connecting Looker Studio

### 1. Give `looker_reader` a password (one-time, by you)

The role was created **without a password**, so nobody can log in as it yet. In the
[Supabase SQL editor](https://supabase.com/dashboard/project/mktqusaucpunasdnfulx/sql/new), run:

```sql
ALTER ROLE looker_reader WITH PASSWORD 'paste-a-long-random-password-here';
```

Generate the password with a password manager (32+ characters). Don't commit it or paste it anywhere
else. To rotate it later, run the same command with a new password. To revoke access, run
`ALTER ROLE looker_reader WITH PASSWORD NULL;`.

What the role is limited to:
- `USAGE` on `analytics` and `SELECT` on its views; no access to `public`, `auth` or `storage` tables
- read-only transactions
- a 60 s statement timeout
- at most 5 connections

### 2. Get the session pooler details

In Supabase, go to **Connect** (top bar) → **Connection string** → **Method: Session pooler**. Use the
session pooler, not the direct connection: the direct host is IPv6-only, and Looker Studio connects over
IPv4. The values look like this:

| Field | Value |
|---|---|
| Host | `aws-0-eu-west-1.pooler.supabase.com` (copy the exact host from the dialog; it may be `aws-1-…`) |
| Port | `5432` (session mode; **not** 6543, which is transaction mode) |
| Database | `postgres` |
| Username | `looker_reader.mktqusaucpunasdnfulx` (role name **dot** project ref) |
| Password | the one you set in step 1 |

### 3. Add the data source in Looker Studio

1. Go to [lookerstudio.google.com](https://lookerstudio.google.com) → **Create** → **Data source** →
   **PostgreSQL** (the Google connector).
2. Under **Basic**, enter the host, port, database, username and password from step 2.
3. Tick **Enable SSL**. If Looker asks for a server certificate, download the CA from Supabase: **Project
   Settings → Database → SSL configuration → Download certificate**. Upload it as the server certificate.
4. Click **Authenticate**. Pick schema **`analytics`** and a view, e.g. `funnel_students` → **Connect**.
5. Repeat for each view you chart. Each view is its own data source. Alternatively, choose **Custom
   query** and write `select * from analytics.funnel_students`.
6. Set the data freshness to 12 hours (**Resource → Manage added data sources → Edit → Data freshness**).
   This keeps queries well within the free Supabase plan.

### 4. Suggested dashboard (one page per audience)

| Page | Charts | View |
|---|---|---|
| **Acquisition & activation** | Scorecards: signups, verified %, overall %. Funnel bar chart (sum of the 5 step columns). Line chart of `verified_pct` by `signup_week` | `funnel_students` |
| **Retention** | Pivot table: rows `cohort_week`, columns `weeks_since_signup`, metric `retention_pct` with a heat-map colour scale (the cohort triangle) | `retention_weekly_cohorts` |
| **Engagement** | Time series: `claims`, `redemptions`, `stamps` by `day`. Stacked bar by `category`. Geo or table by `city`. Scorecard: `discount_value_huf` (student savings) | `redemptions_daily` |
| **Supply (vendors)** | Funnel: `signed_up` → `approved` → `first_offer` → `first_redemption`. Scorecard: `median_days_signup_to_first_redemption` | `vendor_activation` |
| **Virality** | Line: `k_factor` and `invite_conversion_pct` by `week`. Bars: `invites` vs `completed_referrals` | `referrals` |
| **Revenue** | Scorecards: Σ `mrr_huf`, Σ `trial_pipeline_mrr_huf`. Donut chart of `vendors` by `plan_tier` | `vendor_plans` |

Set ratio columns (`*_pct`, `k_factor`) to aggregate with **Average** or recompute them as calculated
fields, e.g. `SUM(verified) / SUM(signed_up)`. Summing a percentage across weeks is meaningless.

## Changing the views

Add a new migration (`022_…`) with `CREATE OR REPLACE VIEW analytics.…`. Postgres can only **append**
columns that way. To rename or remove a column, use `DROP VIEW` and then `CREATE VIEW`, and re-run
`GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO looker_reader;`. New views are granted automatically
through the schema's default privileges.
