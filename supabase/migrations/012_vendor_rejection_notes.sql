-- =============================================================================
-- Migration 012: Vendor rejection notes
--
-- Adds a persistent rejection_notes column to vendor_profiles so admins
-- can see WHY a vendor was previously rejected when they reapply.
-- Previously rejection notes were sent in a notification but never stored.
--
-- RUN IN: Supabase SQL Editor
--   https://supabase.com/dashboard/project/mktqusaucpunasdnfulx/sql/new
-- =============================================================================

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS rejection_notes text;

-- Optional: index to quickly find all rejected vendors with notes
CREATE INDEX IF NOT EXISTS vendor_profiles_rejection_notes_idx
  ON vendor_profiles (is_verified, verified_at)
  WHERE is_verified = false AND verified_at IS NOT NULL;
