# Unideals (studeals.vercel.app) — Security Vulnerability Report

**Date:** 2026-05-21  
**Auditor:** Internal Security Review  
**Scope:** Full codebase — authentication, authorization, business logic, input validation, file handling, webhook security, data exposure  
**Severity Scale:** CRITICAL → HIGH → MEDIUM → LOW

---

## Executive Summary

A comprehensive security review of the Unideals platform identified **19 vulnerabilities** across all major attack surfaces. The most severe finding is an **Insecure Direct Object Reference (IDOR)** in the loyalty stamp GET endpoint that allows any authenticated user to read the complete stamp history of any other student. Two additional CRITICAL issues exist: stamp replay attacks can be executed by omitting a nonce field, and student ID documents (government-issued ID scans) are stored in a publicly accessible storage bucket with no access controls.

Immediate remediation is recommended for all CRITICAL and HIGH severity findings before the platform scales to a wider user base.

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 7 |
| MEDIUM | 6 |
| LOW | 3 |
| **Total** | **19** |

---

## CRITICAL Vulnerabilities

---

### VULN-01 — IDOR: Any User Can Read Any Student's Stamp History

**Severity:** CRITICAL  
**File:** `app/api/loyalty/stamp/route.ts` (GET handler, ~lines 517–570)  
**Category:** Insecure Direct Object Reference (IDOR)

**Description:**  
The GET endpoint for stamp progress accepts a `student_id` query parameter and uses the admin Supabase client (which bypasses all Row Level Security policies) to fetch that student's redemption records. There is **no ownership check** — the endpoint only verifies that the requesting user is authenticated, not that the `student_id` belongs to them.

**Reproduction Steps:**
1. Sign in as Student A. Obtain Student A's auth token.
2. Obtain Student B's `student_profile_id` (e.g., by viewing their QR code, or from any listing endpoint that leaks profile IDs).
3. Send: `GET /api/loyalty/stamp?student_id=<STUDENT_B_ID>&vendor_id=<VENDOR_ID>`
4. Observe that Student B's full stamp history, current count, and reward eligibility are returned.

**Vulnerable Code:**
```typescript
// No ownership check here
const student_profile_id = searchParams.get('student_id'); // any value accepted
const admin = createAdminClient(); // RLS bypassed
if (student_profile_id) query = query.eq('student_id', student_profile_id);
```

**Recommended Fix:**
```typescript
// After auth check, resolve the caller's own student_profile_id
const { data: callerProfile } = await supabase
  .from('student_profiles')
  .select('id')
  .eq('user_id', user.id)
  .maybeSingle();

// For vendor calls, allow vendor_id param but restrict student to their own profile
const isVendor = /* check vendor_profiles row */ ;
if (!isVendor && student_profile_id !== callerProfile?.id) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```
Use the user-scoped `supabase` client (not admin) so RLS enforces access automatically wherever possible.

---

### VULN-02 — Stamp Replay Attack: Nonce is Optional

**Severity:** CRITICAL  
**File:** `app/api/loyalty/stamp/route.ts` (POST handler, ~lines 112–126), `lib/utils/validation.ts` (`StampSchema`)  
**Category:** Business Logic / Replay Attack

**Description:**  
The QR stamp endpoint implements a TOTP-style 5-minute nonce window to prevent replay attacks (the same QR scan being submitted multiple times). However, the nonce field is defined as `optional` in the Zod schema and the server-side check is wrapped in `if (nonce !== undefined)`. An attacker can simply omit the `nonce` field from the POST body to bypass all replay protection entirely, then re-submit the same vendor QR code repeatedly to accumulate unlimited stamps.

**Reproduction Steps:**
1. Obtain any valid vendor QR code (publicly visible at `stamp/[vendorId]`).
2. Send `POST /api/loyalty/stamp` with `{ vendor_id: "<id>" }` — **no nonce field**.
3. The server skips the nonce check and issues a stamp.
4. Repeat immediately — each request earns another stamp without waiting.
5. Bypass the 8-hour per-vendor cooldown by earning unlimited stamps in seconds.

