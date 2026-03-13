-- ══════════════════════════════════════════════════════════════════════════════
-- Production Intelligence — Phase 3: Materials Requirements Engine
-- Creates pi_suppliers, pi_material_suppliers, pi_material_requirements
-- ══════════════════════════════════════════════════════════════════════════════

-- ── pi_suppliers ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pi_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pi_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi_suppliers_service" ON pi_suppliers
  FOR ALL TO service_role USING (true);
CREATE POLICY "pi_suppliers_read" ON pi_suppliers
  FOR SELECT TO authenticated USING (true);

-- ── pi_material_suppliers ────────────────────────────────────────────────────
-- Links raw material SKUs to suppliers with lead time, MOQ, cost

CREATE TABLE IF NOT EXISTS pi_material_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES pi_suppliers(id) ON DELETE CASCADE,
  is_preferred BOOLEAN DEFAULT true,
  lead_time_days INTEGER NOT NULL DEFAULT 14,
  moq NUMERIC,
  order_multiple NUMERIC,
  unit_cost NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_material_suppliers_unique
  ON pi_material_suppliers(sku_id, supplier_id);

ALTER TABLE pi_material_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi_material_suppliers_service" ON pi_material_suppliers
  FOR ALL TO service_role USING (true);
CREATE POLICY "pi_material_suppliers_read" ON pi_material_suppliers
  FOR SELECT TO authenticated USING (true);

-- ── pi_material_requirements ─────────────────────────────────────────────────
-- MRP output: per-component, per-week material requirements

CREATE TABLE IF NOT EXISTS pi_material_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_sku_id TEXT NOT NULL,
  week_start DATE NOT NULL,
  required_qty NUMERIC DEFAULT 0,
  available_qty NUMERIC DEFAULT 0,
  shortfall_qty NUMERIC DEFAULT 0,
  order_qty NUMERIC DEFAULT 0,
  order_by_date DATE,
  urgency_flag TEXT CHECK (urgency_flag IN ('OVERDUE', 'URGENT', 'UPCOMING', 'OK')),
  supplier_id UUID REFERENCES pi_suppliers(id),
  estimated_cost NUMERIC,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_material_requirements_unique
  ON pi_material_requirements(component_sku_id, week_start);
CREATE INDEX IF NOT EXISTS idx_pi_material_requirements_urgency
  ON pi_material_requirements(urgency_flag) WHERE urgency_flag IN ('OVERDUE', 'URGENT');
CREATE INDEX IF NOT EXISTS idx_pi_material_requirements_order_by
  ON pi_material_requirements(order_by_date);

ALTER TABLE pi_material_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi_material_requirements_service" ON pi_material_requirements
  FOR ALL TO service_role USING (true);
CREATE POLICY "pi_material_requirements_read" ON pi_material_requirements
  FOR SELECT TO authenticated USING (true);
