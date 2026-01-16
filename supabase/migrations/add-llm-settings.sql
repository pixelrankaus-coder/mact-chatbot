-- TASK MACT #022: Multi-LLM Provider Support
-- Migration for LLM settings table

-- LLM provider settings
CREATE TABLE IF NOT EXISTS llm_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id TEXT DEFAULT 'default' UNIQUE,
  provider TEXT NOT NULL DEFAULT 'openai' CHECK (provider IN ('openai', 'anthropic', 'deepseek')),
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  temperature DECIMAL(2,1) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE llm_settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations (adjust for production)
CREATE POLICY "Allow all operations on llm_settings" ON llm_settings
  FOR ALL USING (true) WITH CHECK (true);

-- Insert default settings
INSERT INTO llm_settings (store_id, provider, model, temperature, max_tokens)
VALUES ('default', 'openai', 'gpt-4o-mini', 0.7, 1000)
ON CONFLICT (store_id) DO NOTHING;
