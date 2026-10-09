-- =============================================================================
-- 020 · Demo accounts (portfolio)
-- Additive / non-destructive. Applied to mktqusaucpunasdnfulx as 020a + 020b.
--
-- * profiles.is_demo marks the public one-click demo accounts
--   (demo-student@studeals.demo, demo-vendor@studeals.demo + seeded demo
--   customers). Data seeding lives in supabase/seed/demo_accounts.sql.
-- * guard_profiles (from 015a) now also stops API roles from setting or
--   clearing is_demo — only the service role / SQL can.
-- * Demo accounts can't change email, phone or password. The app hides those
--   controls, but the browser can call supabase.auth.updateUser() directly,
--   so this is enforced on auth.users itself.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_demo IS
  'Public demo account (password is published). Restricted: no credential changes, deletion or ID uploads; demo vendors only see demo students.';

CREATE OR REPLACE FUNCTION public.guard_profiles()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated', 'service_role') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.role = 'admin' THEN NEW.role := 'student'; END IF;
      IF current_user <> 'service_role' THEN
        NEW.is_active := true;
        NEW.is_demo := false;
      END IF;
    ELSE
      NEW.role := OLD.role;
      IF current_user <> 'service_role' THEN
        NEW.is_active := OLD.is_active;
        NEW.is_demo := OLD.is_demo;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.block_demo_credential_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (NEW.email IS DISTINCT FROM OLD.email
      OR NEW.phone IS DISTINCT FROM OLD.phone
      OR NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password
      OR (COALESCE(NEW.email_change, '') <> '' AND NEW.email_change IS DISTINCT FROM OLD.email_change))
     AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.id AND p.is_demo)
  THEN
    RAISE EXCEPTION 'Demo accounts cannot change their email, phone or password'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.block_demo_credential_changes() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_block_demo_credential_changes
  BEFORE UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.block_demo_credential_changes();
