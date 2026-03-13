-- GIN index on woo_orders.line_items for fast JSONB querying
CREATE INDEX IF NOT EXISTS idx_woo_orders_line_items
  ON woo_orders USING GIN (line_items jsonb_path_ops);

-- Function to get WooCommerce sales for a SKU (supports base SKU + variant matching)
CREATE OR REPLACE FUNCTION get_woo_sales_by_sku(target_sku TEXT, max_rows INT DEFAULT 50)
RETURNS TABLE (
  order_number TEXT,
  order_date TIMESTAMPTZ,
  customer_name TEXT,
  status_label TEXT,
  sku TEXT,
  product_name TEXT,
  quantity INT,
  unit_price NUMERIC,
  total_price NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.order_number,
    o.order_date,
    o.customer_name,
    o.status_label,
    (item->>'sku')::TEXT AS sku,
    (item->>'name')::TEXT AS product_name,
    COALESCE((item->>'quantity')::int, 1) AS quantity,
    COALESCE(NULLIF(item->>'price', '')::numeric, 0) AS unit_price,
    COALESCE(NULLIF(item->>'total', '')::numeric, 0) AS total_price
  FROM woo_orders o,
    jsonb_array_elements(o.line_items) AS item
  WHERE o.line_items IS NOT NULL
    AND (item->>'sku' = target_sku OR item->>'sku' LIKE target_sku || '-%')
  ORDER BY o.order_date DESC
  LIMIT max_rows;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get ALL WooCommerce sales for stats (no limit)
CREATE OR REPLACE FUNCTION get_woo_sales_stats_by_sku(target_sku TEXT)
RETURNS TABLE (
  order_date TIMESTAMPTZ,
  quantity INT,
  total_price NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.order_date,
    COALESCE((item->>'quantity')::int, 1) AS quantity,
    COALESCE(NULLIF(item->>'total', '')::numeric, 0) AS total_price
  FROM woo_orders o,
    jsonb_array_elements(o.line_items) AS item
  WHERE o.line_items IS NOT NULL
    AND (item->>'sku' = target_sku OR item->>'sku' LIKE target_sku || '-%')
  ORDER BY o.order_date DESC;
END;
$$ LANGUAGE plpgsql STABLE;
