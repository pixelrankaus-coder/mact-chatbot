-- Cin7 Inventory Sync: Extend products table, add stock & locations
-- Migration date: 2026-03-10

-- ─── Extend cin7_products with inventory fields ──────────────────────────────

ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS cin7_id TEXT UNIQUE;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS type TEXT;                    -- Service, Stock, Non-Inventory
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS costing_method TEXT;          -- FIFO, Average, etc.
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS default_location TEXT;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS weight_units TEXT;            -- kg, lb, etc.
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS length NUMERIC DEFAULT 0;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS width NUMERIC DEFAULT 0;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS height NUMERIC DEFAULT 0;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS dimensions_units TEXT;        -- cm, in, etc.
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS uom TEXT;                     -- Unit of measure (Each, kg, m, etc.)
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS sellable BOOLEAN DEFAULT true;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS cin7_status TEXT;             -- Active, Deprecated, etc.
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS average_cost NUMERIC DEFAULT 0;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS price_tier_1 NUMERIC DEFAULT 0;  -- RRP
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS price_tier_2 NUMERIC DEFAULT 0;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS price_tier_3 NUMERIC DEFAULT 0;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS price_tiers JSONB;               -- Full named tiers object
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS min_before_reorder NUMERIC DEFAULT 0;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS reorder_quantity NUMERIC DEFAULT 0;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS carton_height NUMERIC;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS carton_width NUMERIC;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS carton_length NUMERIC;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS carton_quantity NUMERIC;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS hs_code TEXT;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS country_of_origin TEXT;
ALTER TABLE cin7_products ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Index for cin7_id lookups
CREATE INDEX IF NOT EXISTS idx_cin7_products_cin7_id ON cin7_products(cin7_id);
CREATE INDEX IF NOT EXISTS idx_cin7_products_cin7_status ON cin7_products(cin7_status);

-- ─── cin7_locations ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cin7_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cin7_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_deprecated BOOLEAN DEFAULT false,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cin7_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to cin7_locations" ON cin7_locations FOR SELECT USING (true);
CREATE POLICY "Allow service role full access to cin7_locations" ON cin7_locations USING (true) WITH CHECK (true);

-- ─── cin7_product_stock (per-location stock levels) ─────────────────────────

CREATE TABLE IF NOT EXISTS cin7_product_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cin7_product_id TEXT NOT NULL,               -- Cin7 product ID (links to cin7_products.cin7_id)
  sku TEXT NOT NULL,
  product_name TEXT,
  location TEXT NOT NULL,                       -- Location name from Cin7
  bin TEXT,
  on_hand NUMERIC DEFAULT 0,
  allocated NUMERIC DEFAULT 0,
  available NUMERIC DEFAULT 0,
  on_order NUMERIC DEFAULT 0,
  stock_on_hand NUMERIC DEFAULT 0,             -- Total stock value
  in_transit NUMERIC DEFAULT 0,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cin7_product_id, location)
);

CREATE INDEX IF NOT EXISTS idx_cin7_product_stock_sku ON cin7_product_stock(sku);
CREATE INDEX IF NOT EXISTS idx_cin7_product_stock_location ON cin7_product_stock(location);
CREATE INDEX IF NOT EXISTS idx_cin7_product_stock_product_id ON cin7_product_stock(cin7_product_id);

ALTER TABLE cin7_product_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to cin7_product_stock" ON cin7_product_stock FOR SELECT USING (true);
CREATE POLICY "Allow service role full access to cin7_product_stock" ON cin7_product_stock USING (true) WITH CHECK (true);

COMMENT ON TABLE cin7_locations IS 'Warehouse/location data from Cin7';
COMMENT ON TABLE cin7_product_stock IS 'Per-location stock levels from Cin7 ProductAvailability API';
