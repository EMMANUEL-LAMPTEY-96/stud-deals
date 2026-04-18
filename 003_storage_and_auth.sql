-- =============================================================================
-- 003_storage_and_auth.sql
-- Stud-deals — Storage bucket + RLS policies for student ID uploads
--
-- Run this in Supabase → SQL Editor AFTER the main schema is set up.
-- =============================================================================

-- ─── Create the student-ids storage bucket ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-ids',
  'student-ids',
  false,                                    -- private bucket, not public
  5242880,                                  -- 5 MB max file size
  ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS: Students can upload their own ID ────────────────────────────────────
CREATE POLICY "Students can upload their own ID"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-ids'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ─── RLS: Students can view their own ID ─────────────────────────────────────
CREATE POLICY "Students can view their own ID"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'student-ids'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ─── RLS: Admins can view all student IDs ─────────────────────────────────────
CREATE POLICY "Admins can view all student IDs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'student-ids'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- =============================================================================
SELECT 'Storage bucket and policies created successfully' AS result;
-- =============================================================================
