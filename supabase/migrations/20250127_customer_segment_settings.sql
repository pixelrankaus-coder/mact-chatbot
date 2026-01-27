-- Customer Segment Settings Table
-- Stores configurable thresholds for customer segmentation

CREATE TABLE IF NOT EXISTS customer_segment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- VIP: minimum orders OR minimum spend
  vip_min_orders INTEGER NOT NULL DEFAULT 5,
  vip_min_spend NUMERIC(10,2) NOT NULL DEFAULT 5000,

  -- Dormant: no orders in X months
  dormant_months INTEGER NOT NULL DEFAULT 12,

  -- Active: X+ orders in last Y months
  active_min_orders INTEGER NOT NULL DEFAULT 2,
  active_months INTEGER NOT NULL DEFAULT 6,

  -- New: first order within X days
  new_days INTEGER NOT NULL DEFAULT 30,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE customer_segment_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read settings
CREATE POLICY "Allow read access" ON customer_segment_settings
  FOR SELECT USING (true);

-- Allow authenticated users to insert/update settings
CREATE POLICY "Allow write access" ON customer_segment_settings
  FOR ALL USING (true);
