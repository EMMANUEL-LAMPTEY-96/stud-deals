-- =============================================================================
-- Migration 007 — vendor_reviews: student submit + upsert policies
-- Run in: https://supabase.com/dashboard/project/mktqusaucpunasdnfulx/sql/new
-- =============================================================================

-- Ensure table exists (idempotent)
CREATE TABLE IF NOT EXISTS vendor_reviews (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id         uuid        NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  student_id        uuid        NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  rating            smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title             text,
  body              text,
  vendor_reply      text,
  vendor_replied_at timestamptz,
  is_visible        boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, student_id)
);

CREATE INDEX IF NOT EXISTS vendor_reviews_vendor_id_idx ON vendor_reviews(vendor_id);
CREATE INDEX IF NOT EXISTS vendor_reviews_student_id_idx ON vendor_reviews(student_id);

-- Enable RLS
ALTER TABLE vendor_reviews ENABLE ROW LEVEL SECURITY;

-- ── Policies ──────────────────────────────────────────────────────────────────

-- Students can read their own reviews
DROP POLICY IF EXISTS "Students read own reviews" ON vendor_reviews;
CREATE POLICY "Students read own reviews" ON vendor_reviews
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM student_profiles WHERE user_id = auth.uid()
    )
  );

-- Students can insert a review if they have a confirmed redemption at this vendor
DROP POLICY IF EXISTS "Students insert own reviews" ON vendor_reviews;
CREATE POLICY "Students insert own reviews" ON vendor_reviews
  FOR INSERT
  WITH CHECK (
    student_id IN (
      SELECT id FROM student_profiles WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM redemptions r
      WHERE r.student_id = student_id
        AND r.vendor_id  = vendor_id
        AND r.status     = 'confirmed'
    )
  );

-- Students can update (edit) their own reviews
DROP POLICY IF EXISTS "Students update own reviews" ON vendor_reviews;
CREATE POLICY "Students update own reviews" ON vendor_reviews
  FOR UPDATE
  USING (
    student_id IN (
      SELECT id FROM student_profiles WHERE user_id = auth.uid()
    )
  );

-- Vendors read reviews for their own venues
DROP POLICY IF EXISTS "Vendors read own reviews" ON vendor_reviews;
CREATE POLICY "Vendors read own reviews" ON vendor_reviews
  FOR SELECT
  USING (
    vendor_id IN (
      SELECT id FROM vendor_profiles WHERE user_id = auth.uid()
    )
  );

-- Vendors can add/update their reply field only
DROP POLICY IF EXISTS "Vendors update own replies" ON vendor_reviews;
CREATE POLICY "Vendors update own replies" ON vendor_reviews
  FOR UPDATE
  USING (
    vendor_id IN (
      SELECT id FROM vendor_profiles WHERE user_id = auth.uid()
    )
  );

-- Admins have full access
DROP POLICY IF EXISTS "Admin full access vendor_reviews" ON vendor_reviews;
CREATE POLICY "Admin full access vendor_reviews" ON vendor_reviews
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
