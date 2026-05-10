# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Unideals** (repo: `stud-deals`, live at `studeals.vercel.app`) is a hyper-local student discount marketplace targeting Hungarian university students. Verified students claim exclusive deals from campus businesses using QR-code vouchers and a loyalty stamp system.

- **Tech stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · Supabase (Postgres + Auth + Storage) · Vercel
- **Deployment:** Auto-deploys from `main` branch on Vercel. Project name on Vercel is `unideals` under account `nellamptey-3909`.
- **Supabase project:** `mktqusaucpunasdnfulx` · region `eu-west-1` (Ireland) · Free / Nano plan
- **Currency / locale:** Hungarian Forint (HUF) everywhere. Use `lib/currency.ts` helpers (`fmtHUF`, `fmtEUR`, `fmtDate`). Locale is always `hu-HU`. Never use GBP, USD, or `en-GB`.

---

## Commands

```bash
npm run dev      # Start local dev server (Next.js Turbopack)
npm run build    # Production build — must pass before merging
npm run start    # Start production server locally
```

There are no tests or lint scripts currently configured. TypeScript errors surface via `npm run build`.

---

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # Never expose to browser. Used only in server/admin clients.
```

---

## Architecture

### Route Groups & Roles

The app enforces three roles: `student`, `vendor`, `admin`. Role is stored in `public.profiles.role`.

```
app/
├── page.tsx                      # Public landing page (studeals.vercel.app/)
├── (student)/                    # Route group — student-only pages
│   ├── dashboard/                # Main offer feed
│   ├── verification/             # 3-step student verification flow
│   ├── loyalty/ + my-loyalty/    # Stamp cards
│   ├── notifications/
│   └── offer/[id]/
├── (vendor)/vendor/              # Route group — vendor-only pages
│   ├── page.tsx                  # Loyalty dashboard (primary vendor home)
│   ├── offers/ + offers/[id]/    # Offer CRUD
│   ├── analytics/                # Charts, punch card funnel, benchmark
│   ├── reviews/                  # Read student reviews, post replies
│   ├── customers/                # Customer directory
│   ├── rewards/ + scan/          # Reward claim queue, QR scanner
│   ├── staff/                    # Staff PIN login
│   ├── notifications/ + flash/   # In-app alerts, flash deals
│   ├── calendar/                 # Offer scheduling
│   ├── print-qr/                 # Printable QR kit
│   └── offers/templates/         # Offer template library
├── admin/                        # Admin-only pages (verifications, users, vendors)
├── api/                          # Route Handlers (all server-side)
│   ├── loyalty/stamp/            # POST — student earns stamp; GET — stamp progress
│   ├── redemptions/claim/        # POST — student claims voucher
│   ├── redemptions/confirm/      # POST — vendor confirms redemption
│   ├── vendor/reviews/           # GET + PATCH (reply)
│   ├── vendor/customers/
│   ├── vendor/promote/
│   ├── vendor/flash-deal/
│   ├── verification/             # send-otp, verify-otp, upload-id, submit-document
│   ├── admin/                    # stats, users, verifications, approve-vendor
│   └── account/delete/
├── stamp/[vendorId]/             # Public QR landing page — student scans to earn stamp
└── auth/callback/                # Supabase OAuth callback
```

**Middleware** (`middleware.ts`) runs on every request. It:
1. Refreshes the Supabase session cookie using `auth.getUser()` (never `getSession()`)
2. Redirects unauthenticated users hitting protected routes to `/sign-in?redirect=<path>`
3. Redirects logged-in users away from auth pages to their role's dashboard
4. Enforces role-route separation (student ↛ `/vendor`, vendor ↛ `/dashboard`, non-admin ↛ `/admin`)

### Supabase Client Pattern

Always use the correct client for the context:

| Context | Import | Notes |
|---|---|---|
| Server Components & Route Handlers | `await createClient()` from `lib/supabase/server.ts` | Reads session from cookies; RLS enforced |
| Client Components | `createClient()` from `lib/supabase/client.ts` | Browser-side; RLS enforced |
| Admin operations (bypass RLS) | `createAdminClient()` from `lib/supabase/server.ts` | Uses `SUPABASE_SERVICE_ROLE_KEY`; server-only |

**Critical:** Always use `.maybeSingle()` instead of `.single()` for queries that may return 0 rows. `.single()` throws a 406 error on empty results and has caused multiple production bugs.

### Database Schema (10 tables, all RLS-enabled)

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | Auth user record (all roles) | `id` (= auth.uid), `role` ('student'\|'vendor'\|'admin'), `first_name`, `display_name` |
| `student_profiles` | Extended student data | `user_id` → profiles, `verification_status`, `institution_id`, `graduation_year` |
| `vendor_profiles` | Business data | `user_id` → profiles, `business_name`, `is_verified`, `logo_url`, `city`, `staff_pin` |
| `offers` | Deals created by vendors | `vendor_id`, `status` ('active'\|'inactive'\|'draft'), `category`, `terms_and_conditions` (loyalty config embedded here) |
| `redemptions` | All transaction records — vouchers AND stamps | `student_id`, `vendor_id`, `offer_id`, `status`, `redemption_code` |
| `vendor_reviews` | Student ratings/reviews of vendors | `vendor_id`, `student_id`, `rating` (1-5), `vendor_reply` |
| `saved_offers` | Student bookmarks | `student_id`, `offer_id` |
| `offer_views` | Analytics view tracking | `offer_id`, `student_id` |
| `notifications` | In-app notifications | `user_id`, `type`, `is_read` |
| `institutions` | Hungarian universities | `name`, `city`, `country`, `lat`, `lng` |

### Loyalty Stamp System — Critical Design Detail

**There is no separate `loyalty_stamps` table.** Stamps are stored in the `redemptions` table using `status` values:
- `'stamp'` — regular stamp earned
- `'reward_earned'` — stamp that triggered a full-cycle reward
- `'tier_reward'` — stamp that triggered a mid-cycle tier reward
- `'claimed'` — standard voucher claim (not a stamp)
- `'confirmed'` — vendor has confirmed a redemption

**Loyalty config is embedded in `offers.terms_and_conditions`** as a prefixed JSON string:
```
[[LOYALTY:{"mode":"punch_card","required_visits":10,"reward_label":"Free coffee",...}]]
```
Parse it with the `parseLoyaltyConfig()` function in `app/api/loyalty/stamp/route.ts`. Advanced config supports: `first_visit_bonus`, `stamp_expiry_days`, `double_stamp_windows[]`, `tiers[]`.

### Verification Flow

Student verification uses 3 methods (see `app/(student)/verification/`):
1. **Email OTP** — student email verified via Supabase Auth OTP
2. **University email** — `.edu` or Hungarian university domain check
3. **Document upload** — photo ID stored in Supabase Storage; reviewed by admin at `/admin/verifications`

Rate limiting for document uploads is backed by a `verification_attempts` table (not visible in the main 10-table list — created in migration `004`). The `lib/utils/rate-limit.ts` utility handles this.

### Known Issues / Merge Conflicts

**⚠️ There are unresolved Git merge conflict markers (`<<<<<<< HEAD`) in 6 files:**
- `app/(vendor)/vendor/page.tsx`
- `app/(vendor)/vendor/analytics/page.tsx`
- `app/(vendor)/vendor/offers/page.tsx`
- `app/(vendor)/vendor/offers/create/page.tsx`
- `app/(vendor)/vendor/offers/[id]/page.tsx`
- `app/(vendor)/vendor/profile/page.tsx`

These files have both `<<<<<<< HEAD` and `>>>>>>> <hash>` markers. The build still passes on Vercel (Next.js bundles the conflicted text as literal string content inside TSX which doesn't always cause a compile error), but the pages may render incorrectly. **Resolve these conflicts before touching any of those files.**

### Components

```
components/
├── shared/
│   ├── Navbar.tsx              # Top nav — role-aware, shows vendor dropdown or student links
│   └── AdminPreviewBanner.tsx  # Orange banner when admin is previewing student/vendor view
├── student/
│   ├── OfferCard.tsx           # Offer tile with claim button
│   ├── VoucherModal.tsx        # Full-screen modal shown after claim (QR + countdown)
│   ├── EarnStampScanner.tsx    # Camera-based QR scanner for earning stamps
│   ├── AchievementBadges.tsx   # Gamification badges on student dashboard
│   └── SavingsHero.tsx         # Savings stats card on dashboard
└── vendor/
    ├── VendorNav.tsx           # Sidebar/topnav for all vendor pages
    ├── VendorQRPanel.tsx       # Displays vendor's QR code for students to scan
    ├── LoyaltyScanner.tsx      # Camera scanner for vendor to scan student QR
    ├── RedemptionScanner.tsx   # Voucher confirmation scanner
    ├── OnboardingChecklist.tsx # First-time setup steps
    └── RoiWidget.tsx           # ROI calculator with interval-based data refresh
