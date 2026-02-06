-- Create cin7_products table for product metadata and images
-- Cin7 doesn't store product images, so we store them here

CREATE TABLE IF NOT EXISTS cin7_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  brand TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for SKU lookups
CREATE INDEX IF NOT EXISTS idx_cin7_products_sku ON cin7_products(sku);

-- Insert some default MACt products with placeholder images
-- These can be updated with real images later
INSERT INTO cin7_products (sku, name, category, image_url) VALUES
  ('9E537_KG', 'Flowaid SCC', 'additives', '/images/products/flowaid.jpg'),
  ('ORM9E531_KG', 'Nippon ARG Fibre Glass 13mm Bundled', 'fiberglass', '/images/products/fiberglass.jpg'),
  ('224S8', 'MACt GFRC Premix - Silica Free (Grey) 1 Bag', 'gfrc-premix', '/images/products/gfrc-grey.jpg'),
  ('224S8-01', 'MACt GFRC Premix - Silica Free (White) 1 Bag', 'gfrc-premix', '/images/products/gfrc-white.jpg'),
  ('L65PX-01', 'MACt GFRC Premix - SCC Silica Free White', 'gfrc-premix', '/images/products/gfrc-scc.jpg'),
  ('9E5B7_W', 'MACt GFRC Premix - Cladding White', 'gfrc-premix', '/images/products/gfrc-cladding.jpg')
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  image_url = COALESCE(cin7_products.image_url, EXCLUDED.image_url),
  updated_at = NOW();

-- Enable RLS
ALTER TABLE cin7_products ENABLE ROW LEVEL SECURITY;

-- Allow read access for all authenticated users
CREATE POLICY "Allow read access to cin7_products" ON cin7_products
  FOR SELECT USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to cin7_products" ON cin7_products
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE cin7_products IS 'Product metadata and images for Cin7 products (since Cin7 doesnt store images)';
