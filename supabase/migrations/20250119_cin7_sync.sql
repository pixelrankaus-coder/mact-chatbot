-- Cin7 Data Sync Tables
-- TASK MACT #032: Cin7 Data Sync to Supabase

-- Cin7 Orders Cache
CREATE TABLE IF NOT EXISTS cin7_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cin7_id TEXT UNIQUE NOT NULL,
  order_number TEXT,
  status TEXT,
  status_label TEXT,
  order_date TIMESTAMPTZ,
  customer_name TEXT,
  customer_email TEXT,
  customer_id TEXT,
  total DECIMAL(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'AUD',
  tracking_number TEXT,
  shipping_status TEXT,
  invoice_number TEXT,
  line_items JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cin7 Customers Cache
CREATE TABLE IF NOT EXISTS cin7_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cin7_id TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  fax TEXT,
  website TEXT,
  company TEXT,
  status TEXT,
  currency TEXT,
  payment_term TEXT,
  credit_limit DECIMAL(12,2),
  discount DECIMAL(5,2),
  tax_number TEXT,
  tags TEXT,
  addresses JSONB DEFAULT '[]'::jsonb,
  contacts JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync Log
CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL, -- 'cin7_orders', 'cin7_customers'
  status TEXT NOT NULL, -- 'started', 'completed', 'failed'
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

-- Indexes for orders
CREATE INDEX IF NOT EXISTS idx_cin7_orders_order_number ON cin7_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_cin7_orders_customer_name ON cin7_orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_cin7_orders_customer_id ON cin7_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_cin7_orders_status ON cin7_orders(status);
CREATE INDEX IF NOT EXISTS idx_cin7_orders_order_date ON cin7_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_cin7_orders_updated_at ON cin7_orders(updated_at DESC);

-- Indexes for customers
CREATE INDEX IF NOT EXISTS idx_cin7_customers_email ON cin7_customers(email);
CREATE INDEX IF NOT EXISTS idx_cin7_customers_name ON cin7_customers(name);
CREATE INDEX IF NOT EXISTS idx_cin7_customers_status ON cin7_customers(status);

-- Indexes for sync log
CREATE INDEX IF NOT EXISTS idx_sync_log_type_status ON sync_log(sync_type, status);
CREATE INDEX IF NOT EXISTS idx_sync_log_started_at ON sync_log(started_at DESC);

-- Full text search for orders
CREATE INDEX IF NOT EXISTS idx_cin7_orders_search ON cin7_orders
  USING GIN (to_tsvector('english', coalesce(order_number, '') || ' ' || coalesce(customer_name, '')));

-- Full text search for customers
CREATE INDEX IF NOT EXISTS idx_cin7_customers_search ON cin7_customers
  USING GIN (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '')));
