-- =============================================================================
-- 009_birthday_bonus.sql
--
-- Birthday bonus mechanic for the loyalty system.
--
-- Design:
--   • Students set their date_of_birth on sign-up (or in settings).
--   • Once per calendar year, on their birthday, they can claim a birthday
--     reward: 3 bonus stamps credited to their most-active punch-card vendor.
--   • birthday_bonus_claimed_year tracks which year they last claimed, so the
--     bonus resets automatically on the next birthday.
--   • Bonus stamps are stored as status='birthday_bonus' rows in redemptions,
--     so they count toward punch-card progress exactly like normal stamps.
--
-- Run this in the Supabase SQL editor (Project → SQL editor → New query).
-- =============================================================================

ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS date_of_birth            DATE,
  ADD COLUMN IF NOT EXISTS birthday_bonus_claimed_year INT;

-- Index for birthday lookup (e.g. cron job finding today's birthdays)
CREATE INDEX IF NOT EXISTS idx_student_profiles_birthday
  ON student_profiles (
    EXTRACT(MONTH FROM date_of_birth),
    EXTRACT(DAY   FROM date_of_birth)
  )
  WHERE date_of_birth IS NOT NULL;
