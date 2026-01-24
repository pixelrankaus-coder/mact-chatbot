-- Migration: Add signature_json to outreach_settings for Unlayer editor
-- TASK MACT #056: Integrate Unlayer Email Editor

-- Add signature_json column to store Unlayer design JSON
ALTER TABLE outreach_settings
ADD COLUMN IF NOT EXISTS signature_json JSONB DEFAULT NULL;
