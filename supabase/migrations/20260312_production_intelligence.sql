-- Production Intelligence Module — Phase 1: Pilot Data Sync
-- All tables prefixed pi_ to namespace cleanly from existing MACt tables

-- ── Sync Log (checkpoint + audit) ──
CREATE TABLE IF NOT EXISTS pi_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,  -- skus, sales_history, stock_snapshot, bom_items, purchase_orders
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | running | complete | failed | paused
  last_page INT DEFAULT 0,
  records_fetched INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pi_sync_log_type ON pi_sync_log(sync_type, created_at DESC);

-- ── Master SKU List ──
CREATE TABLE IF NOT EXISTS pi_skus (
  cin7_product_id TEXT PRIMARY KEY,
  sku_code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  unit_of_measure TEXT,
  std_batch_size NUMERIC,
  min_batch_size NUMERIC,
  is_pilot BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pi_skus_pilot ON pi_skus(is_pilot) WHERE is_pilot = TRUE;
CREATE INDEX IF NOT EXISTS idx_pi_skus_sku ON pi_skus(sku_code);

-- ── Sales History (daily sales by SKU) ──
CREATE TABLE IF NOT EXISTS pi_sales_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cin7_order_id TEXT NOT NULL,
  sku_id TEXT REFERENCES pi_skus(cin7_product_id),
  sku_code TEXT,
  order_date DATE NOT NULL,
  qty_sold NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC,
  line_total NUMERIC,
  channel TEXT,  -- B2B, WooCommerce, etc
  customer_name TEXT,
  is_project_order BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pi_sales_history_sku ON pi_sales_history(sku_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_pi_sales_history_date ON pi_sales_history(order_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_sales_history_unique ON pi_sales_history(cin7_order_id, sku_code);

-- ── Stock Snapshots (daily inventory position) ──
CREATE TABLE IF NOT EXISTS pi_stock_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id TEXT REFERENCES pi_skus(cin7_product_id),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  qty_on_hand NUMERIC DEFAULT 0,
  qty_available NUMERIC DEFAULT 0,
  qty_allocated NUMERIC DEFAULT 0,
  qty_on_order NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pi_stock_snapshots_sku ON pi_stock_snapshots(sku_id, snapshot_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_stock_snapshots_unique ON pi_stock_snapshots(sku_id, snapshot_date);

-- ── Bill of Materials ──
CREATE TABLE IF NOT EXISTS pi_bom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finished_sku_id TEXT REFERENCES pi_skus(cin7_product_id),
  component_sku_id TEXT,
  component_name TEXT,
  qty_per_batch NUMERIC NOT NULL DEFAULT 0,
  unit_of_measure TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pi_bom_finished ON pi_bom_items(finished_sku_id);

-- ── Purchase Orders (inbound stock) ──
CREATE TABLE IF NOT EXISTS pi_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cin7_po_id TEXT UNIQUE NOT NULL,
  po_number TEXT,
  supplier TEXT,
  status TEXT,
  order_date DATE,
  expected_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pi_purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES pi_purchase_orders(id) ON DELETE CASCADE,
  sku_code TEXT,
  sku_id TEXT,
  product_name TEXT,
  qty_ordered NUMERIC DEFAULT 0,
  qty_received NUMERIC DEFAULT 0,
  unit_price NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pi_po_lines_sku ON pi_purchase_order_lines(sku_code);

-- ── Forecasts (Phase 2 — table created now for completeness) ──
CREATE TABLE IF NOT EXISTS pi_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id TEXT REFERENCES pi_skus(cin7_product_id),
  week_start DATE NOT NULL,
  forecast_qty NUMERIC DEFAULT 0,
  override_qty NUMERIC,
  effective_qty NUMERIC GENERATED ALWAYS AS (COALESCE(override_qty, forecast_qty)) STORED,
  method TEXT DEFAULT 'weighted_avg',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_forecasts_unique ON pi_forecasts(sku_id, week_start);

-- ── Production Recommendations (Phase 4 — table created now) ──
CREATE TABLE IF NOT EXISTS pi_production_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id TEXT REFERENCES pi_skus(cin7_product_id),
  recommended_date DATE NOT NULL,
  recommended_qty NUMERIC DEFAULT 0,
  batch_count NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',  -- pending | confirmed | blocked | complete
  blocking_reason TEXT,
  is_overridden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Material Requirements (Phase 3 — table created now) ──
CREATE TABLE IF NOT EXISTS pi_material_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_sku_id TEXT,
  required_qty NUMERIC DEFAULT 0,
  available_qty NUMERIC DEFAULT 0,
  shortfall_qty NUMERIC DEFAULT 0,
  order_by_date DATE,
  week_start DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS Policies ──
ALTER TABLE pi_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pi_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE pi_sales_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pi_stock_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pi_bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pi_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pi_purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pi_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pi_production_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pi_material_requirements ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "pi_sync_log_service" ON pi_sync_log FOR ALL TO service_role USING (true);
CREATE POLICY "pi_skus_service" ON pi_skus FOR ALL TO service_role USING (true);
CREATE POLICY "pi_sales_history_service" ON pi_sales_history FOR ALL TO service_role USING (true);
CREATE POLICY "pi_stock_snapshots_service" ON pi_stock_snapshots FOR ALL TO service_role USING (true);
CREATE POLICY "pi_bom_items_service" ON pi_bom_items FOR ALL TO service_role USING (true);
CREATE POLICY "pi_purchase_orders_service" ON pi_purchase_orders FOR ALL TO service_role USING (true);
CREATE POLICY "pi_purchase_order_lines_service" ON pi_purchase_order_lines FOR ALL TO service_role USING (true);
CREATE POLICY "pi_forecasts_service" ON pi_forecasts FOR ALL TO service_role USING (true);
CREATE POLICY "pi_production_recommendations_service" ON pi_production_recommendations FOR ALL TO service_role USING (true);
CREATE POLICY "pi_material_requirements_service" ON pi_material_requirements FOR ALL TO service_role USING (true);

-- Authenticated users can read
CREATE POLICY "pi_sync_log_read" ON pi_sync_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "pi_skus_read" ON pi_skus FOR SELECT TO authenticated USING (true);
CREATE POLICY "pi_sales_history_read" ON pi_sales_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "pi_stock_snapshots_read" ON pi_stock_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "pi_bom_items_read" ON pi_bom_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "pi_purchase_orders_read" ON pi_purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "pi_purchase_order_lines_read" ON pi_purchase_order_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "pi_forecasts_read" ON pi_forecasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "pi_production_recommendations_read" ON pi_production_recommendations FOR SELECT TO authenticated USING (true);
CREATE POLICY "pi_material_requirements_read" ON pi_material_requirements FOR SELECT TO authenticated USING (true);
