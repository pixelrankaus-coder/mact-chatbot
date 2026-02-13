-- Service alerts: tracks status changes for infrastructure services
CREATE TABLE IF NOT EXISTS service_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  previous_status TEXT, -- 'operational', 'degraded', 'down', 'unconfigured'
  current_status TEXT NOT NULL,
  details TEXT,
  response_time INTEGER, -- ms
  notified BOOLEAN DEFAULT false,
  email_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying recent alerts and unread notifications
CREATE INDEX idx_service_alerts_created_at ON service_alerts(created_at DESC);
CREATE INDEX idx_service_alerts_service ON service_alerts(service_name, created_at DESC);

-- Track last known status per service (for change detection)
CREATE TABLE IF NOT EXISTS service_status_cache (
  service_name TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  last_changed_at TIMESTAMPTZ DEFAULT NOW()
);
