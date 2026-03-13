/**
 * Cin7 API Throttle Wrapper for Production Intelligence
 *
 * Wraps the existing Cin7 API client with:
 * - 600ms minimum delay between calls (conservative vs Cin7 rate limit)
 * - 429 retry with exponential backoff
 * - Request logging
 */

const CIN7_BASE_URL = "https://inventory.dearsystems.com/ExternalApi/v2";

function getHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "api-auth-accountid": process.env.CIN7_ACCOUNT_ID!,
    "api-auth-applicationkey": process.env.CIN7_API_KEY!,
  };
}

// Shared throttle state — ensures 600ms gap between ANY Cin7 call
let lastCallTime = 0;
const MIN_DELAY_MS = 600;

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - elapsed));
  }
  lastCallTime = Date.now();
}

/**
 * Make a throttled Cin7 API call with retry on 429
 */
export async function cin7Fetch<T = unknown>(
  endpoint: string,
  params?: Record<string, string | number>,
  maxRetries = 3
): Promise<T> {
  const query = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      query.set(k, String(v));
    }
  }

  const url = `${CIN7_BASE_URL}/${endpoint}${query.toString() ? `?${query}` : ""}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await throttle();

    const res = await fetch(url, { headers: getHeaders() });

    if (res.status === 429) {
      // Rate limited — exponential backoff
      const backoff = Math.min(2000 * Math.pow(2, attempt), 30000);
      console.warn(`[PI] Cin7 429 rate limit on ${endpoint}, backing off ${backoff}ms (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }

    if (!res.ok) {
      throw new Error(`Cin7 API error: ${res.status} ${res.statusText} on ${endpoint}`);
    }

    const data = await res.json();

    // Cin7 returns HTTP 200 with errors in body
    if (data.Errors && Array.isArray(data.Errors) && data.Errors.length > 0) {
      throw new Error(`Cin7 API error: ${data.Errors.join(", ")}`);
    }

    return data as T;
  }

  throw new Error(`Cin7 API: max retries exceeded on ${endpoint}`);
}

// ─── Typed Cin7 Responses ───────────────────────────────────────────────────

export interface Cin7ProductListResponse {
  Products: Array<{
    ID: string;
    SKU: string;
    Name: string;
    Category: string;
    Brand: string;
    Status: string;
    StockOnHand: number;
    Price: number;
    UOM?: string;
    Type?: string;
    CostingMethod?: string;
  }>;
  Total: number;
}

export interface Cin7SaleListResponse {
  SaleList: Array<{
    SaleID: string;
    OrderNumber: string;
    Status: string;
    OrderDate: string;
    Customer: string;
    CustomerID: string;
    InvoiceAmount: number;
    SaleInvoicesTotalAmount: number;
    SourceChannel?: string;
    Updated: string;
  }>;
  Total: number;
}

export interface Cin7SaleDetailResponse {
  ID: string;
  Status: string;
  Customer: string;
  CustomerID: string;
  SaleOrderDate: string;
  SourceChannel?: string;
  Order?: {
    SaleOrderNumber: string;
    Lines: Array<{
      ProductID?: string;
      SKU?: string;
      Name?: string;
      Quantity: number;
      Price: number;
      Total: number;
    }>;
  };
  Invoices?: Array<{
    Lines: Array<{
      ProductID?: string;
      SKU?: string;
      Name?: string;
      Quantity: number;
      Price: number;
      Total: number;
    }>;
  }>;
}

export interface Cin7StockResponse {
  StockOnHand: Array<{
    ProductID: string;
    SKU: string;
    Name: string;
    Location: string;
    Available: number;
    OnHand: number;
    Allocated: number;
    OnOrder?: number;
  }>;
  Total: number;
}

export interface Cin7PurchaseOrderListResponse {
  PurchaseList: Array<{
    PurchaseID: string;
    OrderNumber: string;
    Status: string;
    Supplier: string;
    OrderDate: string;
    RequiredBy?: string;
    Updated: string;
  }>;
  Total: number;
}

export interface Cin7PurchaseOrderDetailResponse {
  ID: string;
  OrderNumber: string;
  Status: string;
  Supplier: string;
  OrderDate: string;
  RequiredBy?: string;
  Order?: {
    Lines: Array<{
      ProductID?: string;
      SKU?: string;
      Name?: string;
      Quantity: number;
      Price: number;
      Total: number;
      Received?: number;
    }>;
  };
}

export interface Cin7BOMResponse {
  ProductFamilies?: Array<{
    ProductFamilyID: string;
    Name: string;
    Products: Array<{
      ProductID: string;
      SKU: string;
      Name: string;
      Quantity: number;
      Type: string; // "Product" or "Service"
    }>;
  }>;
  // Alternative: Cin7 may return BOMs differently
  BillOfMaterialsProducts?: Array<{
    ProductID: string;
    SKU: string;
    Name: string;
    Components: Array<{
      ComponentProductID: string;
      ComponentSKU: string;
      ComponentName: string;
      Quantity: number;
      UOM?: string;
    }>;
  }>;
}
