-- =============================================================================
-- 024 · listed_cafes — real cafés near campus, shown without offers
--
-- These are real businesses that have NOT signed up and have NOT agreed to any
-- student discount. They are listings only: no owner account, no offers, no
-- redemptions. When a café signs up as a vendor, set claimed_vendor_id so the
-- listing can link to (or be replaced by) its vendor page.
--
-- Addresses: Szeged — szegedtourism.hu / caffeatlas.com; Budapest —
-- specialty.hu / journeybybackpack.com (2026 guide). Coordinates geocoded from
-- the address via OpenStreetMap (Photon), 2026-10-31. Re-check periodically:
-- cafés close and move.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.listed_cafes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL,
  city              text NOT NULL,
  address_line1     text NOT NULL,
  postal_code       text,
  country           text NOT NULL DEFAULT 'Hungary',
  latitude          numeric(9,6) NOT NULL,
  longitude         numeric(9,6) NOT NULL,
  website_url       text,
  source_url        text,
  claimed_vendor_id uuid REFERENCES public.vendor_profiles(id) ON DELETE SET NULL,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.listed_cafes IS
  'Real cafés listed for students WITHOUT offers. Not partners; never attach discounts here.';

CREATE INDEX IF NOT EXISTS listed_cafes_city_idx ON public.listed_cafes (city) WHERE is_active;
CREATE INDEX IF NOT EXISTS listed_cafes_claimed_vendor_idx ON public.listed_cafes (claimed_vendor_id);

DROP TRIGGER IF EXISTS trigger_listed_cafes_updated_at ON public.listed_cafes;
CREATE TRIGGER trigger_listed_cafes_updated_at
  BEFORE UPDATE ON public.listed_cafes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Read-only for everyone; only the service role / SQL editor writes.
ALTER TABLE public.listed_cafes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listed_cafes FROM anon, authenticated;
GRANT SELECT ON public.listed_cafes TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can read active listed cafes" ON public.listed_cafes;
CREATE POLICY "Anyone can read active listed cafes" ON public.listed_cafes
  FOR SELECT TO anon, authenticated
  USING (is_active);

INSERT INTO public.listed_cafes
  (slug, name, city, address_line1, postal_code, latitude, longitude, website_url, source_url)
VALUES
  ('kek-elefant-kavezo-szeged', 'Kék Elefánt Kávézó', 'Szeged', 'Klauzál tér 5', '6720', 46.252244, 20.147142, NULL, 'https://caffeatlas.com/kek-elefant-kavezo-szeged'),
  ('daily-dose-cafe-szeged', 'Daily Dose Café', 'Szeged', 'Lengyel utca 1', '6721', 46.260472, 20.156902, NULL, 'https://caffeatlas.com/daily-dose-cafe-szeged'),
  ('antique-cafe-szeged', 'Antique Cafe', 'Szeged', 'Petőfi Sándor sugárút 39', '6722', 46.247649, 20.139033, NULL, 'https://caffeatlas.com/antique-cafe-szeged'),
  ('barista-cafe-szeged', 'Barista Café', 'Szeged', 'Boldogasszony sugárút 16', '6725', 46.245034, 20.145236, 'https://baristaszeged.hu/', 'https://szegedtourism.hu/en/barista-2/'),
  ('barista-goods-szeged', 'Barista Goods', 'Szeged', 'Oskola utca 3', '6720', 46.251112, 20.149964, NULL, 'https://szegedtourism.hu/en/barista-2/'),
  ('smith-cafe-bistro-szeged', 'Smith Café & Bistro', 'Szeged', 'Kárász utca 13', '6720', 46.251104, 20.146443, 'https://www.facebook.com/smithcafeszeged', 'https://szegedtourism.hu/en/smith-cafe-bistro-2/'),
  ('flatty-coffee-shop-budapest', 'Flatty Coffee Shop', 'Budapest', 'Vámház körút 8', '1053', 47.488023, 19.059048, NULL, 'https://journeybybackpack.com/hungary/coffee-in-budapest/'),
  ('mantra-specialty-coffee-budapest', 'Mantra Specialty Coffee Minibar', 'Budapest', 'Veres Pálné utca 17', '1053', 47.490045, 19.056834, NULL, 'https://journeybybackpack.com/hungary/coffee-in-budapest/'),
  ('kontakt-budapest', 'Kontakt', 'Budapest', 'Károly körút 22', '1052', 47.495552, 19.057719, NULL, 'https://journeybybackpack.com/hungary/coffee-in-budapest/'),
  ('bageri-budapest', 'Bageri', 'Budapest', 'Ráday utca 9', '1092', 47.487592, 19.062836, NULL, 'https://journeybybackpack.com/hungary/coffee-in-budapest/'),
  ('vaj-rakoczi-budapest', 'Vaj', 'Budapest', 'József körút 30-32', '1085', 47.493436, 19.071412, NULL, 'https://journeybybackpack.com/hungary/coffee-in-budapest/'),
  ('kelet-kavezo-budapest', 'Kelet Kávézó és Galéria', 'Budapest', 'Bartók Béla út 29', '1114', 47.479915, 19.050366, NULL, 'https://specialty.hu/en'),
  ('the-nook-budapest', 'The Nook', 'Budapest', 'Tűzoltó utca 49', '1094', 47.480846, 19.078886, NULL, 'https://specialty.hu/en')
ON CONFLICT (slug) DO NOTHING;
