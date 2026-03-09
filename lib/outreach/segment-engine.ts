/**
 * Dynamic Segment Rules Engine
 *
 * Evaluates segment rules against unified customer data from:
 * - cin7_customers + cin7_orders
 * - woo_customers + woo_orders
 * - contacts table (Klaviyo imports, manual adds)
 *
 * Deduplicates by email — a customer in both Cin7 and contacts shows up once.
 */

import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SegmentRule {
  field: string;
  operator: string;
  value: string | number | boolean | string[] | null;
}

export interface SegmentRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: "dynamic" | "static";
  rules: SegmentRule[];
  source: string;
  cached_count: number;
  cached_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnifiedContact {
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  company: string;
  source: "cin7" | "woocommerce" | "contacts";
  // Order aggregates
  total_spent: number;
  order_count: number;
  last_order_date: string | null;
  days_since_order: number | null;
  last_product: string | null;
  // IDs for linking
  cin7_customer_id?: string;
  woo_customer_id?: string;
  contact_id?: string;
  // Extra
  payment_term?: string;
  tags?: string[];
  is_subscribed?: boolean;
}

// ─── Supported Fields & Operators ─────────────────────────────────────────────

export const SEGMENT_FIELDS: Record<
  string,
  { label: string; type: "string" | "number" | "date" | "boolean" | "array" }
> = {
  email: { label: "Email", type: "string" },
  name: { label: "Customer Name", type: "string" },
  company: { label: "Company", type: "string" },
  source: { label: "Data Source", type: "string" },
  total_spent: { label: "Total Spent ($)", type: "number" },
  order_count: { label: "Number of Orders", type: "number" },
  days_since_order: { label: "Days Since Last Order", type: "number" },
  last_order_date: { label: "Last Order Date", type: "date" },
  last_product: { label: "Last Product Purchased", type: "string" },
  payment_term: { label: "Payment Term", type: "string" },
  tags: { label: "Tags", type: "array" },
  is_subscribed: { label: "Subscribed", type: "boolean" },
};

export const SEGMENT_OPERATORS: Record<
  string,
  { label: string; types: string[] }
> = {
  eq: { label: "equals", types: ["string", "number", "boolean"] },
  neq: { label: "does not equal", types: ["string", "number", "boolean"] },
  gt: { label: "greater than", types: ["number"] },
  gte: { label: "greater than or equal", types: ["number"] },
  lt: { label: "less than", types: ["number"] },
  lte: { label: "less than or equal", types: ["number"] },
  contains: { label: "contains", types: ["string"] },
  not_contains: { label: "does not contain", types: ["string"] },
  is_empty: { label: "is empty", types: ["string", "number", "date"] },
  is_not_empty: { label: "is not empty", types: ["string", "number", "date"] },
  in: { label: "is one of", types: ["string", "array"] },
  not_in: { label: "is not one of", types: ["string", "array"] },
  before: { label: "before date", types: ["date"] },
  after: { label: "after date", types: ["date"] },
};

// ─── Core: Build unified contact list ─────────────────────────────────────────

