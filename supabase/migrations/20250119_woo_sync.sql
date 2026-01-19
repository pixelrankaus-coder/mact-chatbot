-- WooCommerce Data Sync Tables
-- TASK MACT #034: WooCommerce Data Sync to Supabase

-- WooCommerce Orders Cache
CREATE TABLE IF NOT EXISTS woo_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  woo_id INTEGER UNIQUE NOT NULL,
  order_number TEXT,
  status TEXT,
  status_label TEXT,
  order_date TIMESTAMPTZ,
  customer_name TEXT,
  customer_email TEXT,
  customer_id INTEGER,
  total DECIMAL(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'AUD',
  tracking_number TEXT,
  tracking_provider TEXT,
  tracking_url TEXT,
  shipping_total DECIMAL(12,2) DEFAULT 0,
  payment_method TEXT,
  billing_address JSONB DEFAULT '{}'::jsonb,
  shipping_address JSONB DEFAULT '{}'::jsonb,
  line_items JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WooCommerce Customers Cache
CREATE TABLE IF NOT EXISTS woo_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  woo_id INTEGER UNIQUE NOT NULL,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  phone TEXT,
  company TEXT,
  billing_address JSONB DEFAULT '{}'::jsonb,
  shipping_address JSONB DEFAULT '{}'::jsonb,
  orders_count INTEGER DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  avatar_url TEXT,
  date_created TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update sync_log comment to include woo types
COMMENT ON COLUMN sync_log.sync_type IS 'cin7_orders, cin7_customers, woo_orders, woo_customers';

-- Indexes for WooCommerce orders
CREATE INDEX IF NOT EXISTS idx_woo_orders_order_number ON woo_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_woo_orders_customer_name ON woo_orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_woo_orders_customer_email ON woo_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_woo_orders_customer_id ON woo_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_woo_orders_status ON woo_orders(status);
CREATE INDEX IF NOT EXISTS idx_woo_orders_order_date ON woo_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_woo_orders_updated_at ON woo_orders(updated_at DESC);

-- Indexes for WooCommerce customers
CREATE INDEX IF NOT EXISTS idx_woo_customers_email ON woo_customers(email);
CREATE INDEX IF NOT EXISTS idx_woo_customers_name ON woo_customers(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_woo_customers_username ON woo_customers(username);

-- Full text search for WooCommerce orders
CREATE INDEX IF NOT EXISTS idx_woo_orders_search ON woo_orders
  USING GIN (to_tsvector('english', coalesce(order_number, '') || ' ' || coalesce(customer_name, '') || ' ' || coalesce(customer_email, '')));

-- Full text search for WooCommerce customers
CREATE INDEX IF NOT EXISTS idx_woo_customers_search ON woo_customers
  USING GIN (to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(email, '')));
