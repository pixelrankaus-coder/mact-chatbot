-- Add design_json column to outreach_templates for Unlayer visual builder templates
ALTER TABLE outreach_templates
  ADD COLUMN IF NOT EXISTS design_json JSONB;

COMMENT ON COLUMN outreach_templates.design_json IS 'Unlayer design JSON for visual builder templates. NULL for text-only templates.';
