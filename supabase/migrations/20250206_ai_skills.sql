-- AI Agent Skills System
-- TASK: AI Agent Skills Tab - Phase 1
-- Creates tables for managing AI agent skills and their configurations

-- =====================
-- SKILLS TABLE (Master list of available skills)
-- =====================
-- This is mostly static/seed data - the catalog of all possible skills

CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,           -- Unique identifier, e.g., 'order_lookup'
  name TEXT NOT NULL,                   -- Display name, e.g., 'Order Lookup'
  description TEXT,                     -- Human-readable description
  icon_name TEXT DEFAULT 'Zap',         -- Lucide icon name
  icon_color TEXT DEFAULT 'gray',       -- Tailwind color name (blue, green, etc.)
  category TEXT DEFAULT 'integration',  -- Category grouping
  requires_integration TEXT,            -- Links to integration_settings.integration_type (null = built-in)
  capabilities TEXT[],                  -- Array of capability descriptions
  is_available BOOLEAN DEFAULT true,    -- Whether skill is ready to use
  sort_order INTEGER DEFAULT 0,         -- Display order within category
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_skills_slug ON skills(slug);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_available ON skills(is_available);

-- =====================
-- AI_SKILLS TABLE (Enabled skills and AI-specific config)
-- =====================
-- Tracks which skills are enabled for the AI agent and their configuration

CREATE TABLE IF NOT EXISTS ai_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',            -- AI-specific config (prompt hints, restrictions, etc.)
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(skill_id)                      -- Single-tenant: one config per skill
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_skills_skill_id ON ai_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_ai_skills_enabled ON ai_skills(is_enabled);

-- =====================
-- SKILL EXECUTION LOG (Optional - for analytics)
-- =====================
-- Tracks when skills are invoked by the AI

