-- Cin7 Order Line Items Table
-- Stores product line items from orders for Best Selling Products analytics
-- TASK #066: Real Product Data Sync

-- =====================
-- ORDER ITEMS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS cin7_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_cin7_id TEXT NOT NULL,           -- References cin7_orders.cin7_id
  order_number TEXT,                      -- SO-XXXXX for easy reference
  order_date DATE,                        -- For date filtering
  product_id TEXT,                        -- Cin7 Product ID
  sku TEXT,                               -- Product SKU
  product_name TEXT NOT NULL,             -- Product display name
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  category TEXT,                          -- Product category if available
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_cin7_id, sku)              -- Prevent duplicates
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_cin7_order_items_order_id ON cin7_order_items(order_cin7_id);
CREATE INDEX IF NOT EXISTS idx_cin7_order_items_sku ON cin7_order_items(sku);
CREATE INDEX IF NOT EXISTS idx_cin7_order_items_order_date ON cin7_order_items(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_cin7_order_items_product_name ON cin7_order_items(product_name);

-- =====================
-- ROW LEVEL SECURITY
-- =====================
ALTER TABLE cin7_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to cin7_order_items"
  ON cin7_order_items FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================
-- PRODUCT SALES AGGREGATE VIEW
-- =====================
-- Materialized view for fast Best Selling Products queries
CREATE OR REPLACE VIEW product_sales_summary AS
SELECT
  sku,
  product_name,
  SUM(quantity) as total_units_sold,
  SUM(total_price) as total_revenue,
  COUNT(DISTINCT order_cin7_id) as order_count,
  MAX(order_date) as last_sold_date
FROM cin7_order_items
WHERE order_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY sku, product_name
ORDER BY total_units_sold DESC;
