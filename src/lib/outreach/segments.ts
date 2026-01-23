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
  const supabase = getSupabase();

  // Query unified_customers table (from Klaviyo dormant sync)
  let query = supabase
    .from("unified_customers")
    .select(
      `
      id,
      email,
      name,
      company,
      total_spent,
      order_count,
      last_order_date,
      last_product
    `
    )
    .not("email", "is", null)
    .neq("email", "");

  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  const oneYearAgoStr = oneYearAgo.toISOString().split("T")[0];

  switch (segment) {
    case "dormant":
      // No order in 12+ months
      query = query.lt("last_order_date", oneYearAgoStr);
      break;
    case "vip":
      // Spent $5000+ OR 5+ orders
      query = query.or("total_spent.gte.5000,order_count.gte.5");
      break;
    case "active":
      // Ordered within last 12 months
      query = query.gte("last_order_date", oneYearAgoStr);
      break;
    case "all":
    default:
      // No additional filter
      break;
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching segment:", error);
    return [];
  }

  return (data || []) as CustomerRecipient[];
}

export async function getSegmentCount(segment: SegmentType): Promise<number> {
  const recipients = await getSegmentRecipients(segment);
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
