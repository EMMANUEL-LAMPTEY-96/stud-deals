-- =============================================================================
-- 028 · vendor-assets bucket + rules for vendor-supplied URLs (2026-11-01)
--
-- 1. The vendor profile page uploads logos, covers and gallery photos to the
--    'vendor-assets' bucket, which did not exist — every upload failed.
--    Public read; images only (no SVG: it can carry script); 5 MB; a vendor
--    may only write inside its own folder "<vendor_profiles.id>/…".
--
-- 2. validate_vendor_urls (vendor_profiles + offers), user sessions only:
--    - website_url: trimmed; "cafe.hu" → "https://cafe.hu"; only http(s).
--    - logo_url, cover_image_url, gallery_photos[], offers.image_url: must be a
--      file in this vendor's own vendor-assets folder. Blocks third-party
--      images (visitor IP tracking) and anything that isn't an image upload.
--    Values are only checked when they change, so existing rows keep working
--    (e.g. the seeded demo logo '/demo/demo-cafe-logo.svg').
-- =============================================================================

-- ── 1 · bucket + storage policies ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vendor-assets', 'vendor-assets', true, 5242880,
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "vendor-assets: vendors read own folder"   ON storage.objects;
DROP POLICY IF EXISTS "vendor-assets: vendors upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "vendor-assets: vendors update own folder" ON storage.objects;
DROP POLICY IF EXISTS "vendor-assets: vendors delete own folder" ON storage.objects;

-- (Public URLs are served without a policy because the bucket is public;
--  SELECT is still needed for upsert/remove through the API.)
CREATE POLICY "vendor-assets: vendors read own folder" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vendor-assets' AND (storage.foldername(name))[1] IN
         (SELECT vp.id::text FROM public.vendor_profiles vp WHERE vp.user_id = (SELECT auth.uid())));
CREATE POLICY "vendor-assets: vendors upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-assets' AND (storage.foldername(name))[1] IN
         (SELECT vp.id::text FROM public.vendor_profiles vp WHERE vp.user_id = (SELECT auth.uid())));
CREATE POLICY "vendor-assets: vendors update own folder" ON storage.objects FOR UPDATE TO authenticated
  USING      (bucket_id = 'vendor-assets' AND (storage.foldername(name))[1] IN
         (SELECT vp.id::text FROM public.vendor_profiles vp WHERE vp.user_id = (SELECT auth.uid())))
  WITH CHECK (bucket_id = 'vendor-assets' AND (storage.foldername(name))[1] IN
         (SELECT vp.id::text FROM public.vendor_profiles vp WHERE vp.user_id = (SELECT auth.uid())));
CREATE POLICY "vendor-assets: vendors delete own folder" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vendor-assets' AND (storage.foldername(name))[1] IN
         (SELECT vp.id::text FROM public.vendor_profiles vp WHERE vp.user_id = (SELECT auth.uid())));

-- ── 2 · URL rules ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_own_vendor_asset(url text, vendor uuid)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT url ~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/vendor-assets/'
                || vendor::text || '/[A-Za-z0-9._/-]+$')
$$;

CREATE OR REPLACE FUNCTION public.validate_vendor_urls()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_vendor uuid;
  v_url    text;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'vendor_profiles' THEN
    v_vendor := NEW.id;

    IF TG_OP = 'INSERT' OR NEW.website_url IS DISTINCT FROM OLD.website_url THEN
      NEW.website_url := nullif(btrim(NEW.website_url), '');
      IF NEW.website_url IS NOT NULL THEN
        IF NEW.website_url !~* '^[a-z][a-z0-9+.-]*:' THEN
          NEW.website_url := 'https://' || NEW.website_url;           -- "cafe.hu" → https://cafe.hu
        END IF;
        IF NEW.website_url !~* '^https?://[^\s/?#]+\.[^\s/?#]+([/?#]\S*)?$' THEN
          RAISE EXCEPTION 'Website must be a normal web address, e.g. https://yourcafe.hu'
            USING ERRCODE = '22023', HINT = 'invalid_url';
        END IF;
      END IF;
    END IF;

    IF (TG_OP = 'INSERT' OR NEW.logo_url IS DISTINCT FROM OLD.logo_url)
       AND NEW.logo_url IS NOT NULL AND NOT public.is_own_vendor_asset(NEW.logo_url, v_vendor) THEN
      RAISE EXCEPTION 'Please upload your logo here rather than linking to another site.'
        USING ERRCODE = '22023', HINT = 'invalid_url';
    END IF;
    IF (TG_OP = 'INSERT' OR NEW.cover_image_url IS DISTINCT FROM OLD.cover_image_url)
       AND NEW.cover_image_url IS NOT NULL AND NOT public.is_own_vendor_asset(NEW.cover_image_url, v_vendor) THEN
      RAISE EXCEPTION 'Please upload your cover image here rather than linking to another site.'
        USING ERRCODE = '22023', HINT = 'invalid_url';
    END IF;
    IF TG_OP = 'INSERT' OR NEW.gallery_photos IS DISTINCT FROM OLD.gallery_photos THEN
      FOREACH v_url IN ARRAY coalesce(NEW.gallery_photos, '{}'::text[]) LOOP
        IF TG_OP = 'UPDATE' AND v_url = ANY (coalesce(OLD.gallery_photos, '{}'::text[])) THEN CONTINUE; END IF;
        IF NOT public.is_own_vendor_asset(v_url, v_vendor) THEN
          RAISE EXCEPTION 'Please upload gallery photos here rather than linking to another site.'
            USING ERRCODE = '22023', HINT = 'invalid_url';
        END IF;
      END LOOP;
    END IF;

  ELSIF TG_TABLE_NAME = 'offers' THEN
    IF (TG_OP = 'INSERT' OR NEW.image_url IS DISTINCT FROM OLD.image_url)
       AND NEW.image_url IS NOT NULL AND NOT public.is_own_vendor_asset(NEW.image_url, NEW.vendor_id) THEN
      RAISE EXCEPTION 'Please upload the offer image here rather than linking to another site.'
        USING ERRCODE = '22023', HINT = 'invalid_url';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.validate_vendor_urls() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_vendor_urls ON public.vendor_profiles;
CREATE TRIGGER trg_validate_vendor_urls
  BEFORE INSERT OR UPDATE OF website_url, logo_url, cover_image_url, gallery_photos ON public.vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_vendor_urls();

DROP TRIGGER IF EXISTS trg_validate_vendor_urls ON public.offers;
CREATE TRIGGER trg_validate_vendor_urls
  BEFORE INSERT OR UPDATE OF image_url ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.validate_vendor_urls();
