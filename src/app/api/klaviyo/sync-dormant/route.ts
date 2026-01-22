/**
 * Klaviyo Sync Dormant Customers API
 * TASK MACT #040
 *
 * Syncs dormant customers (no order in 12+ months) to Klaviyo
 * with their full order history for win-back campaign personalization.
 *
 * Uses Server-Sent Events for real-time progress updates.
 */

import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  DormantCustomerProfile,
  DormantCustomerOrder,
  syncDormantCustomerToKlaviyo,
  getKlaviyoSettingsPublic,
} from "@/lib/klaviyo";
import { getSale } from "@/lib/cin7";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

export async function POST(req: NextRequest) {
  // Check for SSE request
  const acceptHeader = req.headers.get("accept");
  const useSSE = acceptHeader?.includes("text/event-stream");

  if (useSSE) {
    return handleSSESync();
  }

  // Non-SSE request - return summary only
  return handleSimpleSync();
}

/**
 * Handle SSE-based sync with real-time progress updates
 */
async function handleSSESync(): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Check Klaviyo settings
        const settings = await getKlaviyoSettingsPublic();
        if (!settings?.api_key) {
          send("error", { message: "Klaviyo integration not configured or disabled" });
          controller.close();
          return;
        }

        send("status", { message: "Fetching dormant customers..." });
        console.log("[Klaviyo Sync] Starting dormant customer sync...");

        // Get dormant customers from Supabase
        const dormantCustomers = await getDormantCustomers();
        console.log(`[Klaviyo Sync] Found ${dormantCustomers.length} dormant customers`);

        if (dormantCustomers.length === 0) {
          send("complete", {
            total: 0,
            succeeded: 0,
            failed: 0,
            message: "No dormant customers found to sync",
          });
          controller.close();
          return;
        }

        send("status", {
          message: `Found ${dormantCustomers.length} dormant customers to sync`,
          total: dormantCustomers.length,
        });

        let succeeded = 0;
        let failed = 0;

        // Process each customer
        for (let i = 0; i < dormantCustomers.length; i++) {
          const customer = dormantCustomers[i];

          send("progress", {
            total: dormantCustomers.length,
            processed: i,
            succeeded,
            failed,
            currentCustomer: customer.email || customer.firstName || "Unknown",
          });

          // TASK #041: Fetch last product from most recent order
          if (customer.orderHistory.length > 0 && !customer.lastProduct) {
            const mostRecentOrderId = customer.orderHistory[0].orderId;
            console.log(`[Klaviyo] Fetching sale details for order ${mostRecentOrderId}`);
            try {
              const saleDetails = await getSale(mostRecentOrderId);
              console.log(`[Klaviyo] Sale details result:`, saleDetails ? "found" : "null");
              if (saleDetails) {
                // Get first line item name from Order.Lines or Invoices[0].Lines
                const orderLines = saleDetails.Order?.Lines || [];
                const invoiceLines = saleDetails.Invoices?.[0]?.Lines || [];
                const lines = orderLines.length > 0 ? orderLines : invoiceLines;
                console.log(`[Klaviyo] Found ${lines.length} line items`);
                if (lines.length > 0 && lines[0].Name) {
                  customer.lastProduct = lines[0].Name;
                  console.log(`[Klaviyo] Last product for ${customer.email}: ${customer.lastProduct}`);
                }
              }
            } catch (err) {
              console.error(`[Klaviyo] Failed to fetch last product for ${customer.email}:`, err);
            }
          }

          const result = await syncDormantCustomerToKlaviyo(customer, settings);

          if (result.success) {
            succeeded++;
          } else {
            failed++;
            console.error(`Failed to sync customer ${customer.email}:`, result.error);
          }

          // Delay between customers to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        send("complete", {
          total: dormantCustomers.length,
          succeeded,
          failed,
          message: `Sync complete: ${succeeded} succeeded, ${failed} failed`,
        });
      } catch (error) {
        console.error("Dormant customer sync error:", error);
        send("error", {
          message: error instanceof Error ? error.message : "Unknown error occurred",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Handle simple sync without SSE (returns summary)
 */
async function handleSimpleSync(): Promise<Response> {
  try {
    const settings = await getKlaviyoSettingsPublic();
    if (!settings?.api_key) {
      return Response.json(
        { error: "Klaviyo integration not configured or disabled" },
        { status: 400 }
      );
    }

    const dormantCustomers = await getDormantCustomers();

    if (dormantCustomers.length === 0) {
      return Response.json({
        total: 0,
        succeeded: 0,
        failed: 0,
        message: "No dormant customers found to sync",
      });
    }

    let succeeded = 0;
    let failed = 0;

    for (const customer of dormantCustomers) {
      // TASK #041: Fetch last product from most recent order
      if (customer.orderHistory.length > 0 && !customer.lastProduct) {
        const mostRecentOrderId = customer.orderHistory[0].orderId;
        console.log(`[Klaviyo] Fetching sale details for order ${mostRecentOrderId}`);
        try {
          const saleDetails = await getSale(mostRecentOrderId);
          console.log(`[Klaviyo] Sale details result:`, saleDetails ? "found" : "null");
          if (saleDetails) {
            const orderLines = saleDetails.Order?.Lines || [];
            const invoiceLines = saleDetails.Invoices?.[0]?.Lines || [];
            const lines = orderLines.length > 0 ? orderLines : invoiceLines;
            console.log(`[Klaviyo] Found ${lines.length} line items`);
            if (lines.length > 0 && lines[0].Name) {
              customer.lastProduct = lines[0].Name;
              console.log(`[Klaviyo] Last product for ${customer.email}: ${customer.lastProduct}`);
            }
          }
        } catch (err) {
          console.error(`[Klaviyo] Failed to fetch last product for ${customer.email}:`, err);
        }
      }

      const result = await syncDormantCustomerToKlaviyo(customer, settings);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
      // Delay between customers to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return Response.json({
      total: dormantCustomers.length,
      succeeded,
      failed,
      message: `Sync complete: ${succeeded} succeeded, ${failed} failed`,
    });
  } catch (error) {
    console.error("Dormant customer sync error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
}

/**
 * Get all dormant customers from Supabase
 * Dormant = has ordered before, but no order in 12+ months
 */
async function getDormantCustomers(): Promise<DormantCustomerProfile[]> {
  const supabase = createServiceClient() as SupabaseAny;
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  // Get Cin7 customers
  const { data: cin7Customers, error: cin7Error } = await supabase
    .from("cin7_customers")
    .select("*");

  if (cin7Error) {
    console.error("Error fetching Cin7 customers:", cin7Error);
    throw new Error("Failed to fetch Cin7 customers");
  }

  // Get all Cin7 orders (paginated to handle large datasets)
  let cin7Orders: {
    cin7_id: string;
    customer_id: string;
    order_number: string;
    order_date: string;
    total: number;
    currency: string;
    status: string;
  }[] = [];
  let ordersPage = 0;
  const ordersPageSize = 1000;
  let hasMoreOrders = true;

  while (hasMoreOrders) {
    const { data: ordersChunk } = await supabase
      .from("cin7_orders")
      .select("cin7_id, customer_id, order_number, order_date, total, currency, status")
      .range(ordersPage * ordersPageSize, (ordersPage + 1) * ordersPageSize - 1);

    if (ordersChunk && ordersChunk.length > 0) {
      cin7Orders = cin7Orders.concat(ordersChunk);
      ordersPage++;
      hasMoreOrders = ordersChunk.length === ordersPageSize;
    } else {
      hasMoreOrders = false;
    }
  }

  // Build order data by customer_id
  const ordersByCustomer: Record<
    string,
    {
      orders: DormantCustomerOrder[];
      totalOrders: number;
      totalSpent: number;
      lastOrderDate: string | null;
    }
  > = {};

  cin7Orders.forEach((o) => {
    const cid = o.customer_id;
    if (!ordersByCustomer[cid]) {
      ordersByCustomer[cid] = {
        orders: [],
        totalOrders: 0,
        totalSpent: 0,
        lastOrderDate: null,
      };
    }
    ordersByCustomer[cid].orders.push({
      orderId: o.cin7_id,
      orderNumber: o.order_number,
      orderDate: o.order_date,
      total: parseFloat(String(o.total)) || 0,
      currency: o.currency || "AUD",
      status: o.status,
    });
    ordersByCustomer[cid].totalOrders++;
    ordersByCustomer[cid].totalSpent += parseFloat(String(o.total)) || 0;
    if (!ordersByCustomer[cid].lastOrderDate || o.order_date > ordersByCustomer[cid].lastOrderDate) {
      ordersByCustomer[cid].lastOrderDate = o.order_date;
    }
  });

  // Sort orders by date (most recent first) for each customer
  Object.values(ordersByCustomer).forEach((data) => {
    data.orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  });

  // Filter to dormant customers (has orders, but none in 12+ months)
  const dormantCustomers: DormantCustomerProfile[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cin7Customers.forEach((c: any) => {
    const customerOrders = ordersByCustomer[c.cin7_id];

    // Must have orders
    if (!customerOrders || customerOrders.totalOrders === 0) {
      return;
    }

    // Must have email for Klaviyo
    if (!c.email || !c.email.trim()) {
      return;
    }

    // Must be dormant (no order in 12+ months)
    const lastOrderDate = customerOrders.lastOrderDate
      ? new Date(customerOrders.lastOrderDate)
      : null;

    if (!lastOrderDate || lastOrderDate >= oneYearAgo) {
      return; // Not dormant
    }

    const daysSinceLastOrder = Math.floor(
      (now.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Parse name into first/last
    const nameParts = (c.name || "").trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    dormantCustomers.push({
      email: c.email.toLowerCase(),
      firstName,
      lastName,
      phone: c.phone || "",
      company: c.company || c.name || "",
      cin7Id: c.cin7_id,
      totalOrders: customerOrders.totalOrders,
      totalSpent: customerOrders.totalSpent,
      lastOrderDate: customerOrders.lastOrderDate || "",
      daysSinceLastOrder,
      orderHistory: customerOrders.orders,
    });
  });

  // Sort by total spent (highest value customers first)
  dormantCustomers.sort((a, b) => b.totalSpent - a.totalSpent);

  return dormantCustomers;
}

/**
 * GET endpoint to preview dormant customers (for testing)
 */
export async function GET() {
  try {
    const dormantCustomers = await getDormantCustomers();

    return Response.json({
      count: dormantCustomers.length,
      preview: dormantCustomers.slice(0, 10).map((c) => ({
        email: c.email,
        name: `${c.firstName} ${c.lastName}`.trim(),
        totalOrders: c.totalOrders,
        totalSpent: c.totalSpent,
        lastOrderDate: c.lastOrderDate,
        daysSinceLastOrder: c.daysSinceLastOrder,
        orderCount: c.orderHistory.length,
      })),
    });
  } catch (error) {
    console.error("Error fetching dormant customers:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
