-- ══════════════════════════════════════════════════════════════════════════════
-- Production Intelligence — Phase 2 Fixes
-- Priority 1 schema changes from audit
-- ══════════════════════════════════════════════════════════════════════════════

-- ── P1-1: pi_stock_projections table ─────────────────────────────────────────
-- Persisted weekly projections with risk_flag for Phase 3 material requirements

CREATE TABLE IF NOT EXISTS pi_stock_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id TEXT NOT NULL REFERENCES pi_skus(cin7_product_id),
  week_start DATE NOT NULL,
  opening_stock NUMERIC DEFAULT 0,
  inbound_qty NUMERIC DEFAULT 0,
  forecast_demand NUMERIC DEFAULT 0,
  confirmed_orders NUMERIC DEFAULT 0,
  closing_stock NUMERIC DEFAULT 0,
  safety_stock_level NUMERIC DEFAULT 0,
  risk_flag TEXT CHECK (risk_flag IN ('STOCKOUT_RISK', 'PROJECTED_STOCKOUT')),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_stock_projections_unique
  ON pi_stock_projections(sku_id, week_start);
CREATE INDEX IF NOT EXISTS idx_pi_stock_projections_risk
  ON pi_stock_projections(risk_flag) WHERE risk_flag IS NOT NULL;

ALTER TABLE pi_stock_projections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi_stock_projections_service" ON pi_stock_projections
  FOR ALL TO service_role USING (true);
CREATE POLICY "pi_stock_projections_read" ON pi_stock_projections
  FOR SELECT TO authenticated USING (true);

-- ── P1-2: Add Phase 2 columns to pi_skus ────────────────────────────────────

ALTER TABLE pi_skus ADD COLUMN IF NOT EXISTS forecast_method TEXT DEFAULT 'weighted_avg';
ALTER TABLE pi_skus ADD COLUMN IF NOT EXISTS forecast_confidence TEXT DEFAULT 'high';
ALTER TABLE pi_skus ADD COLUMN IF NOT EXISTS is_project_heavy BOOLEAN DEFAULT false;
ALTER TABLE pi_skus ADD COLUMN IF NOT EXISTS safety_stock_weeks NUMERIC DEFAULT 2.0;

-- ── P1-5: Add updated_at to pi_forecasts + auto-update trigger ──────────────

ALTER TABLE pi_forecasts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION update_pi_forecasts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pi_forecasts_updated_at ON pi_forecasts;
CREATE TRIGGER trg_pi_forecasts_updated_at
  BEFORE UPDATE ON pi_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION update_pi_forecasts_updated_at();
