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

export interface Cin7Sale {
  ID: string;
  OrderNumber: string;
  Status: string;
  OrderDate: string;
  CustomerName: string;
  CustomerEmail: string;
  Total: number;
  ShippingAddress?: {
    Line1: string;
    City: string;
    State: string;
    Postcode: string;
    Country: string;
  };
  Fulfilments?: Array<{
    FulfilmentNumber: string;
    Status: string;
    Ship?: {
      Status: string;
      TrackingNumber: string;
      Carrier: string;
      ShipDate: string;
    };
  }>;
  Lines?: Array<{
    ProductCode: string;
    ProductName: string;
    Quantity: number;
    Price: number;
    Total: number;
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

// Search sales by various criteria
export async function searchSales(params: {
  search?: string; // Order number search
  customerID?: string;
  status?: string; // DRAFT, ORDERING, APPROVED, etc.
  modifiedSince?: string; // ISO date
  page?: number;
  limit?: number;
}): Promise<{ SaleList: Cin7Sale[]; Total: number }> {
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
    return res.json();
  } catch (error) {
    console.error("Cin7 searchSales error:", error);
    return { SaleList: [], Total: 0 };
  }
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
  Status: string;
  Currency?: string;
  PaymentTerm?: string;
  AccountReceivable?: number;
  RevenueAccount?: string;
  TaxRule?: string;
  Discount?: number;
  CreditLimit?: number;
  Comments?: string;
  Addresses?: Cin7Address[];
  Contacts?: Cin7Contact[];
  LastModifiedOn?: string;
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
    return res.json();
  } catch (error) {
    console.error("Cin7 getCustomer error:", error);
    return null;
  }
}

// List customers with pagination
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
    return res.json();
  } catch (error) {
    console.error("Cin7 listCustomers error:", error);
    return { CustomerList: [], Total: 0 };
  }
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
): Promise<{ SaleList: Cin7Sale[]; Total: number }> {
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
  const lines = [
    `**Order ${sale.OrderNumber}**`,
    `**Status:** ${sale.Status}`,
    `**Date:** ${new Date(sale.OrderDate).toLocaleDateString("en-AU")}`,
    `**Customer:** ${sale.CustomerName}`,
    `**Total:** $${sale.Total?.toFixed(2) || "0.00"}`,
  ];

  // Add shipping info if available
  if (sale.Fulfilments && sale.Fulfilments.length > 0) {
    const fulfilment = sale.Fulfilments[0];
    if (fulfilment.Ship) {
      lines.push("");
      lines.push("**Shipping:**");
      if (fulfilment.Ship.Carrier)
        lines.push(`Carrier: ${fulfilment.Ship.Carrier}`);
      if (fulfilment.Ship.TrackingNumber)
        lines.push(`Tracking: ${fulfilment.Ship.TrackingNumber}`);
      if (fulfilment.Ship.Status)
        lines.push(`Status: ${fulfilment.Ship.Status}`);
      if (fulfilment.Ship.ShipDate)
        lines.push(
          `Shipped: ${new Date(fulfilment.Ship.ShipDate).toLocaleDateString("en-AU")}`
        );
    }
  }

  // Add line items summary
  if (sale.Lines && sale.Lines.length > 0) {
    lines.push("");
    lines.push("**Items:**");
    sale.Lines.slice(0, 5).forEach((item) => {
      lines.push(`- ${item.ProductName} x${item.Quantity}`);
    });
    if (sale.Lines.length > 5) {
      lines.push(`- ...and ${sale.Lines.length - 5} more items`);
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

  if (customer.Address) {
    lines.push("");
    lines.push("**Address:**");
    lines.push(`${customer.Address.Line1}`);
    lines.push(
      `${customer.Address.City}, ${customer.Address.State} ${customer.Address.Postcode}`
    );
  }

  return lines.join("\n");
}

export function formatSalesListForChat(sales: Cin7Sale[]): string {
  if (sales.length === 0) {
    return "No orders found.";
  }

  const lines = [`Found ${sales.length} order(s):\n`];

  sales.forEach((sale, index) => {
    lines.push(`**${index + 1}. ${sale.OrderNumber}**`);
    lines.push(`   Status: ${sale.Status}`);
    lines.push(`   Date: ${new Date(sale.OrderDate).toLocaleDateString("en-AU")}`);
    lines.push(`   Total: $${sale.Total?.toFixed(2) || "0.00"}`);
    lines.push("");
  });

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