async function buildUnifiedContacts(
  source: string = "all"
): Promise<UnifiedContact[]> {
  const supabase = getSupabase();
  const contactMap = new Map<string, UnifiedContact>();

  // 1. Cin7 customers + orders
  if (source === "all" || source === "cin7") {
    const { data: cin7Customers } = await supabase
      .from("cin7_customers")
      .select("cin7_id, email, name, company, payment_term")
      .not("email", "is", null)
      .neq("email", "");

    if (cin7Customers && cin7Customers.length > 0) {
      // Fetch all cin7 orders for aggregation
      const { data: cin7Orders } = await supabase
        .from("cin7_orders")
        .select("customer_id, order_date, total, line_items");

      // Build order stats per customer_id
      const orderStats: Record<
        string,
        {
          total_spent: number;
          order_count: number;
          last_order_date: string | null;
          last_product: string | null;
        }
      > = {};

      (cin7Orders || []).forEach((order) => {
        const cid = order.customer_id;
        if (!cid) return;
        if (!orderStats[cid]) {
          orderStats[cid] = {
            total_spent: 0,
            order_count: 0,
            last_order_date: null,
            last_product: null,
          };
        }
        orderStats[cid].order_count++;
        orderStats[cid].total_spent += parseFloat(String(order.total)) || 0;
        if (
          !orderStats[cid].last_order_date ||
          order.order_date > orderStats[cid].last_order_date!
        ) {
          orderStats[cid].last_order_date = order.order_date;
          const lineItems = order.line_items as Array<{
            name?: string;
          }> | null;
          if (lineItems && lineItems.length > 0 && lineItems[0].name) {
            orderStats[cid].last_product = lineItems[0].name;
          }
        }
      });

      const today = Date.now();
      for (const c of cin7Customers) {
        const email = (c.email as string).toLowerCase().trim();
        if (!email) continue;
        const stats = orderStats[c.cin7_id] || {
          total_spent: 0,
          order_count: 0,
          last_order_date: null,
          last_product: null,
        };
        const nameParts = (c.name || "").split(" ");
        const daysSince = stats.last_order_date
          ? Math.floor(
              (today - new Date(stats.last_order_date).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null;

        contactMap.set(email, {
          email,
          name: c.name || "",
          first_name: nameParts[0] || "",
          last_name: nameParts.slice(1).join(" ") || "",
          company: c.company || "",
          source: "cin7",
          total_spent: stats.total_spent,
          order_count: stats.order_count,
          last_order_date: stats.last_order_date,
          days_since_order: daysSince,
          last_product: stats.last_product,
          cin7_customer_id: c.cin7_id,
          payment_term: c.payment_term || undefined,
          is_subscribed: true,
        });
      }
    }
  }

  // 2. WooCommerce customers + orders
  if (source === "all" || source === "woocommerce") {
    const { data: wooCustomers } = await supabase
      .from("woo_customers")
      .select("woo_id, email, first_name, last_name, company")
      .not("email", "is", null)
      .neq("email", "");

    if (wooCustomers && wooCustomers.length > 0) {
      const { data: wooOrders } = await supabase
        .from("woo_orders")
        .select("customer_id, customer_email, order_date, total, line_items");

      // Build order stats by customer_id and email
      const wooOrderStats: Record<
        string,
        {
          total_spent: number;
          order_count: number;
          last_order_date: string | null;
          last_product: string | null;
        }
      > = {};

      (wooOrders || []).forEach((order) => {
        // Key by email for broader matching
        const email = (order.customer_email || "").toLowerCase().trim();
        if (!email) return;
        if (!wooOrderStats[email]) {
          wooOrderStats[email] = {
            total_spent: 0,
            order_count: 0,
            last_order_date: null,
            last_product: null,
          };
        }
        wooOrderStats[email].order_count++;
        wooOrderStats[email].total_spent +=
          parseFloat(String(order.total)) || 0;
        const orderDate = order.order_date?.split("T")[0] || null;
        if (
          orderDate &&
          (!wooOrderStats[email].last_order_date ||
            orderDate > wooOrderStats[email].last_order_date!)
        ) {
          wooOrderStats[email].last_order_date = orderDate;
          const lineItems = order.line_items as Array<{
            name?: string;
          }> | null;
          if (lineItems && lineItems.length > 0 && lineItems[0].name) {
            wooOrderStats[email].last_product = lineItems[0].name;
          }
        }
      });

      const today = Date.now();
      for (const c of wooCustomers) {
        const email = (c.email as string).toLowerCase().trim();
        if (!email) continue;

        const stats = wooOrderStats[email] || {
          total_spent: 0,
          order_count: 0,
          last_order_date: null,
          last_product: null,
        };
        const daysSince = stats.last_order_date
          ? Math.floor(
              (today - new Date(stats.last_order_date).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null;

        const existing = contactMap.get(email);
        if (existing) {
          // Merge: add WooCommerce order stats to existing Cin7 contact
          existing.total_spent += stats.total_spent;
          existing.order_count += stats.order_count;
          existing.woo_customer_id = String(c.woo_id);
          // Use Woo data if more recent
          if (
            stats.last_order_date &&
            (!existing.last_order_date ||
              stats.last_order_date > existing.last_order_date)
          ) {
            existing.last_order_date = stats.last_order_date;
            existing.last_product = stats.last_product || existing.last_product;
            existing.days_since_order = daysSince;
          }
          // Fill in missing names/company
          if (!existing.company && c.company) existing.company = c.company;
        } else {
          const fullName =
            `${c.first_name || ""} ${c.last_name || ""}`.trim();
          contactMap.set(email, {
            email,
            name: fullName,
            first_name: c.first_name || "",
            last_name: c.last_name || "",
            company: c.company || "",
            source: "woocommerce",
            total_spent: stats.total_spent,
            order_count: stats.order_count,
            last_order_date: stats.last_order_date,
            days_since_order: daysSince,
            last_product: stats.last_product,
            woo_customer_id: String(c.woo_id),
            is_subscribed: true,
          });
        }
      }
    }
  }

  // 3. Contacts table (Klaviyo imports, manual adds)
  if (source === "all" || source === "contacts") {
    const { data: contacts } = await supabase
      .from("contacts")
      .select(
        "id, email, first_name, last_name, company, tags, is_subscribed, cin7_customer_id, woo_customer_id"
      )
      .eq("is_subscribed", true);

    if (contacts) {
      for (const c of contacts) {
        const email = (c.email as string).toLowerCase().trim();
        if (!email) continue;

        const existing = contactMap.get(email);
        if (existing) {
          // Already have this person from Cin7/Woo — just merge contact metadata
          existing.contact_id = c.id;
          existing.tags = c.tags || existing.tags;
          existing.is_subscribed = c.is_subscribed ?? existing.is_subscribed;
        } else {
          // New contact not in Cin7 or Woo
          const fullName =
            `${c.first_name || ""} ${c.last_name || ""}`.trim();
          contactMap.set(email, {
            email,
            name: fullName,
            first_name: c.first_name || "",
            last_name: c.last_name || "",
            company: c.company || "",
            source: "contacts",
            total_spent: 0,
            order_count: 0,
            last_order_date: null,
            days_since_order: null,
            last_product: null,
            contact_id: c.id,
            tags: c.tags || [],
            is_subscribed: c.is_subscribed ?? true,
          });
        }
      }
    }
  }

  return Array.from(contactMap.values());
}

// ─── Rule Evaluation ──────────────────────────────────────────────────────────

function evaluateRule(
  contact: UnifiedContact,
  rule: SegmentRule
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fieldValue = (contact as any)[rule.field];
  const ruleValue = rule.value;

  switch (rule.operator) {
    case "eq":
      return fieldValue == ruleValue;
    case "neq":
      return fieldValue != ruleValue;
    case "gt":
      return typeof fieldValue === "number" && fieldValue > Number(ruleValue);
    case "gte":
      return typeof fieldValue === "number" && fieldValue >= Number(ruleValue);
    case "lt":
      return typeof fieldValue === "number" && fieldValue < Number(ruleValue);
    case "lte":
      return typeof fieldValue === "number" && fieldValue <= Number(ruleValue);
    case "contains":
      return (
        typeof fieldValue === "string" &&
        fieldValue.toLowerCase().includes(String(ruleValue).toLowerCase())
      );
    case "not_contains":
      return (
        typeof fieldValue === "string" &&
        !fieldValue.toLowerCase().includes(String(ruleValue).toLowerCase())
      );
    case "is_empty":
      return (
        fieldValue === null ||
        fieldValue === undefined ||
        fieldValue === "" ||
        fieldValue === 0
      );
    case "is_not_empty":
      return (
        fieldValue !== null &&
        fieldValue !== undefined &&
        fieldValue !== "" &&
        fieldValue !== 0
      );
    case "in":
      if (Array.isArray(ruleValue)) {
        if (Array.isArray(fieldValue)) {
          // Tags: check if any tag is in the rule values
          return fieldValue.some((v) => ruleValue.includes(v));
        }
        return ruleValue.includes(fieldValue);
      }
      return false;
    case "not_in":
      if (Array.isArray(ruleValue)) {
        if (Array.isArray(fieldValue)) {
          return !fieldValue.some((v) => ruleValue.includes(v));
        }
        return !ruleValue.includes(fieldValue);
      }
      return true;
    case "before":
      return (
        typeof fieldValue === "string" &&
        fieldValue < String(ruleValue)
      );
    case "after":
      return (
        typeof fieldValue === "string" &&
        fieldValue > String(ruleValue)
      );
    default:
      return true;
  }
}

function evaluateRules(
  contact: UnifiedContact,
  rules: SegmentRule[]
): boolean {
  // All rules must match (AND logic)
  return rules.every((rule) => evaluateRule(contact, rule));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get all members of a segment (dynamic or static)
 */
export async function getSegmentMembers(
  segmentId: string
): Promise<UnifiedContact[]> {
  const supabase = getSupabase();

  // Fetch segment record
  const { data: segment, error } = await supabase
    .from("segments")
    .select("*")
    .eq("id", segmentId)
    .single();

  if (error || !segment) {
    throw new Error(`Segment not found: ${segmentId}`);
  }

  if (segment.type === "static") {
    return getStaticSegmentMembers(segmentId);
  }

  return getDynamicSegmentMembers(segment);
}

/**
 * Get members of a dynamic segment by evaluating rules
 */
async function getDynamicSegmentMembers(
  segment: SegmentRecord
): Promise<UnifiedContact[]> {
  const allContacts = await buildUnifiedContacts(segment.source);
  const rules = (segment.rules || []) as SegmentRule[];

  // No rules = all contacts (e.g. "All Customers" segment)
  if (rules.length === 0) {
    return allContacts;
  }

  return allContacts.filter((contact) => evaluateRules(contact, rules));
}

/**
 * Get members of a static segment from segment_members table
 */
async function getStaticSegmentMembers(
  segmentId: string
): Promise<UnifiedContact[]> {
  const supabase = getSupabase();

  const { data: members } = await supabase
    .from("segment_members")
    .select("email, name, company, metadata")
    .eq("segment_id", segmentId);

  if (!members || members.length === 0) return [];

  // Enrich static members with order data from unified contacts
  const allContacts = await buildUnifiedContacts("all");
  const contactByEmail = new Map(allContacts.map((c) => [c.email, c]));

  return members.map((m) => {
    const enriched = contactByEmail.get(m.email.toLowerCase().trim());
    if (enriched) return enriched;

    // No matching customer record — return basic info
    const nameParts = (m.name || "").split(" ");
    return {
      email: m.email.toLowerCase().trim(),
      name: m.name || "",
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
      company: m.company || "",
      source: "contacts" as const,
      total_spent: 0,
      order_count: 0,
      last_order_date: null,
      days_since_order: null,
      last_product: null,
      is_subscribed: true,
    };
  });
}

/**
 * Get member count for a segment (uses cache if fresh)
 */
export async function getSegmentMemberCount(
  segmentId: string,
  maxCacheAgeMs: number = 5 * 60 * 1000 // 5 min default cache
): Promise<number> {
  const supabase = getSupabase();

  const { data: segment } = await supabase
    .from("segments")
    .select("cached_count, cached_at, type")
    .eq("id", segmentId)
    .single();

  if (!segment) return 0;

  // Use cache if fresh enough
  if (
    segment.cached_at &&
    Date.now() - new Date(segment.cached_at).getTime() < maxCacheAgeMs
  ) {
    return segment.cached_count || 0;
  }

  // Refresh count
  const members = await getSegmentMembers(segmentId);
  const count = members.length;

  // Update cache
  await supabase
    .from("segments")
    .update({ cached_count: count, cached_at: new Date().toISOString() })
    .eq("id", segmentId);

  return count;
}

/**
 * Get all segments with their counts
 */
export async function getAllSegmentsWithCounts(): Promise<
  (SegmentRecord & { member_count: number })[]
> {
  const supabase = getSupabase();

  const { data: segments } = await supabase
    .from("segments")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (!segments) return [];

  // Return cached counts — UI can trigger refresh per segment if needed
  return segments.map((s) => ({
    ...s,
    rules: s.rules as SegmentRule[],
    type: s.type as "dynamic" | "static",
    member_count: s.cached_count || 0,
  }));
}

/**
 * Resolve a segment slug to members (backward-compatible with old SegmentType)
 * Used by the campaign system
 */
export async function resolveSegmentBySlug(
  slug: string
): Promise<{ segment: SegmentRecord; members: UnifiedContact[] } | null> {
  const supabase = getSupabase();

  const { data: segment } = await supabase
    .from("segments")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!segment) return null;

  const members = await getSegmentMembers(segment.id);
  return {
    segment: {
      ...segment,
      rules: segment.rules as SegmentRule[],
      type: segment.type as "dynamic" | "static",
    },
    members,
  };
}
