-- Add typing_status table for real-time typing indicators
-- Run this in your Supabase SQL Editor

-- Create typing_status table
CREATE TABLE IF NOT EXISTS typing_status (
  conversation_id UUID PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  is_visitor_typing BOOLEAN DEFAULT false,
  is_agent_typing BOOLEAN DEFAULT false,
  visitor_typing_at TIMESTAMPTZ,
  agent_typing_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_typing_status_conversation ON typing_status(conversation_id);

-- Enable RLS
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;

-- Policy for typing status (allow all operations for now)
CREATE POLICY "Allow all typing status operations"
  ON typing_status FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime for typing_status
ALTER PUBLICATION supabase_realtime ADD TABLE typing_status;

-- Auto-update updated_at timestamp
CREATE TRIGGER update_typing_status_updated_at
  BEFORE UPDATE ON typing_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
