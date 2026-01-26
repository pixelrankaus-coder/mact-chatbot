-- Helpdesk Module Database Schema
-- MACt Chatbot - Human Handoff & Support Ticket Management
-- Run this in Supabase SQL Editor

-- ============ ENUMS ============

-- Create custom types for status, priority, channel
DO $$ BEGIN
    CREATE TYPE ticket_status AS ENUM ('open', 'pending', 'snoozed', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ticket_channel AS ENUM ('webchat', 'email', 'phone', 'manual');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============ HELPDESK SETTINGS ============

CREATE TABLE IF NOT EXISTS helpdesk_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enabled BOOLEAN NOT NULL DEFAULT false,
    auto_create_tickets BOOLEAN NOT NULL DEFAULT true,
    default_priority ticket_priority NOT NULL DEFAULT 'normal',
    snooze_options INTEGER[] NOT NULL DEFAULT ARRAY[1, 4, 24, 48],
    working_hours JSONB NOT NULL DEFAULT '{
        "enabled": false,
        "timezone": "Pacific/Auckland",
        "schedule": {
            "monday": {"start": "09:00", "end": "17:00"},
            "tuesday": {"start": "09:00", "end": "17:00"},
            "wednesday": {"start": "09:00", "end": "17:00"},
            "thursday": {"start": "09:00", "end": "17:00"},
            "friday": {"start": "09:00", "end": "17:00"},
            "saturday": null,
            "sunday": null
        }
    }'::jsonb,
    notifications JSONB NOT NULL DEFAULT '{
        "email_on_new_ticket": true,
        "email_on_reply": true,
        "notification_email": null
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings row
INSERT INTO helpdesk_settings (id, enabled)
VALUES ('00000000-0000-0000-0000-000000000001', false)
ON CONFLICT (id) DO NOTHING;

-- ============ HELPDESK TAGS ============

CREATE TABLE IF NOT EXISTS helpdesk_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(7) NOT NULL DEFAULT '#6B7280', -- hex color
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default tags
INSERT INTO helpdesk_tags (name, color, description) VALUES
    ('Order Issue', '#EF4444', 'Problems with orders, missing items, wrong products'),
    ('Shipping', '#F59E0B', 'Delivery questions, tracking, delays'),
    ('Returns', '#8B5CF6', 'Return requests, refund inquiries'),
    ('Product Info', '#3B82F6', 'Questions about products, specifications'),
    ('Account', '#10B981', 'Account access, login issues'),
    ('Pricing', '#EC4899', 'Price inquiries, quotes, discounts'),
    ('Technical', '#6366F1', 'Technical support, website issues'),
    ('Complaint', '#DC2626', 'Customer complaints requiring attention')
ON CONFLICT (name) DO NOTHING;

-- ============ HELPDESK TICKETS ============

