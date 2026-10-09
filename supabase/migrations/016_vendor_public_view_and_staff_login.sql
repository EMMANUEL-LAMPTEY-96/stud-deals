-- =============================================================================
-- 016 · Public vendor columns view + staff PIN login rate limiting
-- NOT YET APPLIED. Apply before deploying the security-lockdown branch:
-- the app reads other vendors through vendor_profiles_public from this branch on.
--
-- Why:
--   "Students can view verified vendor profiles" let anon/authenticated read
--   EVERY column of verified vendors — staff_pins, stripe ids, verification
--   document URL, rejection notes. Replace it with a view that exposes only
--   public columns. Owners keep full access to their own row via
--   "Vendors manage own vendor profile".
-- =============================================================================

CREATE OR REPLACE VIEW public.vendor_profiles_public
WITH (security_invoker = false) AS
SELECT
  id, slug, business_name, business_type, description,
  logo_url, cover_image_url, gallery_photos, website_url,
  business_phone, business_email,
  address_line1, address_line2, city, state, postal_code, country,
  latitude, longitude, business_hours,
  is_verified, total_active_offers, total_lifetime_redemptions, total_lifetime_views,
  created_at
FROM public.vendor_profiles
WHERE is_verified = true;

COMMENT ON VIEW public.vendor_profiles_public IS
  'Public columns of verified vendors. Runs as owner (bypasses vendor_profiles RLS) — never add private columns.';

REVOKE ALL ON public.vendor_profiles_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vendor_profiles_public TO anon, authenticated;

DROP POLICY IF EXISTS "Students can view verified vendor profiles" ON public.vendor_profiles;

-- Staff PIN login attempts (server-side rate limiting; service role only).
CREATE TABLE IF NOT EXISTS public.staff_login_attempts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id    uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  ip           text,
  success      boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_login_attempts_vendor_time_idx
  ON public.staff_login_attempts (vendor_id, attempted_at DESC);
ALTER TABLE public.staff_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_login_attempts FROM PUBLIC, anon, authenticated;
