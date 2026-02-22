-- Task #091: Changelog & Feature Request System
-- Database-driven changelog and feature request tracking

-- ── Changelog Entries ──
CREATE TABLE IF NOT EXISTS changelog_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL DEFAULT 'feature',
  category TEXT NOT NULL DEFAULT 'admin',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  details TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_changelog_entries_date ON changelog_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_entries_category ON changelog_entries(category, date DESC);

ALTER TABLE changelog_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "changelog_service_role" ON changelog_entries FOR ALL TO service_role USING (true);
CREATE POLICY "changelog_authenticated_read" ON changelog_entries FOR SELECT TO authenticated USING (true);

-- ── Feature Requests ──
CREATE TABLE IF NOT EXISTS feature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'feature',
  status TEXT DEFAULT 'new',
  priority TEXT DEFAULT 'normal',
  submitted_by TEXT DEFAULT '',
  admin_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON feature_requests(status, created_at DESC);

ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_requests_service_role" ON feature_requests FOR ALL TO service_role USING (true);
CREATE POLICY "feature_requests_authenticated_read" ON feature_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "feature_requests_authenticated_insert" ON feature_requests FOR INSERT TO authenticated WITH CHECK (true);
