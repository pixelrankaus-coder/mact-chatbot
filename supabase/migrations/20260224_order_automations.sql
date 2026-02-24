-- TASK #094: Extend cin7_orders with invoice/payment fields
-- TASK #095/#096: Create order_automations table for follow-up tracking

-- Add invoice/payment columns to cin7_orders
ALTER TABLE cin7_orders ADD COLUMN IF NOT EXISTS invoice_total DECIMAL(12,2);
ALTER TABLE cin7_orders ADD COLUMN IF NOT EXISTS invoice_paid DECIMAL(12,2);
ALTER TABLE cin7_orders ADD COLUMN IF NOT EXISTS invoice_due_date DATE;
ALTER TABLE cin7_orders ADD COLUMN IF NOT EXISTS invoice_status TEXT;
ALTER TABLE cin7_orders ADD COLUMN IF NOT EXISTS payment_term TEXT;

-- Order automations tracking table
CREATE TABLE IF NOT EXISTS order_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_cin7_id TEXT NOT NULL,
  order_number TEXT,
  automation_type TEXT NOT NULL CHECK (automation_type IN ('quote_followup', 'cod_followup')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_id TEXT,
  next_action_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminder_count INTEGER NOT NULL DEFAULT 0,
  max_reminders INTEGER NOT NULL DEFAULT 10,
  last_reminder_at TIMESTAMPTZ,
  last_campaign_id UUID,
  paused_by TEXT,
  paused_at TIMESTAMPTZ,
  completed_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_cin7_id, automation_type)
);

-- Indexes for efficient cron queries
CREATE INDEX IF NOT EXISTS idx_order_automations_status_next ON order_automations(status, next_action_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_order_automations_order ON order_automations(order_cin7_id);
CREATE INDEX IF NOT EXISTS idx_order_automations_type ON order_automations(automation_type);

-- Index for invoice queries (finding unpaid orders)
CREATE INDEX IF NOT EXISTS idx_cin7_orders_invoice_paid ON cin7_orders(invoice_paid, invoice_total) WHERE invoice_total IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cin7_orders_payment_term ON cin7_orders(payment_term) WHERE payment_term IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cin7_orders_status ON cin7_orders(status);

-- Default email templates for automation
INSERT INTO outreach_templates (name, subject, body) VALUES
  ('quote-followup-day2', 'Following up on your quote {{order_number}}', '<p>Hi {{first_name}},</p><p>I wanted to follow up on the quote we sent you recently ({{order_number}}).</p><p>If you have any questions about pricing, availability, or shipping, I''m happy to help. We can also adjust quantities or product selections if needed.</p><p>Just reply to this email and we''ll get back to you promptly.</p><p>Cheers,<br>The MACt Team</p>'),
  ('quote-followup-day4', 'Quick check-in: Quote {{order_number}}', '<p>Hi {{first_name}},</p><p>Just checking in regarding your quote {{order_number}} for {{last_product}}.</p><p>We''re holding stock for you, but wanted to make sure you have everything you need to move forward. If there''s anything we can clarify or if you''d like to discuss alternatives, please let us know.</p><p>Cheers,<br>The MACt Team</p>'),
  ('quote-followup-day7', 'Your quote {{order_number}} — any questions?', '<p>Hi {{first_name}},</p><p>It''s been about a week since we sent your quote ({{order_number}}). I know things get busy, so I just wanted to touch base.</p><p>If you''re still interested, we''d love to help you get your order sorted. If your requirements have changed, we''re happy to put together an updated quote.</p><p>Feel free to reply or give us a call.</p><p>Cheers,<br>The MACt Team</p>'),
  ('quote-followup-weekly', 'Still interested? Quote {{order_number}}', '<p>Hi {{first_name}},</p><p>Just a friendly reminder that your quote {{order_number}} is still available.</p><p>If you''re ready to proceed, just reply and we''ll get things moving. If your plans have changed, no worries at all — just let us know and we''ll close it off.</p><p>Cheers,<br>The MACt Team</p>'),
  ('cod-followup-day1', 'Payment confirmation: Invoice {{invoice_number}}', '<p>Hi {{first_name}},</p><p>Thank you for your recent order ({{order_number}}). Your invoice {{invoice_number}} for {{invoice_total}} is now due for payment.</p><p>As this is a COD order, please arrange payment at your earliest convenience. You can pay via bank transfer to our account details on the invoice.</p><p>If you''ve already made payment, please disregard this email.</p><p>Cheers,<br>The MACt Team</p>'),
  ('cod-followup-day3', 'Friendly reminder: Invoice {{invoice_number}} payment', '<p>Hi {{first_name}},</p><p>Just a friendly reminder that invoice {{invoice_number}} for {{invoice_total}} is still outstanding.</p><p>If you''ve already arranged payment, thank you — it may take a day or two to appear. Otherwise, please arrange payment when you can.</p><p>Cheers,<br>The MACt Team</p>'),
  ('cod-followup-day7', 'Payment overdue: Invoice {{invoice_number}}', '<p>Hi {{first_name}},</p><p>Our records show that invoice {{invoice_number}} for {{invoice_total}} remains unpaid. This invoice was due on delivery.</p><p>Please arrange payment as soon as possible. If there''s an issue or if you''d like to discuss payment terms, please get in touch.</p><p>Cheers,<br>The MACt Team</p>'),
  ('cod-followup-day14', 'Final notice: Invoice {{invoice_number}}', '<p>Hi {{first_name}},</p><p>This is a final reminder regarding invoice {{invoice_number}} for {{invoice_total}}, which is now significantly overdue.</p><p>Please arrange payment immediately or contact us to discuss your account. We value our relationship and want to resolve this promptly.</p><p>Cheers,<br>The MACt Team</p>')
ON CONFLICT DO NOTHING;
