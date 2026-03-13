/**
 * Production Intelligence — Production Scheduling Engine
 *
 * Generates a daily production schedule for the next N days based on:
 *   1. Stock projections — which SKUs are at risk?
 *   2. Urgency — weeks of cover (lowest first)
 *   3. Sequencing rules — white before grey, changeover penalties
 *   4. Capacity constraints — max batches per day
 *   5. Material availability — flag blocked runs
 *
 * Pipeline position: runs after MRP engine in nightly cron.
 */

import { createServiceClient } from "@/lib/supabase";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ScheduledRun {
  sku_id: string;
  sku_code: string;
  sku_name: string;
  category: string | null;
  scheduled_date: string;
  recommended_qty: number;
  batch_count: number;
  sequence_order: number;
  status: "pending" | "blocked";
  blocking_reason: string | null;
  blocking_sku_id: string | null;
}

interface SchedulingRules {
  noProductionDays: Set<string>; // "Saturday", "Sunday"
  dailyBatchCapacity: number;
  sequenceBefore: string | null; // category that runs first
  changeoverPenalty: number; // extra slots for category switch
  maxDaysAhead: number;
  prioritySkus: Set<string>; // sku_ids flagged as priority
  minBatchSizes: Map<string, number>; // sku_id → min batch override
}

interface SkuNeed {
  sku_id: string;
  sku_code: string;
  name: string;
  category: string | null;
  std_batch_size: number;
  production_required: number; // units needed
  weeks_of_cover: number;
  is_priority: boolean;
}

// ─── Day name lookup ────────────────────────────────────────────────────────

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── Step 0: Load scheduling rules from DB ──────────────────────────────────

async function loadRules(
  supabase: ReturnType<typeof createServiceClient>
): Promise<SchedulingRules> {
  const { data: rules } = await supabase
    .from("pi_scheduling_rules")
    .select("rule_type, sku_id, value_text, value_numeric, value_boolean")
    .eq("is_active", true);

  const result: SchedulingRules = {
    noProductionDays: new Set(),
    dailyBatchCapacity: 8,
    sequenceBefore: null,
    changeoverPenalty: 0,
    maxDaysAhead: 14,
    prioritySkus: new Set(),
    minBatchSizes: new Map(),
  };

  for (const r of rules || []) {
    switch (r.rule_type) {
      case "no_production_day":
        if (r.value_text) result.noProductionDays.add(r.value_text);
        break;
      case "daily_batch_capacity":
        if (r.value_numeric != null) result.dailyBatchCapacity = Number(r.value_numeric);
        break;
      case "sequence_before":
        result.sequenceBefore = r.value_text;
        break;
      case "changeover_penalty":
        if (r.value_numeric != null) result.changeoverPenalty = Number(r.value_numeric);
        break;
      case "max_days_ahead":
        if (r.value_numeric != null) result.maxDaysAhead = Number(r.value_numeric);
        break;
      case "priority_sku":
        if (r.sku_id && r.value_boolean) result.prioritySkus.add(r.sku_id);
        break;
      case "min_batch_size":
        if (r.sku_id && r.value_numeric != null)
          result.minBatchSizes.set(r.sku_id, Number(r.value_numeric));
        break;
    }
  }

  return result;
}

// ─── Step 1: Determine what needs to be produced ────────────────────────────

