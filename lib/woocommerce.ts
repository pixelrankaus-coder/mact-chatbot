import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

// Cached WooCommerce credentials from DB
let cachedCredentials: { url: string; key: string; secret: string } | null = null;
let credentialsCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get WooCommerce credentials - DB first, then env vars
 */
async function getWooCredentials(): Promise<{ url: string; key: string; secret: string }> {
  // Return cached if fresh
  if (cachedCredentials && Date.now() - credentialsCacheTime < CACHE_TTL) {
    return cachedCredentials;
  }

  try {
    const supabase = createServiceClient() as SupabaseAny;
    const { data } = await supabase
      .from("integration_settings")
      .select("settings, is_enabled")
      .eq("integration_type", "woocommerce")
      .single();

    if (data?.is_enabled && data.settings?.url && data.settings?.consumer_key && data.settings?.consumer_secret) {
      cachedCredentials = {
        url: data.settings.url,
        key: data.settings.consumer_key,
        secret: data.settings.consumer_secret,
      };
      credentialsCacheTime = Date.now();
      return cachedCredentials;
    }
  } catch {
    // DB not available, fall back to env vars
  }

  // Fallback to environment variables
  cachedCredentials = {
    url: process.env.WOOCOMMERCE_URL || "https://mact.au",
    key: process.env.WOOCOMMERCE_CONSUMER_KEY || "",
    secret: process.env.WOOCOMMERCE_CONSUMER_SECRET || "",
  };
  credentialsCacheTime = Date.now();
  return cachedCredentials;
}

/**
 * Get a WooCommerce API client with current credentials (DB-first)
 */
async function getWooClient(): Promise<WooCommerceRestApi> {
  const creds = await getWooCredentials();
  return new WooCommerceRestApi({
    url: creds.url,
    consumerKey: creds.key,
    consumerSecret: creds.secret,
    version: "wc/v3",
  });
}

/**
 * Check if WooCommerce credentials are available
 */
async function hasWooCredentials(): Promise<boolean> {
  const creds = await getWooCredentials();
  return !!(creds.url && creds.key && creds.secret);
}

// Order status mappings for customer-friendly display
const statusLabels: Record<string, string> = {
  pending: "Pending Payment",
  processing: "Processing",
  "on-hold": "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
  "trash": "Deleted",
};

