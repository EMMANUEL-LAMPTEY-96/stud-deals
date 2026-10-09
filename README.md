# StudDeals

[![CI](https://github.com/EMMANUEL-LAMPTEY-96/stud-deals/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/EMMANUEL-LAMPTEY-96/stud-deals/actions/workflows/ci.yml)

**A hyper-local student discount and loyalty platform for Hungarian universities.**
Verified students claim QR-code vouchers and collect digital stamp cards at campus
businesses; vendors run offers, loyalty programmes and analytics from one dashboard.

> Portfolio project — live at **[studeals.vercel.app](https://studeals.vercel.app)**.
> No real payments are taken; billing runs in a disabled demo mode unless a Stripe key is configured.

<!-- SCREENSHOT: landing page / student dashboard (e.g. docs/screenshots/dashboard.png) -->

---

## Try it

On the [sign-in page](https://studeals.vercel.app/login), click **Try as Student** or **Try as Vendor**.
No sign-up is needed. Both accounts use sample data:

| Account | Email | What you'll see |
|---|---|---|
| Demo student | `demo-student@studeals.demo` | Verified ELTE student in Budapest with saved offers, an active voucher and a coffee stamp card at 5/8 |
| Demo vendor | `demo-vendor@studeals.demo` | "Demo Café", with 4 active offers, a punch-card loyalty programme, customers, reviews and analytics |

The password is the deployment's `NEXT_PUBLIC_DEMO_PASSWORD`; the seed script sets it to `StudealsDemo!2026`.
Demo accounts can't change their email or password, delete the account, or upload ID documents.
The demo vendor only ever sees demo students. There is intentionally **no admin demo**.

---

## Features

### Students
- **Student verification**, in one of two ways:
  - **University email:** a one-time code sent to an email at a recognised Hungarian university domain. The code is hashed, rate-limited and capped at 5 guesses.
  - **ID upload:** a photo of a student ID goes to a private storage bucket for admin review.
- **Deal feed:** browse, search, map/near-campus filter, trending / expiring-soon / new sections, and saved offers.
- **QR vouchers:** claim an offer to get a time-limited code; the vendor scans it to confirm.
- **Loyalty stamp cards.** Students scan the vendor's rotating, server-signed QR to earn stamps. Cards support:
  - mid-card tier rewards
  - double-stamp hours
  - first-visit bonuses
  - stamp expiry
- **Savings tracker**, achievement badges, referrals, birthday bonus and in-app notifications.
- **GDPR controls:** data export, opt-in consent before vendors see your identity, and full account deletion.

<!-- SCREENSHOT: voucher modal + stamp card -->

### Vendors
- **Offer management:** create and edit offers, a template library, a scheduling calendar and boosts.
- **Loyalty dashboard:** an on-screen stamp QR, a printable QR kit, a reward hand-over queue and a QR scanner.
- **Staff scan mode:** counter staff log in with a 4-digit PIN (hashed, rate-limited, HttpOnly session). They get only the scanner and the reward queue.
- **Analytics:** views, redemptions, punch-card funnel, peak hours/days, peer benchmark and CSV export.
- **Customers & reviews:** a consent-aware customer directory, reviews with replies, promotions and flash deals.
- **Public profile page** at `/vendor/<slug>`.
- **Plans** (Free / Growth / Pro), billed through Stripe Checkout and the billing portal when a Stripe key is configured.

<!-- SCREENSHOT: vendor analytics -->

### Admins
- **Verification queue:** ID documents open through short-lived signed URLs.
- **Management:** vendor approval, users, offers, redemptions (void, stamp overrides) and review moderation.
- **Platform tools:** announcements, platform config, an audit log, billing overview and fraud signals.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) and TypeScript in strict mode; builds fail on type errors |
| UI | Tailwind CSS, lucide-react, Recharts and framer-motion |
| Data / auth | Supabase: Postgres with Row Level Security, Auth and Storage |
| Validation | zod |
| Email | Resend (REST) |
| Payments | Stripe (optional; demo mode without a key) |
| QR | `qrcode`, `html5-qrcode`, and the native BarcodeDetector where available |
| Hosting | Vercel (with Vercel Cron) |
| Tests | Jest + ts-jest (unit), Playwright (E2E smoke), GitHub Actions CI |

---

## Architecture

```
app/
├── (student)/        student pages: dashboard, explore, offer/[id], loyalty, my-vouchers, verification…
├── (vendor)/vendor/  vendor dashboard: offers, analytics, customers, rewards, scan (staff), billing…
├── admin/            admin console
├── api/              route handlers (all privileged work happens here)
├── stamp/[vendorId]/ landing page for the vendor's stamp QR
└── auth/callback/    Supabase email-confirmation / OAuth callback
lib/
├── supabase/         server, browser and service-role clients
├── utils/            loyalty, OTP, staff sessions, stamp-QR signing, rate limiting, demo helpers…
└── types/            generated database types + app types
supabase/
├── migrations/       numbered SQL migrations
└── seed/             demo account seed (re-runnable)
middleware.ts         session refresh + role-based route protection
```

**Request flow:**
- `middleware.ts` refreshes the Supabase session on every request and enforces role separation (student / vendor / admin).
- Pages are client components that read through the user's own Supabase session, so Row Level Security applies.
- Anything that crosses users goes through an API route that authenticates the caller first and only then uses the service-role client. Examples: a vendor confirming a student's voucher, staff mode, notifications.

**Loyalty model:**
- Stamps and vouchers both live in `redemptions`, distinguished by status: `stamp`, `reward_earned`, `tier_reward`, `claimed`, `confirmed`, and others.
- Each programme's configuration is embedded in its offer as `[[LOYALTY:{json}]]`.
- When a reward is handed over, the row keeps its status and the hand-over is recorded in `metadata.reward_claimed_at`. This keeps stamp counts intact.

---

## Security hardening

This branch is a security pass over the original app. The main changes:

**Database (RLS + triggers)**
- **Guard triggers on `profiles`, `student_profiles` and `vendor_profiles`.** These stop users from editing their own role, active flag, verification status, plan/billing fields, counters or demo flag through the public API.
- **Vendor data split.** A `vendor_profiles_public` view exposes only public vendor columns. It replaces a policy that leaked every column, including staff PINs and Stripe IDs, to anyone.
- **Narrow voucher policies.** Students can read their own redemptions and create only `claimed` rows. Vendors can read and update rows at their own shop only.
- **Internal functions locked down.** `EXECUTE` is revoked on internal trigger functions. A dangerous `SECURITY DEFINER` sign-up trigger that copied the role from user metadata is dropped.
- **Hardened functions and views.** Every function has `search_path` pinned, and the analytics views run as `security_invoker`.
- **Demo accounts protected in Postgres.** A trigger on `auth.users` blocks email and password changes for them.

**Application fixes**
- **Email OTP:** codes are stored only as an HMAC, actually emailed, limited to Hungarian university domains and rate-limited.
- **Staff PINs:** moved from a browser-side check over every vendor's PINs to a server route. PINs are hashed, attempts are rate-limited, and staff get a signed HttpOnly session.
- **Stamp QR:** the code was guessable (`floor(now / 5 min)`). It is now an HMAC token signed by the server and valid for about 10 minutes.
- **Middleware:** a regex had made vendor dashboard pages public; it's fixed.
- **Auth callback:** auto-verification used substring domain matching, and the role came straight from metadata. Both are fixed.
- **Other access bugs:** stamp history was readable across users; the login page had an open redirect.
- **GDPR fixes:**
  - Account deletion now works; it was silently failing.
  - The customer directory respects consent.
  - ID-upload rate limiting is fixed; the limiter failed open, and one upload route had none at all.
- **Type safety:** a mismatch between `@supabase/ssr` and supabase-js had typed every query as `never` and hidden 848 TypeScript errors. Fixing it exposed dozens of real runtime bugs, all fixed. Builds now type-check.

---

## Local setup

```bash
git clone https://github.com/EMMANUEL-LAMPTEY-96/stud-deals.git
cd stud-deals
npm ci
cp .env.example .env.local   # or create it — see below
npm run dev                  # http://localhost:3000
```

Then:
1. **Database:** apply the SQL files in `supabase/migrations/` to your Supabase project, in order.
2. **Demo data (optional):** run `supabase/seed/demo_accounts.sql` in the SQL editor. It's safe to re-run; that resets the demo data.

```bash
npm test          # Jest unit tests
npx tsc --noEmit  # type-check
npm run build     # production build (type-checks too)
npm run test:e2e  # Playwright smoke tests against BASE_URL (default: the live demo)
```

The E2E smoke tests (`tests/e2e/`) only sign in to the demo accounts and open pages, so they are
safe to run repeatedly against the live site. They run daily and on demand in the
[E2E workflow](.github/workflows/e2e.yml); CI ([ci.yml](.github/workflows/ci.yml)) runs the
type-check, unit tests and production build on every push and pull request.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service-role key for server routes. Never expose it to the browser |
| `STAMP_QR_SECRET` | ✅ (prod) | Signs vendor stamp QR tokens |
| `CRON_SECRET` | ✅ (prod) | Protects `/api/cron/keep-alive`; Vercel Cron sends it automatically |
| `NEXT_PUBLIC_DEMO_PASSWORD` | optional | Enables the demo-login buttons; must match the seeded password |
| `RESEND_API_KEY` | optional* | Sends OTP and notification emails (*required for email verification in production) |
| `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` | optional | Sender identity |
| `OTP_HMAC_SECRET`, `STAFF_SESSION_SECRET` | optional | Dedicated secrets; both fall back to the service-role key |
| `NEXT_PUBLIC_APP_URL` | optional | Absolute URL used in emails and Stripe redirects |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | optional | Turns on real billing; without them billing shows "Demo — payments disabled" |
| `NEXT_PUBLIC_STRIPE_{GROWTH,PRO}{,_ANNUAL}_PRICE_ID` | optional | Stripe price IDs for the plans |

### Deployment

The app deploys to Vercel from `main`. `vercel.json` schedules a daily cron (`/api/cron/keep-alive`) that runs one cheap query. This stops the free-tier Supabase project from pausing.

---

<!-- SCREENSHOT: staff scan mode on a phone -->

Built by [Emmanuel Lamptey](https://github.com/EMMANUEL-LAMPTEY-96).
