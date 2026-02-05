-- PPC Module Schema for MACt Chatbot
-- Google Ads Integration Tables

-- ================================================
-- PPC Connections Table
-- Stores Google Ads account connections and OAuth tokens
-- ================================================
CREATE TABLE IF NOT EXISTS ppc_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT DEFAULT 'google_ads',
  customer_id TEXT NOT NULL,                    -- Google Ads Customer ID (XXX-XXX-XXXX format stored without dashes)
  account_name TEXT,
  refresh_token TEXT,                           -- Encrypted OAuth refresh token
  access_token TEXT,                            -- Encrypted OAuth access token
  token_expires_at TIMESTAMPTZ,
  developer_token TEXT,                         -- Google Ads API Developer Token
  login_customer_id TEXT,                       -- For MCC (Manager) accounts
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending',           -- pending, syncing, success, error
  sync_error TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_ppc_connections_customer ON ppc_connections(customer_id);
CREATE INDEX IF NOT EXISTS idx_ppc_connections_active ON ppc_connections(is_active) WHERE is_active = true;

-- ================================================
-- PPC Campaign Metrics Table
-- Daily campaign-level performance data
-- ================================================
CREATE TABLE IF NOT EXISTS ppc_campaign_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES ppc_connections(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  campaign_status TEXT,                         -- ENABLED, PAUSED, REMOVED
  campaign_type TEXT,                           -- SEARCH, DISPLAY, SHOPPING, VIDEO, PERFORMANCE_MAX
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,                 -- Google reports in micros (divide by 1,000,000 for dollars)
  conversions DECIMAL(10,2) DEFAULT 0,
  conversion_value DECIMAL(12,2) DEFAULT 0,
  average_cpc_micros BIGINT,
  ctr DECIMAL(8,6),                             -- Calculated: clicks/impressions
  conversion_rate DECIMAL(8,6),                 -- Calculated: conversions/clicks
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, campaign_id, date)
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_ppc_campaign_date ON ppc_campaign_metrics(connection_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ppc_campaign_status ON ppc_campaign_metrics(campaign_status);

-- ================================================
-- PPC Keyword Metrics Table
-- Daily keyword-level performance data
-- ================================================
CREATE TABLE IF NOT EXISTS ppc_keyword_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES ppc_connections(id) ON DELETE CASCADE,
  campaign_id TEXT,
  campaign_name TEXT,
  ad_group_id TEXT,
  ad_group_name TEXT,
  keyword_id TEXT,
  keyword_text TEXT,
  match_type TEXT,                              -- EXACT, PHRASE, BROAD
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,
  conversions DECIMAL(10,2) DEFAULT 0,
  conversion_value DECIMAL(12,2) DEFAULT 0,
  quality_score INTEGER,                        -- 1-10
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, keyword_id, date)
);

-- Indexes for keyword analysis
CREATE INDEX IF NOT EXISTS idx_ppc_keyword_date ON ppc_keyword_metrics(connection_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ppc_keyword_quality ON ppc_keyword_metrics(quality_score);
CREATE INDEX IF NOT EXISTS idx_ppc_keyword_campaign ON ppc_keyword_metrics(campaign_id);

-- ================================================
-- PPC Geographic Metrics Table
-- Daily geographic performance data by state/region
-- ================================================
CREATE TABLE IF NOT EXISTS ppc_geo_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES ppc_connections(id) ON DELETE CASCADE,
  campaign_id TEXT,
  location_id TEXT,                             -- Google Geo Target ID
  location_name TEXT,                           -- e.g., "New South Wales, Australia"
  location_type TEXT,                           -- State, City, Region, Country
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,
  conversions DECIMAL(10,2) DEFAULT 0,
  conversion_value DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, campaign_id, location_id, date)
);

-- Index for geographic analysis
CREATE INDEX IF NOT EXISTS idx_ppc_geo_date ON ppc_geo_metrics(connection_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ppc_geo_location ON ppc_geo_metrics(location_name);

-- ================================================
-- PPC AI Recommendations Table
-- Store AI-generated insights and recommendations
-- ================================================
CREATE TABLE IF NOT EXISTS ppc_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES ppc_connections(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL,            -- budget_reallocation, underperforming_keywords, geo_opportunity, etc.
  priority TEXT DEFAULT 'medium',               -- high, medium, low
  title TEXT NOT NULL,
  insight TEXT,                                 -- What the data shows
  recommendation TEXT,                          -- Specific action to take
  expected_impact TEXT,                         -- Projected outcome
  confidence TEXT DEFAULT 'medium',             -- high, medium, low
  data_points JSONB,                            -- Supporting metrics
  is_dismissed BOOLEAN DEFAULT false,
  is_actioned BOOLEAN DEFAULT false,
  actioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ                        -- Recommendations expire after a period
);

-- Index for active recommendations
CREATE INDEX IF NOT EXISTS idx_ppc_recommendations_active ON ppc_recommendations(connection_id, is_dismissed, is_actioned)
  WHERE is_dismissed = false AND is_actioned = false;

-- ================================================
-- PPC Sync Log Table
-- Track sync history for debugging
-- ================================================
CREATE TABLE IF NOT EXISTS ppc_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES ppc_connections(id) ON DELETE CASCADE,
  sync_type TEXT,                               -- full, incremental, manual
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',                -- running, success, error
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB                                -- Additional sync details
);

