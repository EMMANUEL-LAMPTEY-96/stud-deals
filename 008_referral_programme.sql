-- =============================================================================
-- 008_referral_programme.sql
--
-- Student referral programme.
--
-- Design:
--   • Each student gets a unique 8-char referral code (stored on student_profiles).
--   • When a new student signs up via a referral link, the referral is recorded.
--   • Trigger: when the referred student claims their FIRST voucher, the referral
--     is marked completed and both students earn 2 bonus stamps toward the vendor
--     of that first claim.
--   • Bonus stamps are stored as status='referral_bonus' rows in redemptions so
--     they count toward punch-card progress automatically.
--
-- Run this in the Supabase SQL editor (Project → SQL editor → New query).
-- =============================================================================

-- ── 1. Add referral columns to student_profiles ───────────────────────────────

ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS referral_code   TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_id  UUID REFERENCES student_profiles(id) ON DELETE SET NULL;

-- Index for fast reverse-lookup (who did student X refer?)
CREATE INDEX IF NOT EXISTS idx_student_profiles_referred_by
  ON student_profiles(referred_by_id)
  WHERE referred_by_id IS NOT NULL;

-- ── 2. Create referrals tracking table ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS referrals (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id       UUID        NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  referred_id       UUID        NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'completed')),
  -- Set when the referred student claims their first voucher
  reward_granted_at TIMESTAMPTZ,
  -- The vendor the bonus stamps were credited to (NULL if not yet triggered)
  reward_vendor_id  UUID        REFERENCES vendor_profiles(id) ON DELETE SET NULL,
  reward_offer_id   UUID        REFERENCES offers(id)          ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate referral rows
CREATE UNIQUE INDEX IF NOT EXISTS referrals_referrer_referred_unique
  ON referrals(referrer_id, referred_id);

-- Fast lookup: has this student already been referred?
CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_unique
  ON referrals(referred_id);

-- ── 3. RLS policies ──────────────────────────────────────────────────────────

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Students can read their own referrals (as referrer)
CREATE POLICY "student can read own referrals as referrer"
  ON referrals FOR SELECT
  USING (
    referrer_id IN (
      SELECT id FROM student_profiles WHERE user_id = auth.uid()
    )
  );

-- Students can read their own referral (as referred)
CREATE POLICY "student can read own referral as referred"
  ON referrals FOR SELECT
  USING (
    referred_id IN (
      SELECT id FROM student_profiles WHERE user_id = auth.uid()
    )
  );

-- Only service role can insert/update (done server-side via admin client)
CREATE POLICY "service role manages referrals"
  ON referrals FOR ALL
  USING (auth.role() = 'service_role');
