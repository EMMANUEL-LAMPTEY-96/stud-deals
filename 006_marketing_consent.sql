-- =============================================================================
-- 006_marketing_consent.sql
-- Adds GDPR-compliant marketing consent field to student_profiles.
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- =============================================================================

-- ── 1. Add share_with_vendors column to student_profiles ─────────────────────
ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS share_with_vendors BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.student_profiles.share_with_vendors IS
  'GDPR consent: student agrees to share anonymised profile data with vendors they have interacted with. Default FALSE — opt-in only.';

-- ── 2. Index for fast vendor-side queries ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_student_profiles_share_with_vendors
  ON public.student_profiles (share_with_vendors)
  WHERE share_with_vendors = true;

-- ── 3. Add consent_updated_at to track when consent was last changed ─────────
ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS consent_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.student_profiles.consent_updated_at IS
  'Timestamp of the last consent preference change. Used for GDPR audit trail.';