```

### Pending Work

- **Task #25**: Vendor Customers page (`/vendor/customers`) — the API route `app/api/vendor/customers/route.ts` exists but the page at `app/(vendor)/vendor/customers/page.tsx` needs wiring.
- **Student review submission UI** — `vendor_reviews` table and vendor read-side exist, but there is no student-facing page or API route to submit a new review.
- **Vendor public profile page** — no public-facing `/vendor/[slug]` page exists yet (viral/sharing loop).
- **Hardcoded landing page stats** — "47,000+ students", "2,400+ deals" etc. in `app/page.tsx` are marketing copy, not live DB queries.

---

## Coding Conventions

- All pages are `'use client'` components using `useEffect` + `useState` for data fetching. There are no React Server Components used for data beyond the API routes.
- API routes always: (1) authenticate with `supabase.auth.getUser()`, (2) return typed `NextResponse.json()`, (3) use `try/catch` with `finally(() => setLoading(false))` on the client side.
- Use `createAdminClient()` (service role) for any cross-user data access in API routes (e.g., looking up a student's profile when a vendor calls an endpoint).
- Use `safeLog` from `lib/utils/safe-logger.ts` for server-side logging — it strips PII before writing.
- Distance calculations for the near-campus filter use `lib/utils/distance.ts` (Haversine formula).

---

## Deployment Notes

- **Vercel project:** `unideals` at `https://vercel.com/nellamptey-3909s-projects/unideals`
- **Live URL:** `https://studeals.vercel.app`
- Every push to `main` triggers an automatic Vercel deployment.
- Vercel is on the **Hobby (free) plan**: 1M serverless function invocations/month, 100GB bandwidth.
- Supabase is on the **Free plan**: 500MB DB storage, 1GB file storage, 2GB bandwidth, 50K monthly active users.
- To run SQL migrations, use the Supabase SQL Editor at `https://supabase.com/dashboard/project/mktqusaucpunasdnfulx/sql/new`. The Monaco editor accepts JavaScript injection via `window.monaco.editor.getEditors()[0].getModel().setValue(query)`.
