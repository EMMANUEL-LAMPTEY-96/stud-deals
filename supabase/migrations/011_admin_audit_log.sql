-- =============================================================================
-- Migration 011: Admin Audit Log
--
-- Creates an immutable record of all admin decisions so we can answer:
--   "Who approved vendor X, and when?"
--   "Why was student Y rejected?"
--   "How many vendors did Admin Z approve this week?"
--
-- RUN IN: Supabase SQL Editor
--   https://supabase.com/dashboard/project/mktqusaucpunasdnfulx/sql/new
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  action        text        NOT NULL,
  -- e.g. 'student_verified' | 'student_rejected' | 'vendor_approved' | 'vendor_rejected'
  entity_type   text        NOT NULL,
  -- e.g. 'student_profile' | 'vendor_profile'
  entity_id     uuid        NOT NULL,
  metadata      jsonb       NOT NULL DEFAULT '{}',
  -- Free-form context: rejection notes, plan tier granted, etc.
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- Fast lookup by admin (for "show me everything Admin Z did")
CREATE INDEX IF NOT EXISTS admin_audit_log_admin_id_idx    ON admin_audit_log (admin_id);
-- Fast lookup by entity (for "show me the history of vendor X")
CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx      ON admin_audit_log (entity_type, entity_id);
-- Chronological browsing
CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx  ON admin_audit_log (created_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can read all logs; only the service role (server-side) can insert
CREATE POLICY "Admins can read audit log"
  ON admin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated users.
-- All writes go through the service-role client (bypasses RLS).
-- This makes the log tamper-resistant from the application layer.