CREATE TABLE IF NOT EXISTS helpdesk_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    customer_id VARCHAR(50), -- woo_customers.id if linked
    cin7_customer_id VARCHAR(50),

    -- Ticket metadata
    status ticket_status NOT NULL DEFAULT 'open',
    priority ticket_priority NOT NULL DEFAULT 'normal',
    channel ticket_channel NOT NULL DEFAULT 'webchat',
    subject TEXT,

    -- Assignment (for future multi-agent support)
    assigned_to VARCHAR(100),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    snoozed_until TIMESTAMPTZ,
    first_response_at TIMESTAMPTZ,

    -- Metrics
    response_time_seconds INTEGER,
    resolution_time_seconds INTEGER,

    -- Internal notes (not visible to customer)
    internal_notes TEXT,

    -- Ensure one ticket per conversation
    UNIQUE(conversation_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_status ON helpdesk_tickets(status);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_priority ON helpdesk_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_created_at ON helpdesk_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_customer_id ON helpdesk_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_snoozed_until ON helpdesk_tickets(snoozed_until) WHERE snoozed_until IS NOT NULL;

-- ============ TICKET TAGS (Junction Table) ============

CREATE TABLE IF NOT EXISTS helpdesk_ticket_tags (
    ticket_id UUID NOT NULL REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES helpdesk_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (ticket_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_helpdesk_ticket_tags_ticket ON helpdesk_ticket_tags(ticket_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_ticket_tags_tag ON helpdesk_ticket_tags(tag_id);

-- ============ HELPDESK MACROS ============

CREATE TABLE IF NOT EXISTS helpdesk_macros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    shortcut VARCHAR(50), -- e.g., "/refund" for quick access
    category VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert some starter macros
INSERT INTO helpdesk_macros (name, content, shortcut, category) VALUES
    ('Greeting', 'Hi {{customer_name}}, thanks for reaching out! How can I help you today?', '/hi', 'General'),
    ('Order Status', 'I''d be happy to check on your order status. Could you please provide your order number?', '/order', 'Orders'),
    ('Shipping Delay', 'I apologize for the delay with your order. Let me look into this for you right away.', '/delay', 'Shipping'),
    ('Refund Initiated', 'I''ve initiated a refund for your order. You should see the funds back in your account within 5-7 business days.', '/refund', 'Returns'),
    ('Closing - Resolved', 'I''m glad I could help! Is there anything else you need assistance with before I close this ticket?', '/close', 'General'),
    ('Follow Up', 'Just checking in to see if you need any further assistance with this issue?', '/followup', 'General')
ON CONFLICT DO NOTHING;

-- ============ CSAT RESPONSES ============

CREATE TABLE IF NOT EXISTS helpdesk_csat_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(ticket_id) -- One response per ticket
);

-- ============ CONVERSATIONS TABLE MODIFICATIONS ============
-- Add columns to link conversations to helpdesk

-- Add helpdesk_ticket_id column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE conversations ADD COLUMN helpdesk_ticket_id UUID REFERENCES helpdesk_tickets(id);
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add needs_human flag if it doesn't exist
DO $$ BEGIN
    ALTER TABLE conversations ADD COLUMN needs_human BOOLEAN DEFAULT false;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add handed_off_at timestamp if it doesn't exist
DO $$ BEGIN
    ALTER TABLE conversations ADD COLUMN handed_off_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Index for finding conversations needing human attention
CREATE INDEX IF NOT EXISTS idx_conversations_needs_human ON conversations(needs_human) WHERE needs_human = true;

-- ============ MESSAGES TABLE MODIFICATIONS ============
-- Add agent-specific columns if needed

-- Add is_internal_note flag for agent notes not visible to customer
DO $$ BEGIN
    ALTER TABLE messages ADD COLUMN is_internal_note BOOLEAN DEFAULT false;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add agent_name for tracking which agent sent the message
DO $$ BEGIN
    ALTER TABLE messages ADD COLUMN agent_name VARCHAR(100);
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- ============ UPDATED_AT TRIGGER ============

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to helpdesk_tickets
DROP TRIGGER IF EXISTS update_helpdesk_tickets_updated_at ON helpdesk_tickets;
CREATE TRIGGER update_helpdesk_tickets_updated_at
    BEFORE UPDATE ON helpdesk_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to helpdesk_settings
DROP TRIGGER IF EXISTS update_helpdesk_settings_updated_at ON helpdesk_settings;
CREATE TRIGGER update_helpdesk_settings_updated_at
    BEFORE UPDATE ON helpdesk_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to helpdesk_macros
DROP TRIGGER IF EXISTS update_helpdesk_macros_updated_at ON helpdesk_macros;
CREATE TRIGGER update_helpdesk_macros_updated_at
    BEFORE UPDATE ON helpdesk_macros
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============ ROW LEVEL SECURITY ============

-- Enable RLS on all tables
ALTER TABLE helpdesk_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE helpdesk_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE helpdesk_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE helpdesk_ticket_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE helpdesk_macros ENABLE ROW LEVEL SECURITY;
ALTER TABLE helpdesk_csat_responses ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (single-user MVP)
-- TODO: Add proper policies when multi-user support is added

CREATE POLICY "Allow all for helpdesk_settings" ON helpdesk_settings FOR ALL USING (true);
CREATE POLICY "Allow all for helpdesk_tickets" ON helpdesk_tickets FOR ALL USING (true);
CREATE POLICY "Allow all for helpdesk_tags" ON helpdesk_tags FOR ALL USING (true);
CREATE POLICY "Allow all for helpdesk_ticket_tags" ON helpdesk_ticket_tags FOR ALL USING (true);
CREATE POLICY "Allow all for helpdesk_macros" ON helpdesk_macros FOR ALL USING (true);
CREATE POLICY "Allow all for helpdesk_csat_responses" ON helpdesk_csat_responses FOR ALL USING (true);

-- ============ REALTIME ============

-- Enable realtime for tickets (for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE helpdesk_tickets;

-- ============ SUMMARY ============
-- Tables created:
-- 1. helpdesk_settings - Module configuration (1 row)
-- 2. helpdesk_tags - Predefined tags (8 default tags)
-- 3. helpdesk_tickets - Core tickets table
-- 4. helpdesk_ticket_tags - Junction table for ticket-tag relationships
-- 5. helpdesk_macros - Quick reply templates (6 starter macros)
-- 6. helpdesk_csat_responses - Customer satisfaction ratings
--
-- Modifications to existing tables:
-- - conversations: added helpdesk_ticket_id, needs_human, handed_off_at
-- - messages: added is_internal_note, agent_name