**Vulnerable Code (`validation.ts`):**
```typescript
const StampSchema = z.object({
  vendor_id: z.string().uuid(),
  nonce: z.string().optional(), // ← attacker omits this field
});
```

**Vulnerable Code (`stamp/route.ts`):**
```typescript
if (nonce !== undefined) {
  // replay check only runs when nonce is provided
}
```

**Recommended Fix:**
Make the nonce required for all POST requests:
```typescript
// validation.ts
const StampSchema = z.object({
  vendor_id: z.string().uuid(),
  nonce: z.string().min(1), // required
});
// stamp/route.ts — remove the `if (nonce !== undefined)` guard
```

---

### VULN-03 — Student ID Documents in Public Storage Bucket

**Severity:** CRITICAL  
**File:** `app/api/verification/upload-id/route.ts`  
**Category:** Sensitive Data Exposure

**Description:**  
When students upload government-issued photo ID for verification, the documents are stored in a Supabase Storage bucket that is publicly accessible. Anyone who knows (or guesses) the storage URL can download any student's ID document — including full name, date of birth, address, and ID number — without authentication.

**Reproduction Steps:**
1. Trigger any student to upload an ID document.
2. Observe the returned storage path or intercept it from the upload response.
3. Construct the public URL: `https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>`
4. Access the URL in a browser without any authentication — the file downloads directly.

**Recommended Fix:**
- Change the Supabase Storage bucket policy to **private**.
- Use **signed URLs** (with short expiry, e.g., 60 seconds) when admin needs to review a document:
  ```typescript
  const { data } = await adminSupabase.storage
    .from('id-documents')
    .createSignedUrl(filePath, 60); // 60-second expiry
  ```
- Never expose the raw storage path in API responses.

---

## HIGH Vulnerabilities

---

### VULN-04 — Client-Controlled MIME Type on ID Upload

**Severity:** HIGH  
**File:** `app/api/verification/upload-id/route.ts`  
**Category:** File Upload Validation

**Description:**  
The file type validation for student ID uploads relies entirely on `file.type` (the MIME type supplied by the browser/client) and the file extension extracted from `file.name`. Both values are fully user-controlled and can be spoofed. A malicious file (e.g., an HTML page with a script, or a binary file) can be uploaded by simply setting the Content-Type header to `image/jpeg`.

**Reproduction Steps:**
1. Create a malicious file (e.g., an HTML file with JavaScript).
2. Rename it to `id.jpg`.
3. Upload it via `/api/verification/upload-id` with `Content-Type: image/jpeg`.
4. The server accepts and stores the file as a "valid" image.

**Recommended Fix:**
Inspect the actual file bytes (magic bytes / file signature) server-side:
```typescript
import { fileTypeFromBuffer } from 'file-type';

const buffer = Buffer.from(await file.arrayBuffer());
const detected = await fileTypeFromBuffer(buffer);
const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
if (!detected || !allowedTypes.includes(detected.mime)) {
  return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
}
```
Additionally, sanitize the file extension and generate a server-side UUID filename — never use the user-supplied `file.name`.

---

### VULN-05 — PostgREST Filter Injection in Admin Search

**Severity:** HIGH  
**File:** `app/api/admin/search/route.ts`  
**Category:** Injection / Query Manipulation

**Description:**  
The admin user search endpoint constructs a PostgREST `.or()` filter string by directly interpolating unsanitized user input. A comma, parenthesis, or PostgREST operator keyword in the search query `q` can break the filter structure, potentially exposing unintended records or causing query errors.

**Vulnerable Code:**
```typescript
const pattern = `%${q}%`;
.or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
```

**Reproduction Steps:**
1. As admin, send `GET /api/admin/search?q=),role.eq.admin,(first_name.ilike.%`
2. The crafted `q` value injects extra filter conditions into the PostgREST query.
3. Depending on the injection payload, unfiltered admin records or other users may be returned.