CREATE TABLE IF NOT EXISTS skill_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  input_params JSONB,                   -- Parameters passed to skill
  output_result JSONB,                  -- Result returned
  status TEXT DEFAULT 'success',        -- 'success', 'error', 'timeout'
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_skill_executions_skill_id ON skill_executions(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_executions_created_at ON skill_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_executions_status ON skill_executions(status);

-- =====================
-- ROW LEVEL SECURITY
-- =====================

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_executions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access to skills"
  ON skills FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to ai_skills"
  ON ai_skills FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to skill_executions"
  ON skill_executions FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================
-- TRIGGERS
-- =====================

-- Auto-update updated_at timestamp for ai_skills
CREATE TRIGGER update_ai_skills_updated_at
  BEFORE UPDATE ON ai_skills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================
-- SEED DATA: Skills Catalog
-- =====================

-- Category: Customer Support (Built-in)
INSERT INTO skills (slug, name, description, icon_name, icon_color, category, requires_integration, capabilities, is_available, sort_order)
VALUES
  ('order_lookup', 'Order Lookup', 'Look up customer orders by order number, email, or phone', 'Package', 'blue', 'customer_support', NULL,
   ARRAY['Search orders by order number', 'Search orders by customer email', 'Search orders by phone number', 'View order status and details'],
   true, 1),
  ('helpdesk', 'Helpdesk Tickets', 'Create and manage support tickets from chat conversations', 'Ticket', 'purple', 'customer_support', NULL,
   ARRAY['Create support tickets from chat', 'Update ticket status', 'Assign tickets to agents', 'Track ticket resolution'],
   true, 2),
  ('human_handoff', 'Human Handoff', 'Seamlessly transfer conversations to human agents', 'Users', 'green', 'customer_support', NULL,
   ARRAY['Detect when human assistance needed', 'Transfer to available agent', 'Preserve conversation context', 'Send handoff notifications'],
   true, 3)
ON CONFLICT (slug) DO NOTHING;

-- Category: E-commerce
INSERT INTO skills (slug, name, description, icon_name, icon_color, category, requires_integration, capabilities, is_available, sort_order)
VALUES
  ('woocommerce', 'WooCommerce', 'Access WooCommerce store data for orders, products, and customers', 'ShoppingCart', 'purple', 'ecommerce', 'woocommerce',
   ARRAY['Look up orders and order status', 'Search customer information', 'Check product availability', 'View order history'],
   true, 1),
  ('cin7', 'Cin7 Inventory', 'Access Cin7 inventory and order management data', 'Database', 'blue', 'ecommerce', 'cin7',
   ARRAY['Check inventory levels', 'Look up sales orders', 'Search customer data', 'View product information'],
   true, 2)
ON CONFLICT (slug) DO NOTHING;

-- Category: Marketing
INSERT INTO skills (slug, name, description, icon_name, icon_color, category, requires_integration, capabilities, is_available, sort_order)
VALUES
  ('klaviyo', 'Klaviyo Email', 'Subscribe visitors to email lists and track marketing events', 'Mail', 'green', 'marketing', 'klaviyo',
   ARRAY['Subscribe to email lists', 'Track chat events in Klaviyo', 'Segment customers', 'Trigger email flows'],
   true, 1),
  ('google_ads', 'Google Ads', 'Track conversions and optimize ad campaigns', 'TrendingUp', 'yellow', 'marketing', 'google_ads',
   ARRAY['Track chat conversions', 'Report campaign performance', 'Optimize bidding strategies'],
   false, 2)
ON CONFLICT (slug) DO NOTHING;

-- Category: Communication
INSERT INTO skills (slug, name, description, icon_name, icon_color, category, requires_integration, capabilities, is_available, sort_order)
VALUES
  ('email_notifications', 'Email Notifications', 'Send email notifications and alerts', 'Send', 'indigo', 'communication', NULL,
   ARRAY['Send order confirmations', 'Send support notifications', 'Alert team members', 'Forward important messages'],
   true, 1),
  ('sms', 'SMS Messaging', 'Send SMS notifications to customers', 'MessageSquare', 'teal', 'communication', 'twilio',
   ARRAY['Send order updates via SMS', 'Send appointment reminders', 'Two-way SMS conversations'],
   false, 2)
ON CONFLICT (slug) DO NOTHING;

-- Category: Finance (Coming Soon)
INSERT INTO skills (slug, name, description, icon_name, icon_color, category, requires_integration, capabilities, is_available, sort_order)
VALUES
  ('xero', 'Xero Accounting', 'Access Xero for invoices and payment status', 'DollarSign', 'blue', 'finance', 'xero',
   ARRAY['Check invoice status', 'Look up payment history', 'View account balance'],
   false, 1)
ON CONFLICT (slug) DO NOTHING;

-- Category: Productivity (Coming Soon)
INSERT INTO skills (slug, name, description, icon_name, icon_color, category, requires_integration, capabilities, is_available, sort_order)
VALUES
  ('calendar', 'Calendar Booking', 'Schedule appointments and manage bookings', 'Calendar', 'orange', 'productivity', 'google_calendar',
   ARRAY['Check availability', 'Book appointments', 'Send calendar invites', 'Reschedule bookings'],
   false, 1),
  ('documents', 'Document Search', 'Search and retrieve information from uploaded documents', 'FileText', 'gray', 'productivity', NULL,
   ARRAY['Search knowledge base', 'Find relevant documents', 'Extract information from PDFs'],
   false, 2)
ON CONFLICT (slug) DO NOTHING;

-- =====================
-- FUNCTIONS
-- =====================

-- Function to increment skill usage count
CREATE OR REPLACE FUNCTION increment_skill_usage(skill_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE ai_skills
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE skill_id = skill_id_param;
END;
$$ LANGUAGE plpgsql;

-- =====================
-- DEFAULT ENABLED SKILLS
-- =====================
-- Enable built-in skills by default

INSERT INTO ai_skills (skill_id, is_enabled, config)
SELECT id, true, '{}'::jsonb
FROM skills
WHERE requires_integration IS NULL AND is_available = true
ON CONFLICT (skill_id) DO NOTHING;