-- Index for recent syncs
CREATE INDEX IF NOT EXISTS idx_ppc_sync_log_recent ON ppc_sync_log(connection_id, started_at DESC);

-- ================================================
-- Helper Functions
-- ================================================

-- Function to convert micros to dollars
CREATE OR REPLACE FUNCTION micros_to_dollars(micros BIGINT)
RETURNS DECIMAL(12,2) AS $$
BEGIN
  RETURN COALESCE(micros, 0)::DECIMAL / 1000000;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate CTR
CREATE OR REPLACE FUNCTION calc_ctr(clicks INTEGER, impressions INTEGER)
RETURNS DECIMAL(8,6) AS $$
BEGIN
  IF impressions > 0 THEN
    RETURN (clicks::DECIMAL / impressions) * 100;
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate CPA
CREATE OR REPLACE FUNCTION calc_cpa(cost_micros BIGINT, conversions DECIMAL)
RETURNS DECIMAL(12,2) AS $$
BEGIN
  IF conversions > 0 THEN
    RETURN micros_to_dollars(cost_micros) / conversions;
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================
-- Views for Dashboard
-- ================================================

-- Campaign summary view with calculated metrics
CREATE OR REPLACE VIEW ppc_campaign_summary AS
SELECT
  cm.connection_id,
  cm.campaign_id,
  cm.campaign_name,
  cm.campaign_status,
  cm.campaign_type,
  SUM(cm.impressions) as total_impressions,
  SUM(cm.clicks) as total_clicks,
  micros_to_dollars(SUM(cm.cost_micros)) as total_spend,
  SUM(cm.conversions) as total_conversions,
  micros_to_dollars(SUM(cm.conversion_value)) as total_conversion_value,
  calc_ctr(SUM(cm.clicks)::INTEGER, SUM(cm.impressions)::INTEGER) as ctr,
  calc_cpa(SUM(cm.cost_micros), SUM(cm.conversions)) as cpa,
  CASE
    WHEN SUM(cm.cost_micros) > 0 THEN
      SUM(cm.conversion_value) / micros_to_dollars(SUM(cm.cost_micros))
    ELSE NULL
  END as roas,
  MIN(cm.date) as first_date,
  MAX(cm.date) as last_date
FROM ppc_campaign_metrics cm
GROUP BY cm.connection_id, cm.campaign_id, cm.campaign_name, cm.campaign_status, cm.campaign_type;

-- Geographic performance view
CREATE OR REPLACE VIEW ppc_geo_summary AS
SELECT
  gm.connection_id,
  gm.location_name,
  gm.location_type,
  SUM(gm.impressions) as total_impressions,
  SUM(gm.clicks) as total_clicks,
  micros_to_dollars(SUM(gm.cost_micros)) as total_spend,
  SUM(gm.conversions) as total_conversions,
  calc_ctr(SUM(gm.clicks)::INTEGER, SUM(gm.impressions)::INTEGER) as ctr,
  calc_cpa(SUM(gm.cost_micros), SUM(gm.conversions)) as cpa
FROM ppc_geo_metrics gm
GROUP BY gm.connection_id, gm.location_name, gm.location_type;

-- ================================================
-- Row Level Security (RLS)
-- ================================================

-- Enable RLS on all PPC tables
ALTER TABLE ppc_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppc_campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppc_keyword_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppc_geo_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppc_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppc_sync_log ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (adjust based on your auth setup)
-- These policies should be refined based on your organization/user structure

CREATE POLICY "Allow all operations on ppc_connections" ON ppc_connections
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on ppc_campaign_metrics" ON ppc_campaign_metrics
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on ppc_keyword_metrics" ON ppc_keyword_metrics
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on ppc_geo_metrics" ON ppc_geo_metrics
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on ppc_recommendations" ON ppc_recommendations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on ppc_sync_log" ON ppc_sync_log
  FOR ALL USING (true) WITH CHECK (true);
