-- =============================================================================
-- 026 · Hungarian universities (2026-10-31)
--
-- The institutions table was empty, so automatic university-email verification
-- could never match (send-otp and the auth callback look up country='Hungary').
--
-- email_domains = STUDENT mail domains only, and only where the university's own
-- site confirms them. A staff/root domain (e.g. elte.hu) is deliberately NOT
-- listed: sub-domain matching would let staff addresses verify as students.
--   student.elte.hu       — https://elte.hu/en/it-support
--   stud.uni-corvinus.hu  — https://www.uni-corvinus.hu/post/university-e-mail-address-and-cusman-identifier/
-- Others start empty (students use ID upload) until their student domain is
-- confirmed — add it with:
--   UPDATE public.institutions SET email_domains = ARRAY['<student domain>'] WHERE short_name = '<X>';
-- Coordinates are approximate main-campus points (from migration 004).
-- =============================================================================

INSERT INTO public.institutions (name, short_name, abbreviation, country, state, city, latitude, longitude, email_domains, website_url, is_active) VALUES
  ('Eötvös Loránd University',                        'ELTE',       'ELTE', 'Hungary', 'Budapest',         'Budapest',  47.4783, 19.0573, ARRAY['student.elte.hu'],      'https://www.elte.hu',          true),
  ('Corvinus University of Budapest',                 'Corvinus',   'BCE',  'Hungary', 'Budapest',         'Budapest',  47.4776, 19.0580, ARRAY['stud.uni-corvinus.hu'], 'https://www.uni-corvinus.hu',  true),
  ('Budapest University of Technology and Economics', 'BME',        'BME',  'Hungary', 'Budapest',         'Budapest',  47.4814, 19.0585, '{}',                        'https://www.bme.hu',           true),
  ('Semmelweis University',                           'Semmelweis', 'SE',   'Hungary', 'Budapest',         'Budapest',  47.4879, 19.0602, '{}',                        'https://semmelweis.hu',        true),
  ('Óbuda University',                                'Óbuda',      'OE',   'Hungary', 'Budapest',         'Budapest',  47.5345, 19.0477, '{}',                        'https://uni-obuda.hu',         true),
  ('Pázmány Péter Catholic University',               'PPKE',       'PPKE', 'Hungary', 'Budapest',         'Budapest',  47.4766, 19.0587, '{}',                        'https://ppke.hu',              true),
  ('Budapest Business University',                    'BGE',        'BGE',  'Hungary', 'Budapest',         'Budapest',  47.5062, 19.0590, '{}',                        'https://uni-bge.hu',           true),
  ('Hungarian University of Agriculture and Life Sciences', 'MATE', 'MATE', 'Hungary', 'Pest',             'Gödöllő',   47.5946, 19.3647, '{}',                        'https://uni-mate.hu',          true),
  ('University of Szeged',                            'SZTE',       'SZTE', 'Hungary', 'Csongrád-Csanád',  'Szeged',    46.2533, 20.1414, '{}',                        'https://u-szeged.hu',          true),
  ('University of Debrecen',                          'DE',         'DE',   'Hungary', 'Hajdú-Bihar',      'Debrecen',  47.5298, 21.6339, '{}',                        'https://unideb.hu',            true),
  ('University of Pécs',                              'PTE',        'PTE',  'Hungary', 'Baranya',          'Pécs',      46.0727, 18.2323, '{}',                        'https://pte.hu',               true),
  ('University of Miskolc',                           'ME',         'ME',   'Hungary', 'Borsod-Abaúj-Zemplén', 'Miskolc', 48.1037, 20.7784, '{}',                    'https://uni-miskolc.hu',       true),
  ('Széchenyi István University',                     'SZE',        'SZE',  'Hungary', 'Győr-Moson-Sopron', 'Győr',     47.6888, 17.6362, '{}',                        'https://uni.sze.hu',           true)
ON CONFLICT (name) DO UPDATE SET
  short_name = EXCLUDED.short_name, abbreviation = EXCLUDED.abbreviation, country = EXCLUDED.country,
  state = EXCLUDED.state, city = EXCLUDED.city, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
  email_domains = EXCLUDED.email_domains, website_url = EXCLUDED.website_url, is_active = EXCLUDED.is_active;