async function getProductionNeeds(
  supabase: ReturnType<typeof createServiceClient>,
  rules: SchedulingRules
): Promise<SkuNeed[]> {
  // Get at-risk projections from pi_stock_projections
  const { data: projections } = await supabase
    .from("pi_stock_projections")
    .select("sku_id, week_start, closing_stock, safety_stock_level, risk_flag")
    .not("risk_flag", "is", null)
    .order("week_start", { ascending: true });

  if (!projections || projections.length === 0) return [];

  // Get pilot SKU details
  const atRiskSkuIds = [...new Set(projections.map((p) => p.sku_id))];
  const { data: skus } = await supabase
    .from("pi_skus")
    .select("cin7_product_id, sku_code, name, std_batch_size, category")
    .in("cin7_product_id", atRiskSkuIds);

  if (!skus || skus.length === 0) return [];

  const skuMap = new Map(skus.map((s) => [s.cin7_product_id, s]));

  // Group projections by SKU — find worst closing stock across all weeks
  const skuWorst = new Map<
    string,
    { minClosing: number; safetyStock: number; firstRiskWeek: number }
  >();

  const allWeeks = [...new Set(projections.map((p) => p.week_start))].sort();

  for (const p of projections) {
    const existing = skuWorst.get(p.sku_id);
    const weekIndex = allWeeks.indexOf(p.week_start);
    if (
      !existing ||
      p.closing_stock < existing.minClosing
    ) {
      skuWorst.set(p.sku_id, {
        minClosing: p.closing_stock,
        safetyStock: p.safety_stock_level || 0,
        firstRiskWeek: existing
          ? Math.min(existing.firstRiskWeek, weekIndex)
          : weekIndex,
      });
    }
  }

  // Calculate production needs
  const needs: SkuNeed[] = [];

  for (const [skuId, worst] of skuWorst) {
    const sku = skuMap.get(skuId);
    if (!sku) continue;

    const batchSize = sku.std_batch_size || 1;

    // Production required = bring stock above safety level
    const deficit = worst.safetyStock - worst.minClosing;
    if (deficit <= 0) continue;

    // Round up to batch size
    const minBatch = rules.minBatchSizes.get(skuId) ?? batchSize;
    const productionRequired =
      Math.ceil(deficit / minBatch) * minBatch;

    needs.push({
      sku_id: skuId,
      sku_code: sku.sku_code,
      name: sku.name,
      category: sku.category,
      std_batch_size: batchSize,
      production_required: productionRequired,
      weeks_of_cover: worst.firstRiskWeek,
      is_priority: rules.prioritySkus.has(skuId),
    });
  }

  return needs;
}

// ─── Step 2: Sort by urgency ────────────────────────────────────────────────

function sortByUrgency(
  needs: SkuNeed[],
  sequenceBefore: string | null
): SkuNeed[] {
  return [...needs].sort((a, b) => {
    // 1. Priority SKUs first
    if (a.is_priority !== b.is_priority) return a.is_priority ? -1 : 1;

    // 2. Weeks of cover ascending (most urgent first)
    if (a.weeks_of_cover !== b.weeks_of_cover)
      return a.weeks_of_cover - b.weeks_of_cover;

    // 3. Sequence rule: preferred category first
    if (sequenceBefore) {
      const aMatch = a.category?.toLowerCase() === sequenceBefore.toLowerCase();
      const bMatch = b.category?.toLowerCase() === sequenceBefore.toLowerCase();
      if (aMatch !== bMatch) return aMatch ? -1 : 1;
    }

    return 0;
  });
}

// ─── Step 3: Assign to production days ──────────────────────────────────────

function getAvailableDays(
  rules: SchedulingRules,
  startDate: Date
): string[] {
  const days: string[] = [];
  const d = new Date(startDate);

  for (let i = 0; i < rules.maxDaysAhead + 14; i++) {
    // extra buffer
    d.setDate(d.getDate() + 1);
    const dayName = DAY_NAMES[d.getDay()];
    if (!rules.noProductionDays.has(dayName)) {
      days.push(formatDate(d));
    }
    if (days.length >= rules.maxDaysAhead) break;
  }

  return days;
}

interface DaySlot {
  date: string;
  remainingSlots: number;
  lastCategory: string | null;
  runs: ScheduledRun[];
}

