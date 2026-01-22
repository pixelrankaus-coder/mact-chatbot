/**
 * Cin7 (Dear Systems) API Client
 * Documentation: https://developer.cin7.com/
 */

const CIN7_BASE_URL = "https://inventory.dearsystems.com/ExternalApi/v2";

function getHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "api-auth-accountid": process.env.CIN7_ACCOUNT_ID!,
    "api-auth-applicationkey": process.env.CIN7_API_KEY!,
  };
}

// ============ SALES / ORDERS ============

// Response from saleList endpoint (abbreviated data)
export interface Cin7SaleListItem {
  SaleID: string;
  OrderNumber: string;
  Status: string;
  OrderDate: string;
  Customer: string;
  CustomerID: string;
  InvoiceNumber?: string;
  CustomerReference?: string;
  InvoiceAmount: number;
  SaleInvoicesTotalAmount: number;
  BaseCurrency: string;
  CustomerCurrency: string;
  OrderStatus: string;
  CombinedTrackingNumbers?: string;
  CombinedShippingStatus?: string;
  Updated: string;
  SourceChannel?: string;
  Type?: string;
}

// Full sale response from /sale endpoint
export interface Cin7Sale {
  ID: string;
  Status: string;
  Customer: string;
  CustomerID: string;
  Email?: string;
  Phone?: string;
  Contact?: string;
  SaleOrderDate: string;
  BaseCurrency?: string;
  CustomerCurrency?: string;
  CustomerReference?: string;
  Carrier?: string;
  CombinedTrackingNumbers?: string;
  ShippingAddress?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    State?: string;
    Postcode?: string;
    Country?: string;
    Company?: string;
    Contact?: string;
  };
  Order?: {
    SaleOrderNumber: string;
    Status: string;
    Lines: Array<{
      ProductID?: string;
      SKU?: string;
      Name?: string;
      Quantity: number;
      Price: number;
      Total: number;
    }>;
    TotalBeforeTax: number;
    Tax: number;
    Total: number;
  };
  Invoices?: Array<{
    InvoiceNumber: string;
    Status: string;
    InvoiceDate: string;
    Lines: Array<{
      ProductID?: string;
      SKU?: string;
      Name?: string;
      Quantity: number;
      Price: number;
      Total: number;
    }>;
    Total: number;
    Paid: number;
  }>;
  Fulfilments?: Array<{
    FulfillmentNumber: number;
    FulFilmentStatus: string;
    Ship?: {
      Status: string;
      Lines?: Array<{
        TrackingNumber?: string;
        Carrier?: string;
        ShipDate?: string;
      }>;
    };
  }>;
}

