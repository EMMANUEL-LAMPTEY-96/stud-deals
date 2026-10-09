-- =============================================================================
-- 017 · Student marketing consent columns (re-applies 006, which never ran)
-- NOT YET APPLIED. Apply before deploying the security-lockdown branch.
--
-- The app reads/writes student_profiles.share_with_vendors and
-- consent_updated_at (settings page, consent + profile APIs, GDPR export,
-- vendor customer directory), but the live DB doesn't have them.
-- Default FALSE — vendors only see a student's identity after opt-in.
-- =============================================================================

ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS share_with_vendors boolean NOT NULL DEFAULT false;

ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS consent_updated_at timestamptz;

COMMENT ON COLUMN public.student_profiles.share_with_vendors IS
  'GDPR consent: student agrees to share their name/email/institution with vendors they have visited. Opt-in only.';
COMMENT ON COLUMN public.student_profiles.consent_updated_at IS
  'When the consent preference last changed (GDPR audit trail).';