**Recommended Fix:**
Escape all special PostgREST characters from `q` before interpolation, or use separate `.ilike()` chained calls instead of a single `.or()` string:
```typescript
const sanitized = q.replace(/[%_,()]/g, '\\$&');
const pattern = `%${sanitized}%`;
// OR use chained filters:
let query = supabase.from('profiles').select('...');
if (q) {
  query = query.or(
    `first_name.ilike.${encodeURIComponent('%' + q + '%')},` +
    `last_name.ilike.${encodeURIComponent('%' + q + '%')}`
  );
}
```
The safest approach is using parameterized RPC functions for search operations.

---

### VULN-06 — Unverified Students Can Earn Stamps

**Severity:** HIGH  
**File:** `app/api/loyalty/stamp/route.ts` (POST handler)  
**Category:** Business Logic Bypass

**Description:**  
The stamp POST endpoint checks that the student profile exists but does **not** check `verification_status`. An unverified student (who has not completed student verification) can earn stamps, accumulate rewards, and redeem them — completely bypassing the core student verification requirement that the platform is built around.

**Recommended Fix:**
```typescript
if (studentProfile.verification_status !== 'verified') {
  return NextResponse.json(
    { error: 'Student verification required to earn stamps' },
    { status: 403 }
  );
}
```

---

### VULN-07 — Unverified Students Can Claim Birthday Bonuses

**Severity:** HIGH  
**File:** `app/api/birthday/route.ts`  
**Category:** Business Logic Bypass

**Description:**  
The birthday bonus stamp endpoint has no verification check. Any user who creates an account, sets a birthday date, and calls the endpoint receives bonus stamps without ever verifying their student status. This is the same class of issue as VULN-06.

**Recommended Fix:**
Add the same verification check as recommended in VULN-06 at the start of the POST handler, before any stamp is issued.

---

### VULN-08 — Wrong `user_id` in Admin Stamp-Override Notifications

**Severity:** HIGH  
**File:** `app/api/admin/stamp-override/route.ts`  
**Category:** Business Logic / Broken Notification Delivery

**Description:**  
When an admin manually overrides a stamp, the notification insert uses `student_profiles.id` as the `user_id` for the notifications table. However, `notifications.user_id` is a foreign key to `profiles.id` (the auth UUID), not to `student_profiles.id`. The result is that notifications are delivered to the wrong user (or fail silently if the `student_profiles.id` UUID happens to match a different `profiles.id`).

**Recommended Fix:**
```typescript
// Wrong:
user_id: studentProfile.id  // this is student_profiles.id, not profiles.user_id

// Correct:
user_id: studentProfile.user_id  // the auth UUID
```

---

### VULN-09 — Column Name Mismatch Breaks Vendor Promote Feature

**Severity:** HIGH  
**File:** `app/api/vendor/promote/route.ts`  
**Category:** Broken Functionality / Silent Data Access Failure

**Description:**  
The vendor promote endpoint queries the `redemptions` table filtering on `student_profile_id`, but the actual column name in the schema is `student_id`. The query returns zero rows silently, meaning the promote feature is non-functional — no targeted promotions are ever sent. If the column name were ever reused for a different purpose in a future migration, this could also become a data access bypass.

**Recommended Fix:**
```typescript
// Wrong:
.eq('student_profile_id', ...)

// Correct:
.eq('student_id', ...)
```
Add a TypeScript type on the query so column name errors are caught at build time.

---

### VULN-10 — Predictable Stamp Redemption Codes

**Severity:** HIGH  
**File:** `app/api/loyalty/stamp/route.ts`  
**Category:** Cryptographic Weakness

**Description:**  
Stamp redemption codes are generated as `STAMP-${Date.now()}`, `STAMP-DOUBLE-${Date.now() + 1}`, `STAMP-TIER-${Date.now()}`, etc. These codes are timestamp-based and entirely predictable. An attacker who knows the approximate time a stamp was issued can enumerate valid codes and potentially submit them directly to the confirm endpoint.