// Types
export interface WooOrder {
  id: number;
  number: string;
  status: string;
  statusLabel: string;
  dateCreated: string;
  dateModified: string;
  total: string;
  currency: string;
  customerEmail: string;
  customerName: string;
  billing: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  shipping: {
    firstName: string;
    lastName: string;
    address1: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  items: Array<{
    name: string;
    sku: string | null;
    quantity: number;
    price: string;
    total: string;
  }>;
  shippingTotal: string;
  paymentMethod: string;
  trackingInfo?: {
    provider: string;
    trackingNumber: string;
    trackingUrl?: string;
  };
}

export interface OrderLookupResult {
  success: boolean;
  order?: WooOrder;
  orders?: WooOrder[];
  error?: string;
}

// Transform raw WooCommerce order to our format
function transformOrder(rawOrder: Record<string, unknown>): WooOrder {
  const billing = rawOrder.billing as Record<string, string> || {};
  const shipping = rawOrder.shipping as Record<string, string> || {};
  const lineItems = (rawOrder.line_items as Array<Record<string, unknown>>) || [];
  const metaData = (rawOrder.meta_data as Array<Record<string, unknown>>) || [];

  // Try to find tracking info from meta data (common tracking plugins)
  let trackingInfo: WooOrder["trackingInfo"] | undefined;
  const trackingMeta = metaData.find(
    (m) => m.key === "_wc_shipment_tracking_items" || m.key === "tracking_number"
  );
  if (trackingMeta && trackingMeta.value) {
    const trackingData = Array.isArray(trackingMeta.value)
      ? trackingMeta.value[0]
      : trackingMeta.value;
    if (typeof trackingData === "object" && trackingData !== null) {
      const td = trackingData as Record<string, string>;
      trackingInfo = {
        provider: td.tracking_provider || td.provider || "Unknown",
        trackingNumber: td.tracking_number || td.number || "",
        trackingUrl: td.tracking_link || td.url,
      };
    }
  }

  return {
    id: rawOrder.id as number,
    number: String(rawOrder.number || rawOrder.id),
    status: rawOrder.status as string,
    statusLabel: statusLabels[rawOrder.status as string] || (rawOrder.status as string),
    dateCreated: rawOrder.date_created as string,
    dateModified: rawOrder.date_modified as string,
    total: rawOrder.total as string,
    currency: rawOrder.currency as string,
    customerEmail: billing.email || "",
    customerName: `${billing.first_name || ""} ${billing.last_name || ""}`.trim(),
    billing: {
      firstName: billing.first_name || "",
      lastName: billing.last_name || "",
      email: billing.email || "",
      phone: billing.phone || "",
    },
    shipping: {
      firstName: shipping.first_name || "",
      lastName: shipping.last_name || "",
      address1: shipping.address_1 || "",
      city: shipping.city || "",
      state: shipping.state || "",
      postcode: shipping.postcode || "",
      country: shipping.country || "",
    },
    items: lineItems.map((item) => ({
      name: item.name as string,
      sku: (item.sku as string) || null,
      quantity: item.quantity as number,
      price: item.price as string,
      total: item.total as string,
    })),
    shippingTotal: rawOrder.shipping_total as string,
    paymentMethod: rawOrder.payment_method_title as string || "",
    trackingInfo,
  };
}

/**
 * Look up an order by order number or ID
 */
export async function lookupOrderByNumber(
  orderNumber: string
): Promise<OrderLookupResult> {
  if (!(await hasWooCredentials())) {
    return {
      success: false,
      error: "WooCommerce integration not configured",
    };
  }

  try {
    const api = await getWooClient();
    // First, try to get by ID directly
    const cleanNumber = orderNumber.replace(/[^0-9]/g, "");

    if (cleanNumber) {
      try {
        const response = await api.get(`orders/${cleanNumber}`);
        if (response.data) {
          return {
            success: true,
            order: transformOrder(response.data),
          };
        }
      } catch {
        // Order not found by ID, try searching
      }
    }

    // Search by order number (some stores use different order numbering)
    const searchResponse = await api.get("orders", {
      search: orderNumber,
      per_page: 5,
    });

    if (searchResponse.data && searchResponse.data.length > 0) {
      // Find exact match
      const exactMatch = searchResponse.data.find(
        (o: Record<string, unknown>) =>
          String(o.number) === orderNumber || String(o.id) === cleanNumber
      );

      if (exactMatch) {
        return {
          success: true,
          order: transformOrder(exactMatch),
        };
      }

      // Return first result if no exact match
      return {
        success: true,
        order: transformOrder(searchResponse.data[0]),
      };
    }

    return {
      success: false,
      error: "Order not found. Please check the order number and try again.",
    };
  } catch (error) {
    console.error("WooCommerce order lookup error:", error);
    return {
      success: false,
      error: "Unable to look up order. Please try again later.",
    };
  }
}

/**
 * Look up orders by customer email
 */
export async function lookupOrdersByEmail(
  email: string
): Promise<OrderLookupResult> {
  if (!(await hasWooCredentials())) {
    return {
      success: false,
      error: "WooCommerce integration not configured",
    };
  }

  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: "Please provide a valid email address.",
      };
    }

    const api = await getWooClient();
    const response = await api.get("orders", {
      search: email,
      per_page: 10,
      orderby: "date",
      order: "desc",
    });

    if (response.data && response.data.length > 0) {
      // Filter to only orders matching the email exactly
      const matchingOrders = response.data.filter((o: Record<string, unknown>) => {
        const billing = o.billing as Record<string, string> | undefined;
        return billing?.email?.toLowerCase() === email.toLowerCase();
      });

      if (matchingOrders.length > 0) {
        return {
          success: true,
          orders: matchingOrders.map(transformOrder),
        };
      }
    }

    return {
      success: false,
      error: "No orders found for this email address.",
    };
  } catch (error) {
    console.error("WooCommerce email lookup error:", error);
    return {
      success: false,
      error: "Unable to look up orders. Please try again later.",
    };
  }
}

/**
 * Format order info for display in chat
 */