function assignToDays(
  sortedNeeds: SkuNeed[],
  availableDays: string[],
  rules: SchedulingRules
): ScheduledRun[] {
  const daySlots: DaySlot[] = availableDays.map((date) => ({
    date,
    remainingSlots: rules.dailyBatchCapacity,
    lastCategory: null,
    runs: [],
  }));

  const allRuns: ScheduledRun[] = [];

  for (const need of sortedNeeds) {
    let remainingQty = need.production_required;
    const batchSize = need.std_batch_size;

    for (const day of daySlots) {
      if (remainingQty <= 0) break;
      if (day.remainingSlots <= 0) continue;

      // Check changeover penalty
      let penalty = 0;
      if (
        rules.changeoverPenalty > 0 &&
        day.lastCategory !== null &&
        need.category !== null &&
        day.lastCategory !== need.category
      ) {
        // Only penalize grey→white transitions (or any category switch)
        penalty = rules.changeoverPenalty;
      }

      const availableAfterPenalty = day.remainingSlots - penalty;
      if (availableAfterPenalty <= 0) continue;

      // How many batches can we fit?
      const maxBatches = availableAfterPenalty;
      const batchesNeeded = Math.ceil(remainingQty / batchSize);
      const batchesToAssign = Math.min(maxBatches, batchesNeeded);

      const qty = batchesToAssign * batchSize;
      const sequenceOrder = day.runs.length + 1;

      const run: ScheduledRun = {
        sku_id: need.sku_id,
        sku_code: need.sku_code,
        sku_name: need.name,
        category: need.category,
        scheduled_date: day.date,
        recommended_qty: qty,
        batch_count: batchesToAssign,
        sequence_order: sequenceOrder,
        status: "pending",
        blocking_reason: null,
        blocking_sku_id: null,
      };

      day.runs.push(run);
      allRuns.push(run);

      day.remainingSlots -= batchesToAssign + penalty;
      day.lastCategory = need.category;
      remainingQty -= qty;
    }
  }

  return allRuns;
}

// ─── Step 4: Check material availability ────────────────────────────────────

async function checkMaterialAvailability(
  supabase: ReturnType<typeof createServiceClient>,
  runs: ScheduledRun[]
): Promise<void> {
  if (runs.length === 0) return;

  const skuIds = [...new Set(runs.map((r) => r.sku_id))];

  // Get material requirements with shortfalls for these SKUs
  const { data: mrpData } = await supabase
    .from("pi_material_requirements")
    .select("component_sku_id, shortfall_qty, urgency_flag")
    .in("urgency_flag", ["OVERDUE", "URGENT"])
    .gt("shortfall_qty", 0);

  if (!mrpData || mrpData.length === 0) return;

  // Get BOM links to map component shortfalls to finished goods
  const { data: bomItems } = await supabase
    .from("pi_bom_items")
    .select("finished_sku_id, component_sku_id, component_name")
    .in("finished_sku_id", skuIds);

  if (!bomItems || bomItems.length === 0) return;

  // Build a map: finished_sku_id → [blocked component names]
  const shortfallComponents = new Set(mrpData.map((m) => m.component_sku_id));
  const blockedSkus = new Map<string, { reason: string; componentId: string }>();

  for (const bom of bomItems) {
    if (bom.component_sku_id && shortfallComponents.has(bom.component_sku_id)) {
      blockedSkus.set(bom.finished_sku_id, {
        reason: bom.component_name || bom.component_sku_id,
        componentId: bom.component_sku_id,
      });
    }
  }

  // Flag blocked runs
  for (const run of runs) {
    const blocked = blockedSkus.get(run.sku_id);
    if (blocked) {
      run.status = "blocked";
      run.blocking_reason = blocked.reason;
      run.blocking_sku_id = blocked.componentId;
    }
  }
}

// ─── Step 5: Persist to pi_production_schedule ──────────────────────────────

async function persistSchedule(
  supabase: ReturnType<typeof createServiceClient>,
  runs: ScheduledRun[]
): Promise<void> {
  if (runs.length === 0) return;

  const now = new Date().toISOString();

  // Delete existing pending runs (don't touch confirmed/in_progress/complete)
  const scheduledDates = [...new Set(runs.map((r) => r.scheduled_date))];

  for (const date of scheduledDates) {
    await supabase
      .from("pi_production_schedule")
      .delete()
      .eq("scheduled_date", date)
      .eq("status", "pending");
  }

  // Insert new runs
  const rows = runs.map((r) => ({
    sku_id: r.sku_id,
    scheduled_date: r.scheduled_date,
    recommended_qty: r.recommended_qty,
    batch_count: r.batch_count,
    sequence_order: r.sequence_order,
    status: r.status,
    blocking_reason: r.blocking_reason,
    blocking_sku_id: r.blocking_sku_id,
    generated_at: now,
  }));

  // Batch insert in chunks
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabase
      .from("pi_production_schedule")
      .insert(chunk);

    if (error) {
      console.error("[Scheduler] Insert error:", error.message);
    }
  }
}

