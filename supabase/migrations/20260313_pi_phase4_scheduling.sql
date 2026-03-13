-- ══════════════════════════════════════════════════════════════════════════════
-- Production Intelligence — Phase 4: Production Scheduling
-- Creates pi_scheduling_rules, pi_production_schedule + seeds default rules
-- ══════════════════════════════════════════════════════════════════════════════

-- ── pi_scheduling_rules ─────────────────────────────────────────────────────
-- Configurable rules: no-production days, batch capacity, sequencing, etc.

CREATE TABLE IF NOT EXISTS pi_scheduling_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL,
  sku_id TEXT,                          -- nullable = applies to all SKUs
  value_text TEXT,
  value_numeric NUMERIC,
  value_boolean BOOLEAN,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pi_scheduling_rules_type
  ON pi_scheduling_rules(rule_type) WHERE is_active = true;

ALTER TABLE pi_scheduling_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi_scheduling_rules_service" ON pi_scheduling_rules
  FOR ALL TO service_role USING (true);
CREATE POLICY "pi_scheduling_rules_read" ON pi_scheduling_rules
  FOR SELECT TO authenticated USING (true);

-- ── Seed default scheduling rules ──────────────────────────────────────────

INSERT INTO pi_scheduling_rules (rule_type, value_text, description)
VALUES
  ('no_production_day', 'Saturday', 'No production on Saturdays'),
  ('no_production_day', 'Sunday', 'No production on Sundays');

INSERT INTO pi_scheduling_rules (rule_type, value_numeric, description)
VALUES
  ('daily_batch_capacity', 8, 'Maximum 8 batches per production day'),
  ('changeover_penalty', 1, 'Grey-to-white changeover costs 1 batch slot'),
  ('max_days_ahead', 14, 'Schedule up to 14 days ahead');

INSERT INTO pi_scheduling_rules (rule_type, value_text, description)
VALUES
  ('sequence_before', 'white', 'White products run before grey on same day');

-- ── pi_production_schedule ─────────────────────────────────────────────────
-- Daily production runs: what to make, when, in what order

CREATE TABLE IF NOT EXISTS pi_production_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  recommended_qty NUMERIC NOT NULL,
  confirmed_qty NUMERIC,               -- staff override, null = use recommended
  batch_count NUMERIC NOT NULL,
  sequence_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'in_progress', 'complete', 'blocked', 'cancelled')),
  blocking_reason TEXT,
  blocking_sku_id TEXT,
  notes TEXT,
  confirmed_by TEXT,
  completed_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one pending run per SKU per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_schedule_sku_date_pending
  ON pi_production_schedule(sku_id, scheduled_date)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_pi_schedule_date
  ON pi_production_schedule(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_pi_schedule_status
  ON pi_production_schedule(status);

ALTER TABLE pi_production_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi_production_schedule_service" ON pi_production_schedule
  FOR ALL TO service_role USING (true);
CREATE POLICY "pi_production_schedule_auth" ON pi_production_schedule
  FOR ALL TO authenticated USING (true);
