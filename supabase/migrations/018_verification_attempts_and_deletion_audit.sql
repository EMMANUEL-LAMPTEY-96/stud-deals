-- =============================================================================
-- 018 · Tables the app uses that never reached the live DB (from 004)
-- NOT YET APPLIED. Apply before deploying the security-lockdown branch.
--
--   verification_attempts — rate limiting for ID document uploads. Without it
--                           the limiter couldn't count attempts (it failed open,
--                           now it fails closed) and account deletion aborts.
--   deletion_audit        — PII-free record of GDPR account deletions.
--
-- Both are written only by the service role; no client policies.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.verification_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action     text NOT NULL DEFAULT 'verification',
  attempt_at timestamptz NOT NULL DEFAULT now(),
  ip_hash    text,
  success    boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_user_action_time
  ON public.verification_attempts (user_id, action, attempt_at DESC);
ALTER TABLE public.verification_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verification_attempts FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.deletion_audit (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_at timestamptz NOT NULL DEFAULT now(),
  role       text,
  reason     text DEFAULT 'user_requested'
);
ALTER TABLE public.deletion_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.deletion_audit FROM PUBLIC, anon, authenticated;
