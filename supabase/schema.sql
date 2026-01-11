-- MACt Chatbot Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- ENUM TYPES
-- =====================

CREATE TYPE conversation_status AS ENUM ('active', 'pending', 'resolved');
CREATE TYPE sender_type AS ENUM ('visitor', 'ai', 'agent');
CREATE TYPE knowledge_base_status AS ENUM ('processing', 'ready', 'error');
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'agent');

-- =====================
-- TABLES
-- =====================

-- Users table (team members)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'agent',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visitor_id TEXT NOT NULL,
  visitor_name TEXT,
  visitor_email TEXT,
  status conversation_status NOT NULL DEFAULT 'active',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type sender_type NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge base table (for AI training documents)
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  content TEXT, -- Extracted text content for AI processing
  status knowledge_base_status NOT NULL DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings table (key-value store for app settings)
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================
-- INDEXES
-- =====================

CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_visitor_id ON conversations(visitor_id);
CREATE INDEX idx_conversations_assigned_to ON conversations(assigned_to);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

CREATE INDEX idx_knowledge_base_status ON knowledge_base(status);

CREATE INDEX idx_settings_key ON settings(key);

-- =====================
-- TRIGGERS
-- =====================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================
-- ROW LEVEL SECURITY
-- =====================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (team members)
-- Note: Adjust these based on your auth setup

-- Users can read all users
CREATE POLICY "Users can view all team members"
  ON users FOR SELECT
  USING (true);

-- Conversations are viewable by all authenticated users
CREATE POLICY "Authenticated users can view conversations"
  ON conversations FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert conversations"
  ON conversations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update conversations"
  ON conversations FOR UPDATE
  USING (true);

-- Messages follow conversation access
CREATE POLICY "Users can view messages"
  ON messages FOR SELECT
  USING (true);

CREATE POLICY "Users can insert messages"
  ON messages FOR INSERT
  WITH CHECK (true);

-- Knowledge base accessible to authenticated users
CREATE POLICY "Users can view knowledge base"
  ON knowledge_base FOR SELECT
  USING (true);

CREATE POLICY "Users can manage knowledge base"
  ON knowledge_base FOR ALL
  USING (true);

-- Settings accessible to authenticated users
CREATE POLICY "Users can view settings"
  ON settings FOR SELECT
  USING (true);

CREATE POLICY "Users can manage settings"
  ON settings FOR ALL
  USING (true);

-- =====================
-- REALTIME
-- =====================

-- Enable realtime for conversations and messages
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- =====================
-- SEED DATA (Optional)
-- =====================

-- Insert default settings
INSERT INTO settings (key, value) VALUES
  ('appearance', '{
    "backgroundColor": "#1a1a2e",
    "actionColor": "#3b82f6",
    "welcomeTitle": "Hi there!",
    "welcomeSubtitle": "How can we help you today?",
    "position": "bottom-right"
  }'::jsonb),
  ('ai_agent', '{
    "enabled": true,
    "name": "MACt Assistant",
    "personality": "friendly",
    "responseLength": "balanced",
    "fallbackAction": "handoff"
  }'::jsonb),
  ('operating_hours', '{
    "enabled": true,
    "timezone": "Australia/Perth",
    "schedule": {
      "monday": {"enabled": true, "start": "09:00", "end": "17:00"},
      "tuesday": {"enabled": true, "start": "09:00", "end": "17:00"},
      "wednesday": {"enabled": true, "start": "09:00", "end": "17:00"},
      "thursday": {"enabled": true, "start": "09:00", "end": "17:00"},
      "friday": {"enabled": true, "start": "09:00", "end": "17:00"},
      "saturday": {"enabled": false},
      "sunday": {"enabled": false}
    },
    "outsideHoursBehavior": "ai-agent"
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;