**Recommended Fix:**
Use cryptographically random codes:
```typescript
import { randomBytes } from 'crypto';
const code = `STAMP-${randomBytes(16).toString('hex').toUpperCase()}`;
```

---

## MEDIUM Vulnerabilities

---

### VULN-11 — `Math.random()` Used for Referral Code Generation

**Severity:** MEDIUM  
**File:** `app/api/referral/route.ts`, `generateReferralCode()`  
**Category:** Cryptographic Weakness

**Description:**  
Referral codes are generated using `Math.random()`, which is not a cryptographically secure pseudo-random number generator (CSPRNG). JavaScript's `Math.random()` is seeded from a predictable source and its output can be predicted with enough samples. An attacker can brute-force the 8-character referral code space (alphanumeric: ~2.8 trillion combinations, but the non-random distribution makes it smaller in practice) to claim referral bonuses without a genuine referral.

**Recommended Fix:**
```typescript
import { randomBytes } from 'crypto';
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(randomBytes(8))
    .map(b => chars[b % chars.length])
    .join('');
}
```

---

### VULN-12 — Claim Rate Limit Relies Entirely on RLS (No Explicit Filter)

**Severity:** MEDIUM  
**File:** `app/api/redemptions/claim/route.ts` (~lines 53–57)  
**Category:** Defense-in-Depth / RLS Dependency

**Description:**  
The hourly rate limit query for voucher claims does not include an explicit `.eq('student_id', <user_id>)` filter — it relies entirely on Supabase's Row Level Security policy to scope the count to the current user. If the RLS policy on `redemptions` were ever misconfigured (e.g., during a migration, a policy update, or an admin toggle), the rate limit check would count all redemptions globally rather than per-student, breaking the protection entirely.

**Recommended Fix:**
Always include explicit filters as a defense-in-depth measure, independent of RLS:
```typescript
const { count: claimsThisHour } = await supabase
  .from('redemptions')
  .select('id', { count: 'exact', head: true })
  .eq('student_id', studentProfile.id) // explicit — don't rely solely on RLS
  .eq('status', 'claimed')
  .gte('claimed_at', hourAgo);
```

---

### VULN-13 — No Rate Limiting on Review Submissions

**Severity:** MEDIUM  
**File:** Student review submission endpoint (not yet built — see CLAUDE.md Pending Work)  
**Category:** Abuse Prevention

**Description:**  
There is no student-facing review submission endpoint yet, but when built it must include rate limiting. Without it, a student (or bot) could flood any vendor with hundreds of 1-star reviews in seconds, severely damaging vendor reputation and platform trust. The `vendor_reviews` table has no unique constraint preventing duplicate reviews from the same student for the same vendor.

**Recommended Fix:**
When building the review submission endpoint:
- Add a unique constraint: `(vendor_id, student_id)` on `vendor_reviews`.
- Add a database-level check to prevent a student from reviewing the same vendor twice.
- Consider requiring a confirmed redemption (`status = 'confirmed'`) before a review can be submitted.

---

### VULN-14 — No Rate Limiting on Birthday Bonus POST

**Severity:** MEDIUM  
**File:** `app/api/birthday/route.ts`  
**Category:** Abuse Prevention

**Description:**  
The birthday bonus endpoint has no rate limiting. While there may be a date-based check (only one bonus per birthday per year), this is not verified and the endpoint can be called repeatedly in rapid succession. If the date check is absent or can be bypassed by modifying the `birthday` field in the student profile, a student could call it multiple times.

**Recommended Fix:**
- Add an explicit uniqueness check: only one birthday bonus per student per calendar year.
- Add a rate limit of 1 request per 24 hours per student using the same `lib/utils/rate-limit.ts` pattern used elsewhere.

---

