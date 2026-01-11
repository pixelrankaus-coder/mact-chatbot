-- Add source_url column to knowledge_base table for URL scraping
-- Run this in Supabase SQL Editor

ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Add index for source_url lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_base_source_url ON knowledge_base(source_url);

-- Add updated_at column if it doesn't exist
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger for updated_at on knowledge_base
DROP TRIGGER IF EXISTS update_knowledge_base_updated_at ON knowledge_base;

CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
