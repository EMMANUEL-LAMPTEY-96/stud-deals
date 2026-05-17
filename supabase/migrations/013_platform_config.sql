-- =============================================================================
-- Migration 013: Platform Config
--
-- Creates a key-value settings table for platform-wide toggles.
-- Admins can enable/disable cities, toggle maintenance mode, etc.
-- Only service role can write; admins can read.
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_config (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT 'null',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Seed defaults
INSERT INTO platform_config (key, value) VALUES
  ('city_budapest_enabled',       'true'),
  ('city_szeged_enabled',         'true'),
  ('maintenance_mode',            'false'),
  ('new_registrations_open',      'true'),
  ('vendor_self_signup_enabled',  'true'),
  ('max_offers_per_vendor',       '20'),
  ('stamp_cooldown_minutes',      '60')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- Admins can SELECT
CREATE POLICY "admins_can_read_config" ON platform_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only service role can INSERT/UPDATE/DELETE (no policy = denied for non-service-role)

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_platform_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_config_updated_at
  BEFORE UPDATE ON platform_config
  FOR EACH ROW EXECUTE FUNCTION update_platform_config_timestamp();
