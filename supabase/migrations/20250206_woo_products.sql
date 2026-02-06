-- WooCommerce Products table for storing synced products
CREATE TABLE IF NOT EXISTS woo_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  woo_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  sku TEXT,
  price TEXT,
  regular_price TEXT,
  sale_price TEXT,
  description TEXT,
  category TEXT,
  category_slug TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  stock_quantity INTEGER,
  stock_status TEXT DEFAULT 'instock',
  status TEXT DEFAULT 'publish',
  rating TEXT DEFAULT '0',
  rating_count INTEGER DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  date_created TIMESTAMPTZ,
  date_modified TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_woo_products_sku ON woo_products(sku);
CREATE INDEX IF NOT EXISTS idx_woo_products_category ON woo_products(category);
CREATE INDEX IF NOT EXISTS idx_woo_products_stock_status ON woo_products(stock_status);
CREATE INDEX IF NOT EXISTS idx_woo_products_status ON woo_products(status);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_woo_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_woo_products_updated_at ON woo_products;
CREATE TRIGGER trigger_woo_products_updated_at
  BEFORE UPDATE ON woo_products
  FOR EACH ROW
  EXECUTE FUNCTION update_woo_products_updated_at();

-- Enable RLS
ALTER TABLE woo_products ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow read access to woo_products" ON woo_products
  FOR SELECT TO authenticated USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to woo_products" ON woo_products
  FOR ALL TO service_role USING (true) WITH CHECK (true);