export function formatOrderForChat(order: WooOrder): string {
  const lines = [
    `**Order #${order.number}**`,
    `Status: ${order.statusLabel}`,
    `Date: ${new Date(order.dateCreated).toLocaleDateString("en-AU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    `Total: $${order.total} ${order.currency}`,
    "",
    "**Items:**",
    ...order.items.map((item) => `- ${item.name} x${item.quantity} ($${item.total})`),
  ];

  if (order.trackingInfo?.trackingNumber) {
    lines.push("");
    lines.push("**Shipping:**");
    lines.push(`Provider: ${order.trackingInfo.provider}`);
    lines.push(`Tracking: ${order.trackingInfo.trackingNumber}`);
    if (order.trackingInfo.trackingUrl) {
      lines.push(`Track: ${order.trackingInfo.trackingUrl}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format multiple orders summary for chat
 */
export function formatOrdersListForChat(orders: WooOrder[]): string {
  const lines = [
    `Found ${orders.length} order${orders.length > 1 ? "s" : ""}:`,
    "",
  ];

  orders.forEach((order, index) => {
    lines.push(`**${index + 1}. Order #${order.number}**`);
    lines.push(`   Status: ${order.statusLabel}`);
    lines.push(`   Date: ${new Date(order.dateCreated).toLocaleDateString("en-AU")}`);
    lines.push(`   Total: $${order.total}`);
    lines.push("");
  });

  lines.push("Would you like details on a specific order? Just provide the order number.");

  return lines.join("\n");
}

/**
 * Detect if a message is asking about order status
 */
export function detectOrderIntent(message: string): {
  hasOrderIntent: boolean;
  orderNumber?: string;
  email?: string;
} {
  const lowerMessage = message.toLowerCase();

  // Keywords that indicate order inquiry
  const orderKeywords = [
    "order",
    "status",
    "tracking",
    "delivery",
    "shipped",
    "shipping",
    "where is my",
    "track my",
    "order number",
    "order #",
  ];

  const hasOrderIntent = orderKeywords.some((keyword) =>
    lowerMessage.includes(keyword)
  );

  // Try to extract order number (various formats)
  const orderNumberPatterns = [
    /#?\s*(\d{4,})/,                    // #1234 or 1234
    /order\s*#?\s*(\d{4,})/i,           // order #1234 or order 1234
    /number\s*#?\s*(\d{4,})/i,          // number #1234
    /\b([A-Z]{2,3}-?\d{4,})\b/i,        // ABC-1234 or AB1234
  ];

  let orderNumber: string | undefined;
  for (const pattern of orderNumberPatterns) {
    const match = message.match(pattern);
    if (match) {
      orderNumber = match[1];
      break;
    }
  }

  // Try to extract email
  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const emailMatch = message.match(emailPattern);
  const email = emailMatch ? emailMatch[1] : undefined;

  return {
    hasOrderIntent,
    orderNumber,
    email,
  };
}

// ============ CUSTOMERS ============

export interface WooCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  date_created: string;
  date_modified: string;
  orders_count: number;
  total_spent: string;
  avatar_url: string;
}

/**
 * Get list of WooCommerce customers with optional search and pagination
 */
export async function getWooCustomers(params: {
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<{ customers: WooCustomer[]; total: number }> {
  if (!(await hasWooCredentials())) {
    return { customers: [], total: 0 };
  }

  try {
    const api = await getWooClient();
    const response = await api.get("customers", {
      search: params.search || "",
      page: params.page || 1,
      per_page: params.per_page || 50,
      orderby: "registered_date",
      order: "desc",
    });

    return {
      customers: response.data || [],
      total: parseInt(response.headers?.["x-wp-total"] || "0", 10),
    };
  } catch (error) {
    console.error("WooCommerce getCustomers error:", error);
    return { customers: [], total: 0 };
  }
}

/**
 * Get a single WooCommerce customer by ID
 */
export async function getWooCustomer(id: number): Promise<WooCustomer | null> {
  if (!(await hasWooCredentials())) {
    return null;
  }

  try {
    const api = await getWooClient();
    const response = await api.get(`customers/${id}`);
    return response.data;
  } catch (error) {
    console.error("WooCommerce getCustomer error:", error);
    return null;
  }
}

/**
 * Get orders for a specific WooCommerce customer
 */
export async function getWooCustomerOrders(customerId: number): Promise<WooOrder[]> {
  if (!(await hasWooCredentials())) {
    return [];
  }

  try {
    const api = await getWooClient();
    const response = await api.get("orders", {
      customer: customerId,
      per_page: 10,
      orderby: "date",
      order: "desc",
    });
    return (response.data || []).map(transformOrder);
  } catch (error) {
    console.error("WooCommerce getCustomerOrders error:", error);
    return [];
  }
}

/**
 * List WooCommerce orders with search, filter, and pagination
 */
export async function listWooOrders(params: {
  search?: string;
  status?: string;
  page?: number;
  per_page?: number;
  after?: string; // ISO date
  before?: string; // ISO date
}): Promise<{ orders: WooOrder[]; total: number }> {
  if (!(await hasWooCredentials())) {
    return { orders: [], total: 0 };
  }

  try {
    const api = await getWooClient();
    const queryParams: Record<string, string | number> = {
      page: params.page || 1,
      per_page: params.per_page || 25,
      orderby: "date",
      order: "desc",
    };

    if (params.search) queryParams.search = params.search;
    if (params.status) queryParams.status = params.status;
    if (params.after) queryParams.after = params.after;
    if (params.before) queryParams.before = params.before;

    const response = await api.get("orders", queryParams);

    return {
      orders: (response.data || []).map(transformOrder),
      total: parseInt(response.headers?.["x-wp-total"] || "0", 10),
    };
  } catch (error) {
    console.error("WooCommerce listOrders error:", error);
    return { orders: [], total: 0 };
  }
}

/**
 * Get a single WooCommerce order by ID
 */
export async function getWooOrder(orderId: number): Promise<WooOrder | null> {
  if (!(await hasWooCredentials())) {
    return null;
  }

  try {
    const api = await getWooClient();
    const response = await api.get(`orders/${orderId}`);
    return transformOrder(response.data);
  } catch (error) {
    console.error("WooCommerce getOrder error:", error);
    return null;
  }
}

// ============ PRODUCTS ============

export interface WooProduct {
  id: number;
  name: string;
  slug: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  description: string;
  short_description: string;
  categories: Array<{ id: number; name: string; slug: string }>;
  images: Array<{ id: number; src: string; alt: string }>;
  stock_quantity: number | null;
  stock_status: "instock" | "outofstock" | "onbackorder";
  manage_stock: boolean;
  status: "publish" | "draft" | "pending" | "private";
  date_created: string;
  date_modified: string;
  total_sales: number;
  average_rating: string;
  rating_count: number;
}

/**
 * Get list of WooCommerce products with optional search and pagination
 */
export async function getWooProducts(params: {
  search?: string;
  category?: number;
  page?: number;
  per_page?: number;
  status?: string;
  stock_status?: string;
  orderby?: string;
  order?: "asc" | "desc";
}): Promise<{ products: WooProduct[]; total: number; totalPages: number }> {
  if (!(await hasWooCredentials())) {
    return { products: [], total: 0, totalPages: 0 };
  }

  try {
    const api = await getWooClient();
    const queryParams: Record<string, string | number> = {
      page: params.page || 1,
      per_page: params.per_page || 100,
      orderby: params.orderby || "title",
      order: params.order || "asc",
    };

    if (params.search) queryParams.search = params.search;
    if (params.category) queryParams.category = params.category;
    if (params.status) queryParams.status = params.status;
    if (params.stock_status) queryParams.stock_status = params.stock_status;

    const response = await api.get("products", queryParams);

    return {
      products: response.data || [],
      total: parseInt(response.headers?.["x-wp-total"] || "0", 10),
      totalPages: parseInt(response.headers?.["x-wp-totalpages"] || "0", 10),
    };
  } catch (error) {
    console.error("WooCommerce getProducts error:", error);
    return { products: [], total: 0, totalPages: 0 };
  }
}

/**
 * Get a single WooCommerce product by ID
 */
export async function getWooProduct(productId: number): Promise<WooProduct | null> {
  if (!(await hasWooCredentials())) {
    return null;
  }

  try {
    const api = await getWooClient();
    const response = await api.get(`products/${productId}`);
    return response.data;
  } catch (error) {
    console.error("WooCommerce getProduct error:", error);
    return null;
  }
}

/**
 * Get all WooCommerce products (handles pagination automatically)
 */
export async function getAllWooProducts(): Promise<WooProduct[]> {
  if (!(await hasWooCredentials())) {
    return [];
  }

  const allProducts: WooProduct[] = [];
  let page = 1;
  const perPage = 100;

  try {
    const api = await getWooClient();
    while (true) {
      const response = await api.get("products", {
        page,
        per_page: perPage,
        status: "publish",
      });

      const products = response.data || [];
      allProducts.push(...products);

      const totalPages = parseInt(response.headers?.["x-wp-totalpages"] || "1", 10);
      if (page >= totalPages || products.length === 0) {
        break;
      }
      page++;
    }

    return allProducts;
  } catch (error) {
    console.error("WooCommerce getAllProducts error:", error);
    return allProducts;
  }
}

/**
 * Get WooCommerce product categories
 */
export async function getWooProductCategories(): Promise<Array<{ id: number; name: string; slug: string; count: number }>> {
  if (!(await hasWooCredentials())) {
    return [];
  }

  try {
    const api = await getWooClient();
    const response = await api.get("products/categories", {
      per_page: 100,
      orderby: "name",
      order: "asc",
    });
    return response.data || [];
  } catch (error) {
    console.error("WooCommerce getCategories error:", error);
    return [];
  }
}