// ─── Main: Run Scheduler ────────────────────────────────────────────────────

export async function runScheduler(): Promise<{
  runs: number;
  blocked: number;
  days: number;
  error?: string;
}> {
  const supabase = createServiceClient();

  try {
    // Step 0: Load rules
    const rules = await loadRules(supabase);
    console.log(
      `[Scheduler] Rules loaded: capacity=${rules.dailyBatchCapacity}, days_ahead=${rules.maxDaysAhead}, no_prod=${[...rules.noProductionDays].join(",")}`
    );

    // Step 1: Determine production needs
    const needs = await getProductionNeeds(supabase, rules);
    console.log(`[Scheduler] ${needs.length} SKUs need production`);

    if (needs.length === 0) {
      return { runs: 0, blocked: 0, days: 0 };
    }

    // Step 2: Sort by urgency
    const sorted = sortByUrgency(needs, rules.sequenceBefore);

    // Step 3: Assign to production days
    const availableDays = getAvailableDays(rules, new Date());
    const runs = assignToDays(sorted, availableDays, rules);
    console.log(
      `[Scheduler] ${runs.length} runs assigned across ${[...new Set(runs.map((r) => r.scheduled_date))].length} days`
    );

    // Step 4: Check material availability
    await checkMaterialAvailability(supabase, runs);

    const blockedCount = runs.filter((r) => r.status === "blocked").length;
    if (blockedCount > 0) {
      console.log(`[Scheduler] ${blockedCount} runs blocked by material shortfalls`);
    }

    // Step 5: Persist
    await persistSchedule(supabase, runs);

    const scheduledDays = [...new Set(runs.map((r) => r.scheduled_date))].length;

    console.log(
      `[Scheduler] Complete: ${runs.length} runs, ${blockedCount} blocked, ${scheduledDays} days`
    );

    return {
      runs: runs.length,
      blocked: blockedCount,
      days: scheduledDays,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Scheduler] Engine error:", msg);
    return { runs: 0, blocked: 0, days: 0, error: msg };
  }
}

// ─── Utility: Get schedule for a date range ─────────────────────────────────

export async function getScheduleForDateRange(
  startDate: string,
  endDate: string
): Promise<{
  runs: Array<{
    id: string;
    sku_id: string;
    scheduled_date: string;
    recommended_qty: number;
    confirmed_qty: number | null;
    batch_count: number;
    sequence_order: number;
    status: string;
    blocking_reason: string | null;
    blocking_sku_id: string | null;
    notes: string | null;
    confirmed_by: string | null;
    completed_at: string | null;
    generated_at: string;
  }>;
  error?: string;
}> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("pi_production_schedule")
    .select("*")
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate)
    .order("scheduled_date", { ascending: true })
    .order("sequence_order", { ascending: true });

  if (error) {
    return { runs: [], error: error.message };
  }

  return { runs: data || [] };
}

// ─── Utility: Get today's make list ─────────────────────────────────────────

export async function getTodaysMakeList(): Promise<{
  date: string;
  runs: Array<{
    id: string;
    sku_id: string;
    scheduled_date: string;
    recommended_qty: number;
    confirmed_qty: number | null;
    batch_count: number;
    sequence_order: number;
    status: string;
    blocking_reason: string | null;
    notes: string | null;
  }>;
  error?: string;
}> {
  const today = formatDate(new Date());
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("pi_production_schedule")
    .select("*")
    .eq("scheduled_date", today)
    .neq("status", "cancelled")
    .order("sequence_order", { ascending: true });

  if (error) {
    return { date: today, runs: [], error: error.message };
  }

  return { date: today, runs: data || [] };
}
