-- Dynamic Segments + Contacts table for Klaviyo replacement
-- Created: 2026-03-09

-- ============================================================
-- CONTACTS: Non-Cin7/Non-Woo contacts (Klaviyo imports, manual adds, leads)
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  phone TEXT,
  source TEXT DEFAULT 'manual',           -- "klaviyo_import", "manual", "website_form", "chatbot"
  tags TEXT[] DEFAULT '{}',               -- ["architect", "newsletter"]
  is_subscribed BOOLEAN DEFAULT true,
  unsubscribed_at TIMESTAMPTZ,
  -- Link to existing customer records if matched
  cin7_customer_id TEXT,                  -- FK to cin7_customers.cin7_id
  woo_customer_id TEXT,                   -- FK to woo_customers.woo_id
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts(source);
CREATE INDEX IF NOT EXISTS idx_contacts_subscribed ON contacts(is_subscribed);
CREATE INDEX IF NOT EXISTS idx_contacts_cin7_id ON contacts(cin7_customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_woo_id ON contacts(woo_customer_id);

-- ============================================================
-- SEGMENTS: Dynamic (rule-based) and Static (member list) segments
-- ============================================================
CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'dynamic',   -- "dynamic" (query-based) or "static" (manual/imported list)
  -- Dynamic rules: array of {field, operator, value} objects
  rules JSONB NOT NULL DEFAULT '[]',
  -- Which data sources to query
  source TEXT DEFAULT 'all',              -- "all", "cin7", "woocommerce", "contacts"
  -- Cached member count (refreshed on demand)
  cached_count INT DEFAULT 0,
  cached_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_segments_slug ON segments(slug);
CREATE INDEX IF NOT EXISTS idx_segments_active ON segments(is_active);

-- ============================================================
-- SEGMENT_MEMBERS: For static segments (Klaviyo imports, manual lists)
-- ============================================================
CREATE TABLE IF NOT EXISTS segment_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  metadata JSONB DEFAULT '{}',
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(segment_id, email)
);

CREATE INDEX IF NOT EXISTS idx_segment_members_segment ON segment_members(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_members_email ON segment_members(email);

-- ============================================================
-- SEED: Default dynamic segments matching existing hardcoded ones
-- ============================================================
INSERT INTO segments (name, slug, description, type, rules, source) VALUES
  (
    'All Customers',
    'all-customers',
    'Everyone with an email address',
    'dynamic',
    '[]',
    'all'
  ),
  (
    'Dormant Customers',
    'dormant',
    'No order in 12+ months (must have ordered before)',
    'dynamic',
    '[{"field": "days_since_order", "operator": "gt", "value": 365}, {"field": "order_count", "operator": "gt", "value": 0}]',
    'all'
  ),
  (
    'VIP Customers',
    'vip',
    'Spent $5,000+ or 5+ orders',
    'dynamic',
    '[{"field": "total_spent", "operator": "gte", "value": 5000}]',
    'all'
  ),
  (
    'Active Customers',
    'active',
    'Ordered within last 12 months',
    'dynamic',
    '[{"field": "days_since_order", "operator": "lte", "value": 365}, {"field": "order_count", "operator": "gt", "value": 0}]',
    'all'
  ),
  (
    'New Customers (30 days)',
    'new-customers-30d',
    'First order in the last 30 days',
    'dynamic',
    '[{"field": "days_since_order", "operator": "lte", "value": 30}, {"field": "order_count", "operator": "eq", "value": 1}]',
    'all'
  ),
  (
    'Repeat Buyers (3+)',
    'repeat-buyers',
    'Customers with 3 or more orders',
    'dynamic',
    '[{"field": "order_count", "operator": "gte", "value": 3}]',
    'all'
  )
ON CONFLICT (slug) DO NOTHING;
