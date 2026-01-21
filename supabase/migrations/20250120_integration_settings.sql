-- Integration Settings & Sync Log Entries
-- TASK MACT #035
-- Stores integration API credentials in DB (not env vars) and detailed sync log entries

-- Integration settings table for storing API credentials
CREATE TABLE IF NOT EXISTS integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_type TEXT NOT NULL UNIQUE, -- 'woocommerce', 'cin7', etc.
  settings JSONB NOT NULL DEFAULT '{}', -- Encrypted/sensitive settings
  is_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on integration_type for fast lookups
CREATE INDEX IF NOT EXISTS idx_integration_settings_type ON integration_settings(integration_type);

-- Sync log entries for real-time sync progress display
-- More granular than sync_log - shows individual operations during sync
CREATE TABLE IF NOT EXISTS sync_log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_log_id UUID REFERENCES sync_log(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'woo_orders', 'woo_customers', etc.
  level TEXT NOT NULL DEFAULT 'info', -- 'info', 'warn', 'error', 'success'
  message TEXT NOT NULL,
  details JSONB, -- Optional additional data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sync_log_entries_sync_log_id ON sync_log_entries(sync_log_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_entries_sync_type ON sync_log_entries(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_entries_created_at ON sync_log_entries(created_at DESC);

-- Insert default WooCommerce integration (disabled by default)
INSERT INTO integration_settings (integration_type, settings, is_enabled)
VALUES ('woocommerce', '{"url": "", "consumer_key": "", "consumer_secret": ""}', false)
ON CONFLICT (integration_type) DO NOTHING;

-- Add RLS policies
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log_entries ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access to integration_settings"
  ON integration_settings FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to sync_log_entries"
  ON sync_log_entries FOR ALL
  USING (true)
  WITH CHECK (true);
