import { NextRequest, NextResponse } from "next/server";
import { getCustomer, getCustomerOrders } from "@/lib/cin7";
import { getWooCustomer, getWooCustomerOrders, WooCustomer } from "@/lib/woocommerce";
import { cin7ToUnified, wooToUnified } from "@/lib/customer-merge";
import { UnifiedCustomer } from "@/types/customer";
import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    let customer: UnifiedCustomer | null = null;
    let cin7Orders: Awaited<ReturnType<typeof getCustomerOrders>>["SaleList"] = [];
    let wooOrders: Awaited<ReturnType<typeof getWooCustomerOrders>> = [];

    // Check if it's a WooCommerce ID (prefixed with woo-)
    if (id.startsWith("woo-")) {
      const wooId = parseInt(id.replace("woo-", ""), 10);

      // First try to get from Supabase cache (includes guest checkout customers)
      const supabase = createServiceClient() as SupabaseAny;
      const { data: dbCustomer } = await supabase
        .from("woo_customers")
        .select("*")
        .eq("woo_id", wooId)
        .single();

      if (dbCustomer) {
        // Found in database (could be guest or registered customer)
        customer = {
          id: `woo-${dbCustomer.woo_id}`,
          wooId: dbCustomer.woo_id,
          name: `${dbCustomer.first_name || ""} ${dbCustomer.last_name || ""}`.trim() || dbCustomer.email || "Guest",
          email: dbCustomer.email || "",
          phone: dbCustomer.phone || "",
          company: dbCustomer.company || "",
          status: "active" as const,
          sources: ["woocommerce"] as ("cin7" | "woocommerce")[],
          lastUpdated: dbCustomer.updated_at || "",
          totalOrders: dbCustomer.orders_count || 0,
          totalSpent: dbCustomer.total_spent || 0,
          wooData: {
            username: dbCustomer.username,
            ordersCount: dbCustomer.orders_count,
            totalSpent: dbCustomer.total_spent,
            avatarUrl: dbCustomer.avatar_url,
            billingAddress: dbCustomer.billing_address,
            shippingAddress: dbCustomer.shipping_address,
          },
        };

        // Get WooCommerce orders for this customer from database
        // For guest customers (negative woo_id), search by email
        if (wooId < 0 && dbCustomer.email) {
          const { data: orders } = await supabase
            .from("woo_orders")
            .select("*")
            .eq("customer_email", dbCustomer.email)
            .order("order_date", { ascending: false });

          if (orders) {
            wooOrders = orders.map((o: SupabaseAny) => ({
              id: o.woo_id,
              number: o.order_number,
              status: o.status,
              dateCreated: o.order_date,
              total: String(o.total),
              currency: o.currency,
              customerEmail: o.customer_email,
              customerName: o.customer_name,
              items: o.line_items || [],
            }));
          }
        } else if (wooId > 0) {
          // For registered customers, try API first
          wooOrders = await getWooCustomerOrders(wooId);
        }
      } else if (wooId > 0) {
        // Not in database, try WooCommerce API for registered customers only
        const wooCustomer = await getWooCustomer(wooId);

        if (wooCustomer) {
          customer = wooToUnified(wooCustomer);
          wooOrders = await getWooCustomerOrders(wooId);
        }
      }
    } else {
      // Try Cin7 first
      const cin7Customer = await getCustomer(id);

      if (cin7Customer) {
        customer = cin7ToUnified(cin7Customer);

        // Get Cin7 orders
        const ordersResult = await getCustomerOrders(id, 20);
        cin7Orders = ordersResult.SaleList || [];

        // Try to find matching WooCommerce customer by email
        if (customer.email) {
          const { getWooCustomers } = await import("@/lib/woocommerce");
          const wooResult = await getWooCustomers({ search: customer.email, per_page: 1 });

          if (wooResult.customers && wooResult.customers.length > 0) {
            const wooCustomer = wooResult.customers[0];
            // Check if email matches exactly
            if (wooCustomer.email.toLowerCase() === customer.email.toLowerCase()) {
              // Merge WooCommerce data
              customer.wooId = wooCustomer.id;
              customer.sources = ["cin7", "woocommerce"];
              customer.totalOrders = wooCustomer.orders_count;
              customer.totalSpent = parseFloat(wooCustomer.total_spent) || 0;
              customer.wooData = {
                username: wooCustomer.username,
                avatarUrl: wooCustomer.avatar_url,
                billing: wooCustomer.billing ? {
                  address_1: wooCustomer.billing.address_1,
                  address_2: wooCustomer.billing.address_2,
                  city: wooCustomer.billing.city,
                  state: wooCustomer.billing.state,
                  postcode: wooCustomer.billing.postcode,
                  country: wooCustomer.billing.country,
                } : undefined,
                shipping: wooCustomer.shipping ? {
                  address_1: wooCustomer.shipping.address_1,
                  address_2: wooCustomer.shipping.address_2,
                  city: wooCustomer.shipping.city,
                  state: wooCustomer.shipping.state,
                  postcode: wooCustomer.shipping.postcode,
                  country: wooCustomer.shipping.country,
                } : undefined,
              };

              // Get WooCommerce orders too
              wooOrders = await getWooCustomerOrders(wooCustomer.id);
            }
          }
        }
      }
    }

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({
      customer,
      cin7Orders,
      wooOrders,
    });
  } catch (error) {
    console.error("Unified customer detail API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer" },
      { status: 500 }
    );
  }
}
