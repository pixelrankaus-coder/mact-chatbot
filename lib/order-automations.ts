/**
 * Order Automation Engine
 * TASK #095: Sales Quote Follow-ups
 * TASK #096: COD Invoice Payment Follow-ups
 *
 * Manages automated email follow-up sequences for:
 * 1. Unconfirmed quotes (ESTIMATED/ESTIMATING/DRAFT status)
 * 2. Unpaid COD invoices (payment_term=COD, invoice unpaid)
 */

import { createServiceClient } from "@/lib/supabase";
import { processCampaignBatch } from "@/lib/outreach/send";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

// ============ TYPES ============

export type AutomationType = "quote_followup" | "cod_followup";

export interface OrderAutomation {
  id: string;
  order_cin7_id: string;
  order_number: string;
  automation_type: AutomationType;
  status: "active" | "paused" | "completed" | "cancelled";
  customer_email: string;
  customer_name: string;
  customer_id: string;
  next_action_date: string;
  reminder_count: number;
  max_reminders: number;
  last_reminder_at: string | null;
  last_campaign_id: string | null;
  completed_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Quote statuses that trigger follow-up (unconfirmed quotes)
const QUOTE_STATUSES = ["DRAFT", "ESTIMATED", "ESTIMATING"];

// Statuses that mean the quote was confirmed → stop follow-up
const CONFIRMED_STATUSES = [
  "ORDERING", "ORDERED", "APPROVED", "PICKING", "PACKED",
  "SHIPPED", "INVOICED", "COMPLETED", "CLOSED",
];

// Statuses that mean the quote was cancelled → stop follow-up
const CANCELLED_STATUSES = ["CANCELLED", "VOID", "VOIDED"];

// Quote follow-up schedule: template name → days after quote creation
const QUOTE_SCHEDULE: Array<{ days: number; template: string }> = [
  { days: 2, template: "quote-followup-day2" },
  { days: 4, template: "quote-followup-day4" },
  { days: 7, template: "quote-followup-day7" },
  // After day 7, weekly reminders using the weekly template
];
const QUOTE_WEEKLY_TEMPLATE = "quote-followup-weekly";
const QUOTE_WEEKLY_INTERVAL_DAYS = 7;

// COD follow-up schedule
const COD_SCHEDULE: Array<{ days: number; template: string }> = [
  { days: 1, template: "cod-followup-day1" },
  { days: 3, template: "cod-followup-day3" },
  { days: 7, template: "cod-followup-day7" },
  { days: 14, template: "cod-followup-day14" },
];

// ============ CORE FUNCTIONS ============

/**
 * Scan cin7_orders and create/update automations for qualifying orders.
 * Called by the cron job to discover new orders that need follow-up.
 */
export async function scanForNewAutomations(): Promise<{
  quotesCreated: number;
  codCreated: number;
  quotesCompleted: number;
  codCompleted: number;
}> {
  const supabase = createServiceClient() as SupabaseAny;
  let quotesCreated = 0;
  let codCreated = 0;
  let quotesCompleted = 0;
  let codCompleted = 0;

  // --- QUOTE FOLLOW-UPS ---
  // Find orders in quote status that don't have an active automation
  const { data: quoteOrders } = await supabase
    .from("cin7_orders")
    .select("cin7_id, order_number, status, customer_name, customer_email, customer_id, total, order_date, line_items")
    .in("status", QUOTE_STATUSES)
    .not("customer_email", "is", null)
    .neq("customer_email", "");

  if (quoteOrders) {
    for (const order of quoteOrders) {
      // Check if automation already exists
      const { data: existing } = await supabase
        .from("order_automations")
        .select("id")
        .eq("order_cin7_id", order.cin7_id)
        .eq("automation_type", "quote_followup")
        .single();

      if (!existing) {
        // Calculate first action date (2 days after order date)
        const orderDate = new Date(order.order_date);
        const nextAction = new Date(orderDate);
        nextAction.setDate(nextAction.getDate() + QUOTE_SCHEDULE[0].days);

        const { error } = await supabase
          .from("order_automations")
          .insert({
            order_cin7_id: order.cin7_id,
            order_number: order.order_number,
            automation_type: "quote_followup",
            status: "active",
            customer_email: order.customer_email,
            customer_name: order.customer_name || "",
            customer_id: order.customer_id || "",
            next_action_date: nextAction.toISOString(),
            metadata: {
              order_total: order.total,
              line_items: order.line_items,
            },
          });

        if (!error) quotesCreated++;
      }
    }
  }

  // Complete automations for orders that are no longer in quote status
  const { data: activeQuoteAutomations } = await supabase
    .from("order_automations")
    .select("id, order_cin7_id")
    .eq("automation_type", "quote_followup")
    .eq("status", "active");

  if (activeQuoteAutomations) {
    for (const auto of activeQuoteAutomations) {
      const { data: order } = await supabase
        .from("cin7_orders")
        .select("status")
        .eq("cin7_id", auto.order_cin7_id)
        .single();

      if (order) {
        if (CONFIRMED_STATUSES.includes(order.status)) {
          await supabase
            .from("order_automations")
            .update({ status: "completed", completed_reason: "order_confirmed", updated_at: new Date().toISOString() })
            .eq("id", auto.id);
          quotesCompleted++;
        } else if (CANCELLED_STATUSES.includes(order.status)) {
          await supabase
            .from("order_automations")
            .update({ status: "completed", completed_reason: "order_cancelled", updated_at: new Date().toISOString() })
            .eq("id", auto.id);
          quotesCompleted++;
        }
      }
    }
  }

  // --- COD INVOICE FOLLOW-UPS ---
  // Find invoiced orders with COD payment term and unpaid invoices
  const { data: codOrders } = await supabase
    .from("cin7_orders")
    .select("cin7_id, order_number, status, customer_name, customer_email, customer_id, total, invoice_number, invoice_total, invoice_paid, invoice_due_date, payment_term, line_items")
    .eq("payment_term", "COD")
    .not("invoice_total", "is", null)
    .not("customer_email", "is", null)
    .neq("customer_email", "");

  if (codOrders) {
    for (const order of codOrders) {
      // Only create for unpaid invoices
      const invoiceTotal = parseFloat(String(order.invoice_total)) || 0;
      const invoicePaid = parseFloat(String(order.invoice_paid)) || 0;
      if (invoiceTotal <= 0 || invoicePaid >= invoiceTotal) continue;

      // Check if automation already exists
      const { data: existing } = await supabase
        .from("order_automations")
        .select("id")
        .eq("order_cin7_id", order.cin7_id)
        .eq("automation_type", "cod_followup")
        .single();

      if (!existing) {
        // First action: 1 day after invoice date
        const invoiceDate = new Date(order.invoice_due_date || new Date());
        const nextAction = new Date(invoiceDate);
        nextAction.setDate(nextAction.getDate() + COD_SCHEDULE[0].days);

        const { error } = await supabase
          .from("order_automations")
          .insert({
            order_cin7_id: order.cin7_id,
            order_number: order.order_number,
            automation_type: "cod_followup",
            status: "active",
            customer_email: order.customer_email,
            customer_name: order.customer_name || "",
            customer_id: order.customer_id || "",
            next_action_date: nextAction.toISOString(),
            metadata: {
              invoice_number: order.invoice_number,
              invoice_total: invoiceTotal,
              invoice_paid: invoicePaid,
              payment_term: order.payment_term,
            },
          });

        if (!error) codCreated++;
      }
    }
  }

  // Complete COD automations where payment has been received
  const { data: activeCodAutomations } = await supabase
    .from("order_automations")
    .select("id, order_cin7_id")
    .eq("automation_type", "cod_followup")
    .eq("status", "active");

  if (activeCodAutomations) {
    for (const auto of activeCodAutomations) {
      const { data: order } = await supabase
        .from("cin7_orders")
        .select("invoice_total, invoice_paid, status")
        .eq("cin7_id", auto.order_cin7_id)
        .single();

      if (order) {
        const total = parseFloat(String(order.invoice_total)) || 0;
        const paid = parseFloat(String(order.invoice_paid)) || 0;

        if (paid >= total && total > 0) {
          await supabase
            .from("order_automations")
            .update({ status: "completed", completed_reason: "payment_received", updated_at: new Date().toISOString() })
            .eq("id", auto.id);
          codCompleted++;
        } else if (CANCELLED_STATUSES.includes(order.status)) {
          await supabase
            .from("order_automations")
            .update({ status: "completed", completed_reason: "order_cancelled", updated_at: new Date().toISOString() })
            .eq("id", auto.id);
          codCompleted++;
        }
      }
    }
  }

  return { quotesCreated, codCreated, quotesCompleted, codCompleted };
}

/**
 * Process due automations — send follow-up emails for automations where next_action_date has passed.
 */
export async function processDueAutomations(maxPerRun: number = 10): Promise<{
  processed: number;
  sent: number;
  failed: number;
  completed: number;
  results: Array<{ id: string; order_number: string; type: string; status: string; error?: string }>;
}> {
  const supabase = createServiceClient() as SupabaseAny;
  const now = new Date();
  let sent = 0;
  let failed = 0;
  let completed = 0;
  const results: Array<{ id: string; order_number: string; type: string; status: string; error?: string }> = [];

  // Fetch due automations
  const { data: dueAutomations } = await supabase
    .from("order_automations")
    .select("*")
    .eq("status", "active")
    .lte("next_action_date", now.toISOString())
    .order("next_action_date", { ascending: true })
    .limit(maxPerRun);

  if (!dueAutomations || dueAutomations.length === 0) {
    return { processed: 0, sent: 0, failed: 0, completed: 0, results: [] };
  }

  for (const auto of dueAutomations as OrderAutomation[]) {
    try {
      // Determine which template to use based on reminder count
      const templateName = getTemplateName(auto.automation_type, auto.reminder_count);

      if (!templateName) {
        // Max scheduled reminders reached
        await supabase
          .from("order_automations")
          .update({ status: "completed", completed_reason: "max_reminders", updated_at: now.toISOString() })
          .eq("id", auto.id);
        completed++;
        results.push({ id: auto.id, order_number: auto.order_number, type: auto.automation_type, status: "completed_max_reminders" });
        continue;
      }

      // Look up the template
      const { data: templates } = await supabase
        .from("outreach_templates")
        .select("id, name, subject, body")
        .eq("name", templateName)
        .limit(1);

      if (!templates || templates.length === 0) {
        console.error(`[Order Automation] Template not found: ${templateName}`);
        results.push({ id: auto.id, order_number: auto.order_number, type: auto.automation_type, status: "failed", error: `Template not found: ${templateName}` });
        failed++;
        continue;
      }

      const template = templates[0];

      // Fetch order data for personalization
      const { data: order } = await supabase
        .from("cin7_orders")
        .select("order_number, total, invoice_number, invoice_total, invoice_paid, line_items, customer_name")
        .eq("cin7_id", auto.order_cin7_id)
        .single();

      // Build personalization
      const nameParts = (auto.customer_name || "").split(" ");
      const firstLineItem = Array.isArray(order?.line_items) && order.line_items.length > 0
        ? order.line_items[0].name : "";

      const personalization = {
        first_name: nameParts[0] || "",
        last_name: nameParts.slice(1).join(" ") || "",
        company: auto.customer_name || "",
        order_number: auto.order_number || "",
        last_product: firstLineItem,
        invoice_number: order?.invoice_number || (auto.metadata as Record<string, unknown>)?.invoice_number || "",
        invoice_total: parseFloat(String(order?.invoice_total || (auto.metadata as Record<string, unknown>)?.invoice_total || 0)),
        quote_total: parseFloat(String(order?.total || 0)),
        total_spent: 0,
        order_count: 0,
      };

      // Create single-recipient campaign
      const datePrefix = now.toISOString().slice(2, 10).replace(/-/g, "").slice(0, 6);
      const campaignName = `${datePrefix}_${auto.automation_type}-${auto.order_number}_automation`;

      const { data: campaign, error: createErr } = await supabase
        .from("outreach_campaigns")
        .insert({
          name: campaignName,
          template_id: template.id,
          segment: "custom",
          segment_filter: { emails: [auto.customer_email] },
          status: "sending",
          started_at: now.toISOString(),
          total_recipients: 1,
          is_dry_run: false,
          auto_resend_enabled: false,
        })
        .select("id")
        .single();

      if (createErr || !campaign) {
        console.error(`[Order Automation] Failed to create campaign:`, createErr);
        results.push({ id: auto.id, order_number: auto.order_number, type: auto.automation_type, status: "failed", error: createErr?.message });
        failed++;
        continue;
      }

      // Create email record
      const { error: emailErr } = await supabase
        .from("outreach_emails")
        .insert({
          campaign_id: campaign.id,
          recipient_email: auto.customer_email.toLowerCase(),
          recipient_name: auto.customer_name || auto.customer_email.split("@")[0],
          personalization,
          status: "pending",
        });

      if (emailErr) {
        console.error(`[Order Automation] Failed to create email:`, emailErr);
        results.push({ id: auto.id, order_number: auto.order_number, type: auto.automation_type, status: "failed", error: emailErr.message });
        failed++;
        continue;
      }

      // Send immediately
      await processCampaignBatch(campaign.id, 1);

      // Calculate next action date
      const nextActionDate = getNextActionDate(auto.automation_type, auto.reminder_count + 1, now);

      // Update automation state
      const updateData: Record<string, unknown> = {
        reminder_count: auto.reminder_count + 1,
        last_reminder_at: now.toISOString(),
        last_campaign_id: campaign.id,
        updated_at: now.toISOString(),
      };

      if (nextActionDate) {
        updateData.next_action_date = nextActionDate.toISOString();
      } else {
        // No more scheduled actions — complete
        updateData.status = "completed";
        updateData.completed_reason = "max_reminders";
        completed++;
      }

      await supabase
        .from("order_automations")
        .update(updateData)
        .eq("id", auto.id);

      sent++;
      results.push({ id: auto.id, order_number: auto.order_number, type: auto.automation_type, status: "sent" });

      console.log(`[Order Automation] Sent ${auto.automation_type} reminder #${auto.reminder_count + 1} for ${auto.order_number} to ${auto.customer_email}`);
    } catch (err) {
      console.error(`[Order Automation] Error processing ${auto.id}:`, err);
      results.push({ id: auto.id, order_number: auto.order_number, type: auto.automation_type, status: "failed", error: err instanceof Error ? err.message : "Unknown error" });
      failed++;
    }
  }

  return { processed: dueAutomations.length, sent, failed, completed, results };
}

// ============ HELPERS ============

function getTemplateName(type: AutomationType, reminderCount: number): string | null {
  if (type === "quote_followup") {
    if (reminderCount < QUOTE_SCHEDULE.length) {
      return QUOTE_SCHEDULE[reminderCount].template;
    }
    // After scheduled reminders, use weekly template (up to max_reminders)
    return QUOTE_WEEKLY_TEMPLATE;
  }

  if (type === "cod_followup") {
    if (reminderCount < COD_SCHEDULE.length) {
      return COD_SCHEDULE[reminderCount].template;
    }
    return null; // COD has a fixed 4-step sequence, no repeat
  }

  return null;
}

function getNextActionDate(type: AutomationType, nextReminderIndex: number, from: Date): Date | null {
  if (type === "quote_followup") {
    if (nextReminderIndex < QUOTE_SCHEDULE.length) {
      // Next scheduled reminder
      const nextDate = new Date(from);
      const daysDiff = QUOTE_SCHEDULE[nextReminderIndex].days - (nextReminderIndex > 0 ? QUOTE_SCHEDULE[nextReminderIndex - 1].days : 0);
      nextDate.setDate(nextDate.getDate() + daysDiff);
      return nextDate;
    }
    // Weekly after that
    const nextDate = new Date(from);
    nextDate.setDate(nextDate.getDate() + QUOTE_WEEKLY_INTERVAL_DAYS);
    return nextDate;
  }

  if (type === "cod_followup") {
    if (nextReminderIndex < COD_SCHEDULE.length) {
      const nextDate = new Date(from);
      const daysDiff = COD_SCHEDULE[nextReminderIndex].days - (nextReminderIndex > 0 ? COD_SCHEDULE[nextReminderIndex - 1].days : 0);
      nextDate.setDate(nextDate.getDate() + daysDiff);
      return nextDate;
    }
    return null; // Done after 4 reminders
  }

  return null;
}
