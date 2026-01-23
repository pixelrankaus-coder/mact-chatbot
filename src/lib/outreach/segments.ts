import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export type SegmentType = "dormant" | "vip" | "active" | "all" | "custom";

export interface SegmentInfo {
  id: SegmentType;
  name: string;
  description: string;
  count?: number;
}

export const SEGMENTS: SegmentInfo[] = [
  {
    id: "dormant",
    name: "Dormant Customers",
    description: "No order in 12+ months",
  },
  {
    id: "vip",
    name: "VIP Customers",
    description: "Spent $5,000+ or 5+ orders",
  },
  {
    id: "active",
    name: "Active Customers",
    description: "Ordered within last 12 months",
  },
  {
    id: "all",
    name: "All Customers",
    description: "Everyone with an email address",
  },
  {
    id: "custom",
    name: "Custom / Test",
    description: "Enter email addresses manually",
  },
];

export interface CustomerRecipient {
  id: string;
  email: string;
  name: string;
  company?: string;
  total_spent?: number;
  order_count?: number;
  last_order_date?: string;
  last_product?: string;
}

export async function getSegmentRecipients(
  segment: SegmentType,
  segmentFilter?: Record<string, unknown>
): Promise<CustomerRecipient[]> {
  // Handle custom/test segment with manually entered emails
  if (segment === "custom" && segmentFilter?.emails) {
    const emails = segmentFilter.emails as string[];
    return emails.map((email, index) => {
      const namePart = email.split("@")[0];
      // Capitalize first letter
      const firstName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      return {
        id: `custom-${index}`,
        email: email.toLowerCase().trim(),
        name: firstName,
        company: undefined,
        total_spent: 0,
        order_count: 0,
        last_order_date: undefined,
        last_product: undefined,
      };
    });
  }

  const supabase = getSupabase();

  // Get all Cin7 customers with email
  const { data: cin7Customers, error: customerError } = await supabase
    .from("cin7_customers")
    .select("id, cin7_id, email, name, company")
    .not("email", "is", null)
    .neq("email", "");

  if (customerError) {
    console.error("Error fetching cin7_customers:", customerError);
    return [];
  }

  if (!cin7Customers || cin7Customers.length === 0) {
    console.log("[Segments] No customers found with email addresses");
    return [];
  }

  // Get all Cin7 orders to compute aggregates
  const { data: cin7Orders, error: orderError } = await supabase
    .from("cin7_orders")
    .select("customer_id, order_date, total, line_items");

  if (orderError) {
    console.error("Error fetching cin7_orders:", orderError);
    return [];
  }

  // Build order stats per customer (keyed by cin7_id)
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

    // Track most recent order date and product
    if (
      !orderStats[cid].last_order_date ||
      order.order_date > orderStats[cid].last_order_date
    ) {
      orderStats[cid].last_order_date = order.order_date;
      // Get first line item name from most recent order
      const lineItems = order.line_items as Array<{ name?: string }> | null;
      if (lineItems && lineItems.length > 0 && lineItems[0].name) {
        orderStats[cid].last_product = lineItems[0].name;
      }
    }
  });

  // Combine customers with their order stats
  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  const oneYearAgoStr = oneYearAgo.toISOString().split("T")[0];

  const recipients: CustomerRecipient[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cin7Customers.forEach((customer: any) => {
    const stats = orderStats[customer.cin7_id] || {
      total_spent: 0,
      order_count: 0,
      last_order_date: null,
      last_product: null,
    };

    // Apply segment filters
    switch (segment) {
      case "dormant":
        // No order in 12+ months (but has ordered before)
        if (stats.order_count === 0) return;
        if (!stats.last_order_date || stats.last_order_date >= oneYearAgoStr)
          return;
        break;
      case "vip":
        // Spent $5000+ OR 5+ orders
        if (stats.total_spent < 5000 && stats.order_count < 5) return;
        break;
      case "active":
        // Ordered within last 12 months
        if (!stats.last_order_date || stats.last_order_date < oneYearAgoStr)
          return;
        break;
      case "all":
      default:
        // No additional filter
        break;
    }

    recipients.push({
      id: customer.id,
      email: customer.email.toLowerCase(),
      name: customer.name || "",
      company: customer.company || undefined,
      total_spent: stats.total_spent,
      order_count: stats.order_count,
      last_order_date: stats.last_order_date || undefined,
      last_product: stats.last_product || undefined,
    });
  });

  console.log(`[Segments] Found ${recipients.length} recipients for segment "${segment}"`);
  return recipients;
}

export async function getSegmentCount(
  segment: SegmentType,
  segmentFilter?: Record<string, unknown>
): Promise<number> {
  const recipients = await getSegmentRecipients(segment, segmentFilter);
  return recipients.length;
}

export async function getSegmentsWithCounts(): Promise<SegmentInfo[]> {
  const segmentsWithCounts = await Promise.all(
    SEGMENTS.map(async (segment) => {
      const count = await getSegmentCount(segment.id);
      return { ...segment, count };
    })
  );
  return segmentsWithCounts;
}

export interface PersonalizationData {
  first_name: string;
  last_name: string;
  company: string;
  last_product: string;
  last_order_date: string;
  days_since_order: number | null;
  total_spent: number;
  order_count: number;
}

export function buildPersonalizationData(
  customer: CustomerRecipient
): PersonalizationData {
  const lastOrderDate = customer.last_order_date
    ? new Date(customer.last_order_date)
    : null;
  const daysSinceOrder = lastOrderDate
    ? Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const nameParts = (customer.name || "").split(" ");

  return {
    first_name: nameParts[0] || "",
    last_name: nameParts.slice(1).join(" ") || "",
    company: customer.company || "",
    last_product: customer.last_product || "",
    last_order_date: customer.last_order_date || "",
    days_since_order: daysSinceOrder,
    total_spent: customer.total_spent || 0,
    order_count: customer.order_count || 0,
  };
}