### VULN-15 — Webhook Error Details Leaked in 200 Response

**Severity:** MEDIUM  
**File:** `app/api/billing/webhook/route.ts` (~line 164)  
**Category:** Information Disclosure

**Description:**  
When an error occurs during Stripe webhook processing, the handler returns HTTP 200 (intentionally, to prevent Stripe retries) but includes the full error message string in the response body: `{ received: true, error: String(err) }`. Error messages can reveal internal implementation details, table names, Supabase error codes, or stack traces that assist an attacker in fingerprinting the system.

**Recommended Fix:**
Log the error internally but return a generic body:
```typescript
safeLog.error(`[webhook] Error handling ${event.type}:`, err);
return NextResponse.json({ received: true }); // no error details in response
```

---

### VULN-16 — `tierFromPriceId()` Silently Downgrades Paid Customers on Env Misconfiguration

**Severity:** MEDIUM  
**File:** `app/api/billing/webhook/route.ts` (`tierFromPriceId()`, ~lines 47–59)  
**Category:** Business Logic / Configuration Risk

**Description:**  
If any of the four Stripe price ID environment variables (`STRIPE_PRO_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`, `STRIPE_GROWTH_PRICE_ID`, `STRIPE_GROWTH_ANNUAL_PRICE_ID`) are missing or misconfigured, `tierFromPriceId()` silently returns `'free'`. A paying customer's plan would be downgraded to free on the next webhook event with no error or alert. This is especially risky during environment variable rotation or deployment to a new environment.

**Recommended Fix:**
```typescript
function tierFromPriceId(priceId: string): PlanTier {
  if (!priceId) {
    safeLog.error('[webhook] tierFromPriceId called with empty priceId');
    throw new Error('Missing price ID');
  }
  if (priceId === process.env.STRIPE_PRO_PRICE_ID || ...) return 'pro';
  if (priceId === process.env.STRIPE_GROWTH_PRICE_ID || ...) return 'growth';
  
  // Unknown price ID — alert, don't silently downgrade
  safeLog.error(`[webhook] Unknown price ID: ${priceId} — cannot determine tier`);
  throw new Error(`Unknown price ID: ${priceId}`);
}
```
Throwing here means the webhook returns 200 with the error logged (safe for Stripe), but the subscription status won't be silently corrupted.

---

## LOW Vulnerabilities

---

### VULN-17 — No Explicit Role Check on Vendor Endpoints

**Severity:** LOW  
**File:** Multiple vendor API routes (e.g., `app/api/vendor/customers/route.ts`, `app/api/vendor/promote/route.ts`)  
**Category:** Authorization

**Description:**  
Vendor-only endpoints authenticate the user and check that a `vendor_profiles` row exists, but do not explicitly verify `profiles.role = 'vendor'`. If a student were somehow granted a `vendor_profiles` row (e.g., through a database migration error or admin mistake), they could access vendor-only data and operations.

**Recommended Fix:**
Add an explicit role check at the start of every vendor route handler:
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .maybeSingle();

if (profile?.role !== 'vendor') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

### VULN-18 — N+1 Auth API Calls in Vendor Customers Endpoint

**Severity:** LOW  
**File:** `app/api/vendor/customers/route.ts`  
**Category:** Performance / DoS Surface

**Description:**  
The customers endpoint fetches each customer's email by calling `admin.auth.admin.getUserById(uid)` in a loop — one Supabase Auth API call per customer. For a vendor with 100 customers, this generates 100 sequential API calls. Beyond being a performance problem, this is a potential denial-of-service vector: an attacker could trigger repeated calls to this endpoint to exhaust Supabase Auth API rate limits.

**Recommended Fix:**
Store the email in `profiles.email` (sync it at registration time) or use a single batch query. Supabase Auth Admin API does not support bulk fetching, so the standard fix is to include email in the `profiles` table:
```sql
ALTER TABLE profiles ADD COLUMN email text;
-- Sync on user creation via auth trigger
```
Then a single `profiles` query replaces all N auth API calls.

