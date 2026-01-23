-- MACt Outreach Module - Database Schema
-- Run this in Supabase SQL Editor

-- =====================================================
-- TABLE: outreach_templates
-- =====================================================
CREATE TABLE IF NOT EXISTS outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- =====================================================
-- TABLE: outreach_campaigns
-- =====================================================
CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  template_id UUID REFERENCES outreach_templates(id) NOT NULL,
  segment VARCHAR(50) NOT NULL,
  segment_filter JSONB,

  -- Sending configuration
  from_name VARCHAR(255) DEFAULT 'Chris Born',
  from_email VARCHAR(255) DEFAULT 'c.born@mact.au',
  reply_to VARCHAR(255) DEFAULT 'replies@mact.au',

  -- Throttling
  send_rate INT DEFAULT 50,
  send_delay_ms INT DEFAULT 72000,

  -- Status
  status VARCHAR(20) DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,

  -- Counts (denormalized for performance)
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  opened_count INT DEFAULT 0,
  clicked_count INT DEFAULT 0,
  replied_count INT DEFAULT 0,
  bounced_count INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_status ON outreach_campaigns(status);

-- =====================================================
-- TABLE: outreach_emails
-- =====================================================
CREATE TABLE IF NOT EXISTS outreach_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE NOT NULL,

  -- Recipient info
  customer_id UUID,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  recipient_company VARCHAR(255),

  -- Personalization data
  personalization JSONB NOT NULL,

  -- Rendered content
  rendered_subject VARCHAR(500),
  rendered_body TEXT,

  -- Resend tracking
  resend_id VARCHAR(255),

  -- Status
  status VARCHAR(20) DEFAULT 'pending',

  -- Timestamps
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  first_opened_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  first_clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Counts
  open_count INT DEFAULT 0,
  click_count INT DEFAULT 0,

  -- Error tracking
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_emails_campaign ON outreach_emails(campaign_id);
CREATE INDEX IF NOT EXISTS idx_outreach_emails_status ON outreach_emails(status);
CREATE INDEX IF NOT EXISTS idx_outreach_emails_recipient ON outreach_emails(recipient_email);
CREATE INDEX IF NOT EXISTS idx_outreach_emails_resend ON outreach_emails(resend_id);

-- =====================================================
-- TABLE: outreach_events
-- =====================================================
CREATE TABLE IF NOT EXISTS outreach_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES outreach_emails(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE NOT NULL,

  event_type VARCHAR(50) NOT NULL,
  metadata JSONB,
  resend_event_id VARCHAR(255),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_events_email ON outreach_events(email_id);
CREATE INDEX IF NOT EXISTS idx_outreach_events_campaign ON outreach_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_outreach_events_type ON outreach_events(event_type);
CREATE INDEX IF NOT EXISTS idx_outreach_events_created ON outreach_events(created_at);

-- =====================================================
-- TABLE: outreach_replies
-- =====================================================
CREATE TABLE IF NOT EXISTS outreach_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES outreach_emails(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE,

  -- Reply content
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  subject VARCHAR(500),
  body_text TEXT,
  body_html TEXT,

  -- Processing
  forwarded_to VARCHAR(255),
  forwarded_at TIMESTAMPTZ,

  -- Status
  status VARCHAR(20) DEFAULT 'new',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_replies_campaign ON outreach_replies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_outreach_replies_status ON outreach_replies(status);

-- =====================================================
-- TABLE: outreach_settings
-- =====================================================
CREATE TABLE IF NOT EXISTS outreach_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Default sending identity
  default_from_name VARCHAR(255) DEFAULT 'Chris Born',
  default_from_email VARCHAR(255) DEFAULT 'c.born@mact.au',
  default_reply_to VARCHAR(255) DEFAULT 'replies@mact.au',

  -- Forwarding
  forward_replies_to VARCHAR(255) DEFAULT 'c.born@mact.au',
  forward_replies BOOLEAN DEFAULT true,

  -- Rate limits
  max_emails_per_hour INT DEFAULT 50,
  max_emails_per_day INT DEFAULT 500,

  -- Tracking
  track_opens BOOLEAN DEFAULT true,
  track_clicks BOOLEAN DEFAULT false,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings (only if not exists)
INSERT INTO outreach_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM outreach_settings);

-- =====================================================
-- FUNCTIONS: Counter Increments
-- =====================================================

CREATE OR REPLACE FUNCTION increment_campaign_sent(p_campaign_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE outreach_campaigns
  SET sent_count = sent_count + 1, updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_campaign_delivered(p_campaign_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE outreach_campaigns
  SET delivered_count = delivered_count + 1, updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_campaign_opened(p_campaign_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE outreach_campaigns
  SET opened_count = opened_count + 1, updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_campaign_clicked(p_campaign_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE outreach_campaigns
  SET clicked_count = clicked_count + 1, updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_campaign_replied(p_campaign_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE outreach_campaigns
  SET replied_count = replied_count + 1, updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_campaign_bounced(p_campaign_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE outreach_campaigns
  SET bounced_count = bounced_count + 1, updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SEED: Default Templates
-- =====================================================

INSERT INTO outreach_templates (name, subject, body, variables) VALUES
(
  'Personal Check-in',
  'Quick question about your {{last_product}} project',
  E'Hi {{first_name}},\n\nIt''s been a while since you grabbed that {{last_product}}. I''d love to know how that project turned out!\n\nStill working with GFRC? Happy to help if you need anything.\n\nCheers,\nChris\nMACt / MFR Panels\n0400 xxx xxx',
  '["first_name", "last_product"]'::jsonb
),
(
  'Win-back with Offer',
  '{{first_name}}, we''ve got something for you',
  E'Hi {{first_name}},\n\nIt''s been {{days_since_order}} days since your last order with us. I wanted to reach out personally to see how things are going.\n\nIf you''re planning any upcoming GFRC projects, I''ve set aside a 10% discount just for you. Just mention this email when you order.\n\nAny questions? Just hit reply — comes straight to me.\n\nCheers,\nChris\nMACt / MFR Panels',
  '["first_name", "days_since_order"]'::jsonb
),
(
  'VIP Thank You',
  'Thanks for being one of our best customers',
  E'Hi {{first_name}},\n\nI just wanted to reach out personally to say thanks. You''ve spent {{total_spent}} with us over {{order_count}} orders — that makes you one of our most valued customers.\n\nIs there anything we could be doing better? Any products you''d like us to stock? I''d love to hear your thoughts.\n\nCheers,\nChris\nMACt / MFR Panels',
  '["first_name", "total_spent", "order_count"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- Enable RLS (Row Level Security) - Optional
-- =====================================================
-- ALTER TABLE outreach_templates ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE outreach_campaigns ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE outreach_emails ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE outreach_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE outreach_replies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE outreach_settings ENABLE ROW LEVEL SECURITY;

-- Note: Add appropriate RLS policies based on your auth requirements
