-- TASK MACT #030: Pre-chat Form Configuration
-- Capture visitor contact info before chat starts

-- Pre-chat form config (store settings in the existing settings table)
-- We'll use key='prechat_form' in the settings table for simplicity

-- Store pre-chat data on conversations
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS prechat_data JSONB DEFAULT '{}'::jsonb;

-- Create index for faster queries on prechat data
CREATE INDEX IF NOT EXISTS idx_conversations_prechat ON conversations USING GIN (prechat_data);
