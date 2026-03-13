-- Add cin7_supplier_id to pi_suppliers for Cin7 import deduplication
ALTER TABLE pi_suppliers ADD COLUMN IF NOT EXISTS cin7_supplier_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS pi_suppliers_cin7_id_idx ON pi_suppliers(cin7_supplier_id) WHERE cin7_supplier_id IS NOT NULL;
