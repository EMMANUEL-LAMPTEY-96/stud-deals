-- =============================================================================
-- Migration 014: Make 'student-ids' storage bucket PRIVATE (VULN-03 fix)
--
-- PURPOSE:
--   Student ID documents (government-issued IDs) were previously stored in a
--   public bucket, making them accessible to anyone with the URL. This migration
--   converts the bucket to PRIVATE and removes the public-access storage policy.
--
-- AFTER RUNNING THIS:
--   - All new ID upload paths are stored in student_profiles.verification_document_url
--     as storage paths (e.g. "user-uuid/file-uuid.jpg"), NOT public URLs.
--   - Admin reviewers must call POST /api/admin/signed-id-url to get a
--     60-second signed URL for each document.
--   - Existing rows that stored full public URLs will need manual remediation
--     (extract just the path from the URL).
--
-- NOTE: If the bucket does not yet exist, the UPDATE will silently succeed
-- (no rows affected). Run AFTER ensuring the bucket exists in Storage.
-- =============================================================================

-- Make the bucket private
UPDATE storage.buckets
SET public = false
WHERE name = 'student-ids';

-- Drop any existing public-access SELECT policy on this bucket
DROP POLICY IF EXISTS "Public read student-ids" ON storage.objects;
DROP POLICY IF EXISTS "Public access student-ids" ON storage.objects;

-- Ensure only the service role (admin client) can read objects
-- Students can upload their own file; nobody else can read without signed URL
CREATE POLICY "Students can upload own ID"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'student-ids'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins (service role) handle all reads via createSignedUrl — no additional policy needed.
-- The service role bypasses RLS, so no SELECT policy is required for admin access.
