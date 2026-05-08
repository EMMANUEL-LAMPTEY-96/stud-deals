-- Migration 004: Institutions coordinates + flash_deals + RLS
-- Run in Supabase SQL Editor

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS latitude   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS aliases    TEXT[] DEFAULT '{}';

DELETE FROM public.institutions
WHERE city IN ('Ann Arbor', 'East Lansing', 'Austin', 'New York', 'Los Angeles', 'Atlanta');

UPDATE public.institutions SET latitude = 47.4783, longitude = 19.0573, aliases = ARRAY['ELTE','Eötvös','elte.hu'] WHERE name = 'Eötvös Loránd University';
UPDATE public.institutions SET latitude = 47.4814, longitude = 19.0585, aliases = ARRAY['BME','Budapest Tech','bme.hu'] WHERE name = 'Budapest University of Technology and Economics';
UPDATE public.institutions SET latitude = 47.4776, longitude = 19.0580, aliases = ARRAY['Corvinus','BCE','corvinus.hu'] WHERE name = 'Corvinus University of Budapest';
UPDATE public.institutions SET latitude = 47.4879, longitude = 19.0602, aliases = ARRAY['Semmelweis','SOTE','semmelweis.hu'] WHERE name = 'Semmelweis University';
UPDATE public.institutions SET latitude = 47.5345, longitude = 19.0477, aliases = ARRAY['Óbuda','OE','uni-obuda.hu'] WHERE name = 'Óbuda University';
UPDATE public.institutions SET latitude = 47.5072, longitude = 19.0545, aliases = ARRAY['Metropolitan','METU','metropolitan.hu'] WHERE name = 'Budapest Metropolitan University';
UPDATE public.institutions SET latitude = 47.4766, longitude = 19.0587, aliases = ARRAY['Pázmány','PPKE','ppke.hu'] WHERE name = 'Pázmány Péter Catholic University';
UPDATE public.institutions SET latitude = 46.2533, longitude = 20.1414, aliases = ARRAY['SZTE','Szeged University','u-szeged.hu'] WHERE name = 'University of Szeged';
UPDATE public.institutions SET latitude = 47.5298, longitude = 21.6339, aliases = ARRAY['DE','Debrecen University','unideb.hu'] WHERE name = 'University of Debrecen';
UPDATE public.institutions SET latitude = 47.6888, longitude = 17.6362, aliases = ARRAY['SZE','Széchenyi','sze.hu'] WHERE name = 'Széchenyi István University';
UPDATE public.institutions SET latitude = 48.1037, longitude = 20.7784, aliases = ARRAY['ME','Miskolc University','uni-miskolc.hu'] WHERE name = 'University of Miskolc';
UPDATE public.institutions SET latitude = 46.0727, longitude = 18.2323, aliases = ARRAY['PTE','Pécs University','pte.hu'] WHERE name = 'University of Pécs';

INSERT INTO public.institutions (name, short_name, city, state, email_domains, estimated_student_count, latitude, longitude, aliases) VALUES
  ('Moholy-Nagy University of Art and Design','MOME','Budapest','Budapest',ARRAY['mome.hu'],2200,47.5172,19.0476,ARRAY['MOME','Moholy-Nagy']),
  ('Budapest Business School','BGE','Budapest','Budapest',ARRAY['bge.hu','bgf.hu'],22000,47.5062,19.0590,ARRAY['BGE','BGF','Business School Budapest']),
  ('Hungarian University of Fine Arts','MKE','Budapest','Budapest',ARRAY['mke.hu'],900,47.5014,19.0707,ARRAY['MKE','Fine Arts Budapest']),
  ('Liszt Ferenc Academy of Music','Zeneakadémia','Budapest','Budapest',ARRAY['lisztacademy.hu','zeneakademia.hu'],1200,47.4997,19.0623,ARRAY['Liszt Academy','Zeneakadémia']),
  ('National University of Public Service','NKE','Budapest','Budapest',ARRAY['uni-nke.hu'],9000,47.5021,19.0697,ARRAY['NKE','Public Service University']),
  ('Andrássy University Budapest','AUB','Budapest','Budapest',ARRAY['andrassyuni.hu'],600,47.4985,19.0615,ARRAY['AUB','Andrássy']),
  ('ELTE Faculty of Informatics','ELTE IK','Budapest','Budapest',ARRAY['inf.elte.hu','elte.hu'],5000,47.4721,19.0601,ARRAY['ELTE IK','ELTE Informatika']),
  ('Hungarian University of Agriculture and Life Sciences','MATE','Budapest','Budapest',ARRAY['mate.hu','szie.hu'],12000,47.4963,19.0484,ARRAY['MATE','SZIE','Agricultural University'])
ON CONFLICT (name) DO UPDATE SET latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, aliases=EXCLUDED.aliases;

INSERT INTO public.institutions (name, short_name, city, state, email_domains, estimated_student_count, latitude, longitude, aliases) VALUES
  ('Szeged University of Technology','SZTE MK','Szeged','Csongrád-Csanád',ARRAY['mk.u-szeged.hu'],3000,46.2489,20.1458,ARRAY['SZTE MK','Szeged Tech']),
  ('MATE Szeged Faculty','MATE Szeged','Szeged','Csongrád-Csanád',ARRAY['mate.hu'],1200,46.2400,20.1450,ARRAY['MATE Szeged','Agricultural Szeged'])
ON CONFLICT (name) DO UPDATE SET latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, aliases=EXCLUDED.aliases;

CREATE INDEX IF NOT EXISTS idx_institutions_location ON public.institutions (latitude, longitude);

ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_location ON public.vendor_profiles (latitude, longitude);

CREATE TABLE IF NOT EXISTS public.verification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash TEXT,
  success BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_user_day ON public.verification_attempts (user_id, attempt_at);
ALTER TABLE public.verification_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own attempts" ON public.verification_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own attempts" ON public.verification_attempts FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.flash_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  discount_text TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  max_redemptions INTEGER DEFAULT 50,
  redeemed_count INTEGER DEFAULT 0,
  radius_km DOUBLE PRECISION DEFAULT 2.0,
  target_cities TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.flash_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vendors manage own flash deals" ON public.flash_deals FOR ALL USING (vendor_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Students read active flash deals" ON public.flash_deals FOR SELECT USING (is_active = TRUE AND ends_at > NOW());

CREATE TABLE IF NOT EXISTS public.deletion_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  role TEXT,
  reason TEXT DEFAULT 'user_requested'
);

DROP POLICY IF EXISTS "Users can read own student profile" ON public.student_profiles;
DROP POLICY IF EXISTS "Admins can read all student profiles" ON public.student_profiles;
CREATE POLICY "Users can read own student profile" ON public.student_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all student profiles" ON public.student_profiles FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Users can update own student profile" ON public.student_profiles;
CREATE POLICY "Users can update own student profile" ON public.student_profiles FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can update student profiles" ON public.student_profiles;
CREATE POLICY "Admins can update student profiles" ON public.student_profiles FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
