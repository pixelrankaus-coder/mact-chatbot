-- Chat Ratings & Feedback
-- TASK MACT #031

-- Chat ratings table
CREATE TABLE IF NOT EXISTS chat_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id)
);

-- Add to conversations for quick access
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5),
ADD COLUMN IF NOT EXISTS rating_feedback TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_ratings_created ON chat_ratings(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_ratings_rating ON chat_ratings(rating);
CREATE INDEX IF NOT EXISTS idx_conversations_rating ON conversations(rating) WHERE rating IS NOT NULL;
