-- System activity logs: tracks all significant events across the MACT platform
-- Human-readable messages for each event (AI responses, syncs, errors, settings changes, etc.)
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  level TEXT NOT NULL DEFAULT 'info',        -- 'info', 'warn', 'error'
  category TEXT NOT NULL,                     -- 'ai', 'sync', 'widget', 'auth', 'email', 'cron', 'settings', 'health', 'api'
  message TEXT NOT NULL,                      -- Human-readable: "Cin7 sync completed: 23 orders, 12 customers (4.2s)"
  path TEXT,                                  -- API path if applicable: '/api/chat'
  method TEXT,                                -- 'GET', 'POST', etc.
  status_code INTEGER,
  duration_ms INTEGER,
  metadata JSONB,                             -- Extra context (model name, token counts, error stack, record counts, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Primary query: recent logs by time
CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp DESC);
-- Filter by level (errors, warnings)
CREATE INDEX idx_system_logs_level ON system_logs(level, timestamp DESC);
-- Filter by category (ai, sync, widget, etc.)
CREATE INDEX idx_system_logs_category ON system_logs(category, timestamp DESC);
-- Cleanup: delete old logs efficiently
CREATE INDEX idx_system_logs_created ON system_logs(created_at);
