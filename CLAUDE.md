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
npm run build    # Production build -- must pass before merging
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
 (student)/                    # Route group -- student-only pages
   dashboard/                  # Main offer feed
   verification/               # 3-step student verification flow
   loyalty/ + my-loyalty/      # Stamp cards
   notifications/
   offer/[id]/
 (vendor)/vendor/              # Route group -- vendor-only pages
   page.tsx                    # Loyalty dashboard (primary vendor home)
   offers/ + offers/[id]/      # Offer CRUD
   analytics/                  # Charts, punch card funnel, benchmark
   reviews/                    # Read student reviews, post replies
   customers/                  # Customer directory
   rewards/ + scan/            # Reward claim queue, QR scanner
   staff/                      # Staff PIN login
   notifications/ + flash/     # In-app alerts, flash deals
   calendar/                   # Offer scheduling
   print-qr/                   # Printable QR kit
   offers/templates/           # Offer template library
 admin/                        # Admin-only (verifications, users, vendors)
 api/
   loyalty/stamp/              # POST earn stamp; GET stamp progress
   redemptions/claim/          # POST student claims voucher
   redemptions/confirm/        # POST vendor confirms redemption
   vendor/reviews/             # GET + PATCH (reply)
   vendor/customers/
   vendor/promote/
   vendor/flash-deal/
   verification/               # send-otp, verify-otp, upload-id, submit-document
   admin/                      # stats, users, verifications, approve-vendor
   account/delete/
 stamp/[vendorId]/             # Public QR landing -- student scans to earn stamp
 auth/callback/                # Supabase OAuth callback
```

**Middleware** (`middleware.ts`) runs on every request. It:
1. Refreshes the Supabase session cookie using `auth.getUser()` (never `getSession()`)
2. Redirects unauthenticated users hitting protected routes to `/sign-in?redirect=<path>`
3. Redirects logged-in users away from auth pages to their role's dashboard
4. Enforces role-route separation (student cannot access /vendor, vendor cannot access /dashboard)

### Supabase Client Pattern

| Context | Import | Notes |
|---|---|---|
| Server Components & Route Handlers | `await createClient()` from `lib/supabase/server.ts` | Reads session from cookies; RLS enforced |
| Client Components | `createClient()` from `lib/supabase/client.ts` | Browser-side; RLS enforced |
| Admin operations (bypass RLS) | `createAdminClient()` from `lib/supabase/server.ts` | Uses `SUPABASE_SERVICE_ROLE_KEY`; server-only |

**Critical:** Always use `.maybeSingle()` instead of `.single()` for queries that may return 0 rows. `.single()` throws a 406 error on empty results.

### Database Schema (10 tables, all RLS-enabled)

| Table | Purpose |
|---|---|
| `profiles` | Auth user record (id = auth.uid), role ('student'|'vendor'|'admin') |
| `student_profiles` | user_id -> profiles, verification_status, institution_id |
| `vendor_profiles` | user_id -> profiles, business_name, is_verified, staff_pin |
| `offers` | vendor_id, status ('active'|'inactive'|'draft'), loyalty config embedded in terms_and_conditions |
| `redemptions` | All vouchers AND stamps -- see Loyalty section below |
| `vendor_reviews` | vendor_id, student_id, rating (1-5), vendor_reply |
| `saved_offers` | Student bookmarks |
| `offer_views` | Analytics view tracking |
| `notifications` | user_id, type, is_read |
| `institutions` | Hungarian universities with lat/lng coordinates |

Note: `verification_attempts` table also exists (created in migration 004) for rate limiting.

### Loyalty Stamp System

**Stamps are stored in the `redemptions` table** -- there is no separate loyalty_stamps table.
Status values: `'stamp'`, `'reward_earned'`, `'tier_reward'`, `'claimed'` (voucher), `'confirmed'` (vendor confirmed).

**Loyalty config is embedded in `offers.terms_and_conditions`** as:
```
[[LOYALTY:{"mode":"punch_card","required_visits":10,"reward_label":"Free coffee",...}]]
```
Parse with `parseLoyaltyConfig()` in `app/api/loyalty/stamp/route.ts`. Supports: `first_visit_bonus`, `stamp_expiry_days`, `double_stamp_windows[]`, `tiers[]`.

### Known Issues

**Unresolved Git merge conflicts in 6 files:**
- `app/(vendor)/vendor/page.tsx`
- `app/(vendor)/vendor/analytics/page.tsx`
- `app/(vendor)/vendor/offers/page.tsx`
- `app/(vendor)/vendor/offers/create/page.tsx`
- `app/(vendor)/vendor/offers/[id]/page.tsx`
- `app/(vendor)/vendor/profile/page.tsx`

These contain `<<<<<<< HEAD` / `>>>>>>>` markers. The Vercel build still passes (Next.js bundles the conflict text as string literals) but pages may render incorrectly. Resolve before editing any of these files.

### Pending Work

- **Vendor Customers page** (`/vendor/customers`) -- API route exists at `app/api/vendor/customers/route.ts` but the page needs wiring.
- **Student review submission UI** -- `vendor_reviews` table and vendor read-side exist but no student-facing submit flow.
- **Vendor public profile page** -- no `/vendor/[slug]` page exists (viral sharing loop).
- **Hardcoded landing page stats** -- "47,000+ students" etc. in `app/page.tsx` are marketing copy, not live DB queries.

---

## Coding Conventions

- All pages are `'use client'` using `useEffect` + `useState`. No React Server Components for data fetching.
- API routes always: (1) authenticate with `supabase.auth.getUser()`, (2) return typed `NextResponse.json()`.
- Use `createAdminClient()` for cross-user data access in API routes.
- Use `safeLog` from `lib/utils/safe-logger.ts` for server logging (strips PII).
- Use `lib/currency.ts` for all money formatting -- never raw `Intl.NumberFormat` with GBP/USD.

---

## Deployment

- **Vercel:** `https://vercel.com/nellamptey-3909s-projects/unideals` -- auto-deploys on push to `main`
- **Live:** `https://studeals.vercel.app`
- **Supabase SQL Editor:** `https://supabase.com/dashboard/project/mktqusaucpunasdnfulx/sql/new`
- To inject SQL in Supabase editor via JS: `window.monaco.editor.getEditors()[0].getModel().setValue(query)` then Ctrl+Enter