// Get single sale by ID
export async function getSale(saleId: string): Promise<Cin7Sale | null> {
  try {
    const res = await fetch(`${CIN7_BASE_URL}/sale?ID=${saleId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error("Cin7 getSale error:", error);
    return null;
  }
}

// Search sales by various criteria (returns abbreviated list data)
export async function searchSales(params: {
  search?: string; // Order number search
  customerID?: string;
  status?: string; // DRAFT, ORDERING, APPROVED, etc.
  modifiedSince?: string; // ISO date
  page?: number;
  limit?: number;
}): Promise<{ SaleList: Cin7SaleListItem[]; Total: number }> {
  try {
    const query = new URLSearchParams();
    if (params.search) query.set("Search", params.search);
    if (params.customerID) query.set("CustomerID", params.customerID);
    if (params.status) query.set("Status", params.status);
    if (params.modifiedSince) query.set("ModifiedSince", params.modifiedSince);
    query.set("Page", String(params.page || 1));
    query.set("Limit", String(params.limit || 10));

    const res = await fetch(`${CIN7_BASE_URL}/saleList?${query}`, {
      headers: getHeaders(),
    });
    if (!res.ok) return { SaleList: [], Total: 0 };

    const data = await res.json();

    // Cin7 API can return 200 OK with errors in the response body
    if (data.Errors && data.Errors.length > 0) {
      console.error("Cin7 API error:", data.Errors.join(", "));
      throw new Error(`Cin7 API error: ${data.Errors.join(", ")}`);
    }

    return data;
  } catch (error) {
    console.error("Cin7 searchSales error:", error);
    throw error; // Re-throw to propagate error instead of silently returning empty
  }
}

// List all sales with automatic pagination
export async function listAllSales(params?: {
  modifiedSince?: string;
  maxPages?: number;
}): Promise<{ SaleList: Cin7SaleListItem[]; Total: number }> {
  const limit = 250; // Max allowed by Cin7 API
  const maxPages = params?.maxPages || 50; // Safety limit (50 * 250 = 12,500 orders max)
  const allSales: Cin7SaleListItem[] = [];
  let total = 0;

  // First request to get total count (let errors propagate)
  const firstResult = await searchSales({
    modifiedSince: params?.modifiedSince,
    page: 1,
    limit,
  });

  total = firstResult.Total;
  allSales.push(...(firstResult.SaleList || []));

  // Calculate remaining pages needed
  const totalPages = Math.min(Math.ceil(total / limit), maxPages);

  // Fetch remaining pages in batches of 3 to avoid rate limiting
  const remainingPages = Array.from(
    { length: totalPages - 1 },
    (_, i) => i + 2
  );

  for (let i = 0; i < remainingPages.length; i += 3) {
    const batch = remainingPages.slice(i, i + 3);
    const results = await Promise.all(
      batch.map((p) =>
        searchSales({
          modifiedSince: params?.modifiedSince,
          page: p,
          limit,
        })
      )
    );

    for (const result of results) {
      allSales.push(...(result.SaleList || []));
    }

    // Small delay between batches to respect rate limits
    if (i + 3 < remainingPages.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return { SaleList: allSales, Total: total };
}

// ============ CUSTOMERS ============

export interface Cin7Address {
  Line1?: string;
  Line2?: string;
  City?: string;
  State?: string;
  Postcode?: string;
  Country?: string;
  Type?: string;
}

export interface Cin7Contact {
  Name?: string;
  Phone?: string;
  Email?: string;
  Fax?: string;
  Default?: boolean;
}

export interface Cin7Customer {
  ID: string;
  Name: string;
  Email?: string;
  Phone?: string;
  Fax?: string;
  Mobile?: string;
  Website?: string;
  Status: string;
  Currency?: string;
  PaymentTerm?: string;
  AccountReceivable?: number;
  RevenueAccount?: string;
  TaxRule?: string;
  TaxNumber?: string;
  Discount?: number;
  CreditLimit?: number;
  Comments?: string;
  Tags?: string;
  AttributeSet?: string;
  AdditionalAttribute1?: string;
  AdditionalAttribute2?: string;
  AdditionalAttribute3?: string;
  AdditionalAttribute4?: string;
  AdditionalAttribute5?: string;
  AdditionalAttribute6?: string;
  AdditionalAttribute7?: string;
  AdditionalAttribute8?: string;
  AdditionalAttribute9?: string;
  AdditionalAttribute10?: string;
  Carrier?: string;
  SalesRepresentative?: string;
  Location?: string;
  PriceTier?: string;
  Addresses?: Cin7Address[];
  Contacts?: Cin7Contact[];
  LastModifiedOn?: string;
  CreatedDate?: string;
}

// Get customer by ID
export async function getCustomer(
  customerId: string
): Promise<Cin7Customer | null> {
  try {
    const res = await fetch(`${CIN7_BASE_URL}/customer?ID=${customerId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Cin7 returns CustomerList array even for single ID lookup
    if (data.CustomerList && data.CustomerList.length > 0) {
      return data.CustomerList[0];
    }
    return data;
  } catch (error) {
    console.error("Cin7 getCustomer error:", error);
    return null;
  }
}

// List customers with pagination (single page)
export async function listCustomers(params: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ CustomerList: Cin7Customer[]; Total: number }> {
  try {
    const query = new URLSearchParams();
    if (params.search) query.set("Search", params.search);
    query.set("Page", String(params.page || 1));
    query.set("Limit", String(params.limit || 25));

    const res = await fetch(`${CIN7_BASE_URL}/customer?${query}`, {
      headers: getHeaders(),
    });
    if (!res.ok) return { CustomerList: [], Total: 0 };

    const data = await res.json();

    // Cin7 API can return 200 OK with errors in the response body
    if (data.Errors && data.Errors.length > 0) {
      console.error("Cin7 API error:", data.Errors.join(", "));
      throw new Error(`Cin7 API error: ${data.Errors.join(", ")}`);
    }

    return data;
  } catch (error) {
    console.error("Cin7 listCustomers error:", error);
    throw error; // Re-throw to propagate error instead of silently returning empty
  }
}

// List all customers with automatic pagination
export async function listAllCustomers(params?: {
  search?: string;
  maxPages?: number;
}): Promise<{ CustomerList: Cin7Customer[]; Total: number }> {
  const limit = 250; // Max allowed by Cin7 API
  const maxPages = params?.maxPages || 20; // Safety limit
  const allCustomers: Cin7Customer[] = [];
  let total = 0;

  // First request to get total count (let errors propagate)
  const firstResult = await listCustomers({
    search: params?.search,
    page: 1,
    limit,
  });

  total = firstResult.Total;
  allCustomers.push(...(firstResult.CustomerList || []));

  // Calculate remaining pages needed
  const totalPages = Math.min(Math.ceil(total / limit), maxPages);

  // Fetch remaining pages in parallel (batches of 5 to avoid rate limiting)
  const remainingPages = Array.from(
    { length: totalPages - 1 },
    (_, i) => i + 2
  );

  for (let i = 0; i < remainingPages.length; i += 5) {
    const batch = remainingPages.slice(i, i + 5);
    const results = await Promise.all(
      batch.map((p) =>
        listCustomers({
          search: params?.search,
          page: p,
          limit,
        })
      )
    );

    for (const result of results) {
      allCustomers.push(...(result.CustomerList || []));
    }
  }

  return { CustomerList: allCustomers, Total: total };
}

// Search customers (alias for backwards compatibility)
export async function searchCustomers(
  search: string
): Promise<{ CustomerList: Cin7Customer[]; Total: number }> {
  return listCustomers({ search, limit: 10 });
}

// Get orders for a specific customer
export async function getCustomerOrders(
  customerId: string,
  limit: number = 10
): Promise<{ SaleList: Cin7SaleListItem[]; Total: number }> {
  return searchSales({ customerID: customerId, limit });
}

// ============ PRODUCTS ============

export interface Cin7Product {
  ID: string;
  SKU: string;
  Name: string;
  Category: string;
  Brand: string;
  Status: string;
  StockOnHand: number;
  Price: number;
}

// Search products
export async function searchProducts(
  search: string
): Promise<{ Products: Cin7Product[]; Total: number }> {
  try {
    const res = await fetch(
      `${CIN7_BASE_URL}/product?Search=${encodeURIComponent(search)}&Page=1&Limit=10`,
      { headers: getHeaders() }
    );
    if (!res.ok) return { Products: [], Total: 0 };
    return res.json();
  } catch (error) {
    console.error("Cin7 searchProducts error:", error);
    return { Products: [], Total: 0 };
  }
}

// ============ FORMATTERS ============

export function formatSaleForChat(sale: Cin7Sale): string {
  const orderNumber = sale.Order?.SaleOrderNumber || `Order ${sale.ID.slice(0, 8)}`;
  const total = sale.Order?.Total || sale.Invoices?.[0]?.Total || 0;
  const saleLines = sale.Order?.Lines || sale.Invoices?.[0]?.Lines || [];

  const lines = [
    `**${orderNumber}**`,
    `**Status:** ${sale.Status}`,
    `**Date:** ${new Date(sale.SaleOrderDate).toLocaleDateString("en-AU")}`,
    `**Customer:** ${sale.Customer}`,
    `**Total:** $${total.toFixed(2)}`,
  ];

  // Add shipping info if available
  if (sale.Carrier) {
    lines.push("");
    lines.push("**Shipping:**");
    lines.push(`Carrier: ${sale.Carrier}`);
    if (sale.CombinedTrackingNumbers) {
      lines.push(`Tracking: ${sale.CombinedTrackingNumbers}`);
    }
  }

  // Add line items summary
  if (saleLines.length > 0) {
    lines.push("");
    lines.push("**Items:**");
    saleLines.slice(0, 5).forEach((item) => {
      lines.push(`- ${item.Name || "Item"} x${item.Quantity}`);
    });
    if (saleLines.length > 5) {
      lines.push(`- ...and ${saleLines.length - 5} more items`);
    }
  }

  return lines.join("\n");
}

export function formatCustomerForChat(customer: Cin7Customer): string {
  const lines = [
    `**${customer.Name}**`,
    `**Email:** ${customer.Email || "N/A"}`,
    `**Phone:** ${customer.Phone || "N/A"}`,
    `**Status:** ${customer.Status}`,
  ];

  // Use first address from Addresses array
  const address = customer.Addresses?.[0];
  if (address) {
    lines.push("");
    lines.push("**Address:**");
    if (address.Line1) lines.push(address.Line1);
    const cityLine = [address.City, address.State, address.Postcode]
      .filter(Boolean)
      .join(", ");
    if (cityLine) lines.push(cityLine);
  }

  return lines.join("\n");
}

export function formatSalesListForChat(sales: Cin7SaleListItem[]): string {
  if (sales.length === 0) {
    return "No orders found.";
  }

  const lines = [`Found ${sales.length} order(s):\n`];

  sales.forEach((sale, index) => {
    const total = sale.SaleInvoicesTotalAmount || sale.InvoiceAmount || 0;
    lines.push(`**${index + 1}. ${sale.OrderNumber}**`);
    lines.push(`   Status: ${sale.Status}`);
    lines.push(`   Date: ${new Date(sale.OrderDate).toLocaleDateString("en-AU")}`);
    lines.push(`   Total: $${total.toFixed(2)}`);
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Format a Cin7SaleListItem for chat display (quick summary from list endpoint)
 * Use this when you only have list data, not full sale details
 */
export function formatSaleListItemForChat(sale: Cin7SaleListItem): string {
  const total = sale.SaleInvoicesTotalAmount || sale.InvoiceAmount || 0;

  const lines = [
    `**Order: ${sale.OrderNumber}**`,
    `**Status:** ${sale.Status}`,
    `**Order Status:** ${sale.OrderStatus}`,
    `**Date:** ${new Date(sale.OrderDate).toLocaleDateString("en-AU")}`,
    `**Customer:** ${sale.Customer}`,
    `**Total:** $${total.toFixed(2)} ${sale.BaseCurrency || ""}`.trim(),
  ];

  // Add invoice info if available
  if (sale.InvoiceNumber) {
    lines.push(`**Invoice:** ${sale.InvoiceNumber}`);
  }

  // Add shipping status if available
  if (sale.CombinedShippingStatus) {
    lines.push("");
    lines.push("**Shipping:**");
    lines.push(`Status: ${sale.CombinedShippingStatus}`);
    if (sale.CombinedTrackingNumbers) {
      lines.push(`Tracking: ${sale.CombinedTrackingNumbers}`);
    }
  }

  // Add source channel if available
  if (sale.SourceChannel) {
    lines.push(`**Source:** ${sale.SourceChannel}`);
  }

  return lines.join("\n");
}

// ============ ORDER INTENT DETECTION ============

export interface Cin7OrderIntent {
  hasOrderIntent: boolean;
  orderNumber?: string;
  email?: string;
}

export function detectCin7OrderIntent(message: string): Cin7OrderIntent {
  const lowerMessage = message.toLowerCase();

  // Check for order-related keywords
  const orderKeywords = [
    "order",
    "tracking",
    "delivery",
    "shipment",
    "shipped",
    "dispatch",
    "status",
    "where is",
    "where's",
    "so-",
    "look up",
    "lookup",
  ];

  const hasOrderIntent = orderKeywords.some((keyword) =>
    lowerMessage.includes(keyword)
  );

  let orderNumber: string | undefined;

  // First, check for SO- prefix format (most specific for Cin7)
  // Matches: SO-05172, so-05172, SO05172, so05172
  const soMatch = message.match(/\bSO-?(\d+)\b/i);
  if (soMatch) {
    // Normalize to SO-XXXXX format (uppercase with hyphen)
    orderNumber = `SO-${soMatch[1]}`;
  }

  // If no SO- format found, check for generic order number patterns
  if (!orderNumber) {
    const orderPatterns = [
      /\border\s*#?\s*(\d{5,})\b/i, // order #12345 or order 12345
      /\b#(\d{5,})\b/, // #12345
    ];

    for (const pattern of orderPatterns) {
      const match = message.match(pattern);
      if (match) {
        orderNumber = match[1];
        break;
      }
    }
  }

  // Extract email if present
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
  const email = emailMatch ? emailMatch[0] : undefined;

  return {
    hasOrderIntent,
    orderNumber,
    email,
  };
}
