-- Outreach Send Logs Table
-- TASK MACT: Real-time send logging for outreach campaigns

CREATE TABLE IF NOT EXISTS outreach_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE NOT NULL,
  email_id UUID REFERENCES outreach_emails(id) ON DELETE CASCADE,

  -- Log entry
  level VARCHAR(20) NOT NULL DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
  step VARCHAR(100),                          -- e.g. 'fetch_email', 'render_template', 'send_api'
  message TEXT NOT NULL,
  data JSONB,                                 -- Additional context data

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching logs by campaign (most common query)
CREATE INDEX IF NOT EXISTS idx_outreach_send_logs_campaign ON outreach_send_logs(campaign_id, created_at DESC);

-- Index for fetching logs by email
CREATE INDEX IF NOT EXISTS idx_outreach_send_logs_email ON outreach_send_logs(email_id);

-- Function to clean up old logs (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_send_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM outreach_send_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