---

### VULN-19 — Middleware Double DB Query Per Request

**Severity:** LOW  
**File:** `middleware.ts`  
**Category:** Performance

**Description:**  
For every authenticated request, the middleware makes two separate database queries to the `profiles` table: once to get the user's role, and a second query for additional profile data. With Vercel Hobby plan limits (1M function invocations/month), this doubles the effective Supabase database query load for every page navigation and is an unnecessary performance overhead.

**Recommended Fix:**
Combine both queries into a single `SELECT` with all required columns. Alternatively, encode the role in the Supabase JWT using a `raw_app_meta_data` trigger on the auth user, which makes it available in the middleware from the session object without any DB round-trip:
```sql
CREATE OR REPLACE FUNCTION set_user_role()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Remediation Priority

| Priority | Vulnerabilities | Action |
|----------|-----------------|--------|
| **Immediate (this sprint)** | VULN-01, VULN-02, VULN-03 | Block deployment until fixed — CRITICAL data exposure and business logic abuse |
| **This week** | VULN-04, VULN-05, VULN-06, VULN-07, VULN-08, VULN-09, VULN-10 | HIGH — active abuse vectors or broken core features |
| **Next sprint** | VULN-11 through VULN-16 | MEDIUM — hardening and defense-in-depth |
| **Backlog** | VULN-17, VULN-18, VULN-19 | LOW — good hygiene, address before scaling |

---

## Summary Table

| ID | Title | Severity | File |
|----|-------|----------|------|
| VULN-01 | IDOR on stamp history GET endpoint | **CRITICAL** | `api/loyalty/stamp/route.ts` |
| VULN-02 | Stamp replay — nonce is optional | **CRITICAL** | `api/loyalty/stamp/route.ts` |
| VULN-03 | Student ID docs in public storage bucket | **CRITICAL** | `api/verification/upload-id/route.ts` |
| VULN-04 | Client-controlled MIME type on ID upload | **HIGH** | `api/verification/upload-id/route.ts` |
| VULN-05 | PostgREST filter injection in admin search | **HIGH** | `api/admin/search/route.ts` |
| VULN-06 | Unverified students can earn stamps | **HIGH** | `api/loyalty/stamp/route.ts` |
| VULN-07 | Unverified students can claim birthday bonus | **HIGH** | `api/birthday/route.ts` |
| VULN-08 | Wrong user_id in stamp-override notifications | **HIGH** | `api/admin/stamp-override/route.ts` |
| VULN-09 | Column name mismatch breaks vendor promote | **HIGH** | `api/vendor/promote/route.ts` |
| VULN-10 | Predictable timestamp-based stamp codes | **HIGH** | `api/loyalty/stamp/route.ts` |
| VULN-11 | Math.random() for referral code generation | **MEDIUM** | `api/referral/route.ts` |
| VULN-12 | Claim rate limit relies solely on RLS | **MEDIUM** | `api/redemptions/claim/route.ts` |
| VULN-13 | No rate limiting on review submissions | **MEDIUM** | (feature not yet built) |
| VULN-14 | No rate limiting on birthday bonus POST | **MEDIUM** | `api/birthday/route.ts` |
| VULN-15 | Webhook error details in 200 response body | **MEDIUM** | `api/billing/webhook/route.ts` |
| VULN-16 | Silent free-tier fallback on env misconfiguration | **MEDIUM** | `api/billing/webhook/route.ts` |
| VULN-17 | No explicit role check on vendor endpoints | **LOW** | Multiple vendor routes |
| VULN-18 | N+1 auth API calls in customers endpoint | **LOW** | `api/vendor/customers/route.ts` |
| VULN-19 | Middleware double DB query per request | **LOW** | `middleware.ts` |

---

*Report generated from manual code review of the Unideals codebase at commit `9cdb4bb`. All findings are based on static analysis of server-side route handlers, middleware, and utility functions.*
