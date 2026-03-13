-- ══════════════════════════════════════════════════════════════════════════════
-- Fix: Add missing columns to pi_material_requirements
-- The Phase 3 migration used CREATE TABLE IF NOT EXISTS which silently skipped
-- because Phase 2 already created the table with fewer columns.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE pi_material_requirements
  ADD COLUMN IF NOT EXISTS order_qty NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS urgency_flag TEXT CHECK (urgency_flag IN ('OVERDUE', 'URGENT', 'UPCOMING', 'OK')),
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES pi_suppliers(id),
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC,
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT NOW();

-- Add indexes that Phase 3 migration would have created
CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_material_requirements_unique
  ON pi_material_requirements(component_sku_id, week_start);
CREATE INDEX IF NOT EXISTS idx_pi_material_requirements_urgency
  ON pi_material_requirements(urgency_flag) WHERE urgency_flag IN ('OVERDUE', 'URGENT');
CREATE INDEX IF NOT EXISTS idx_pi_material_requirements_order_by
  ON pi_material_requirements(order_by_date);
