-- TASK MACT #022: Agent Management System
-- Migration for agents table and related changes

-- Agents table for team members
CREATE TABLE IF NOT EXISTS agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'agent' CHECK (role IN ('owner', 'admin', 'agent')),
  is_online BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMPTZ,
  operating_hours JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Allow authenticated access (for now, allow all - can restrict later)
CREATE POLICY "Allow all operations on agents" ON agents
  FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for online status updates
ALTER PUBLICATION supabase_realtime ADD TABLE agents;

-- Add agent_id to conversations for assignment
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES agents(id);

-- Add agent_id to messages to track who sent agent messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_is_online ON agents(is_online);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_agent ON conversations(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_agent_id ON messages(agent_id);

-- Create a default owner agent (you'll need to update the email)
-- INSERT INTO agents (email, name, role, is_online)
-- VALUES ('admin@mact.au', 'Admin', 'owner', false)
-- ON CONFLICT (email) DO NOTHING;
