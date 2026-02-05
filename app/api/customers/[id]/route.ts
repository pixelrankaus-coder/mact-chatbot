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
      // Try Cin7 - get from Supabase cache first for accurate order totals
      const supabase = createServiceClient() as SupabaseAny;

      // Check if this is a Cin7 ID format (starts with cin7- or is a UUID)
      const cin7Id = id.startsWith("cin7-") ? id.replace("cin7-", "") : id;

      // First try to get customer from Supabase cache
      const { data: dbCustomer } = await supabase
        .from("cin7_customers")
        .select("*")
        .eq("cin7_id", cin7Id)
        .single();

      if (dbCustomer) {
        // Found in database - use cached data
        customer = {
          id: `cin7-${dbCustomer.cin7_id}`,
          cin7Id: dbCustomer.cin7_id,
          name: dbCustomer.name || "",
          email: dbCustomer.email || "",
          phone: dbCustomer.phone || dbCustomer.raw_data?.Phone || "",
          company: dbCustomer.company || dbCustomer.name || "",
          status: dbCustomer.status?.toLowerCase() === "active" ? "active" : "inactive",
          sources: ["cin7"] as ("cin7" | "woocommerce")[],
          lastUpdated: dbCustomer.updated_at || "",
          cin7Data: {
            currency: dbCustomer.currency,
            paymentTerm: dbCustomer.payment_term,
            creditLimit: dbCustomer.credit_limit ? parseFloat(String(dbCustomer.credit_limit)) : undefined,
            discount: dbCustomer.discount ? parseFloat(String(dbCustomer.discount)) : undefined,
            taxNumber: dbCustomer.tax_number,
            tags: dbCustomer.tags,
            priceTier: dbCustomer.raw_data?.PriceTier,
            taxRule: dbCustomer.raw_data?.TaxRule,
            carrier: dbCustomer.raw_data?.Carrier,
            location: dbCustomer.raw_data?.Location,
            salesRepresentative: dbCustomer.raw_data?.SalesRepresentative,
            comments: dbCustomer.raw_data?.Comments,
          },
        };

        // Get Cin7 orders from Supabase cache (has accurate totals)
        const { data: dbOrders } = await supabase
          .from("cin7_orders")
          .select("*")
          .eq("customer_id", cin7Id)
          .order("order_date", { ascending: false });

        if (dbOrders) {
          cin7Orders = dbOrders.map((o: SupabaseAny) => ({
            ID: o.cin7_id,
            OrderNumber: o.order_number,
            Status: o.status,
            OrderDate: o.order_date,
            Total: o.total,
            Currency: o.currency,
            InvoiceNumber: o.invoice_number,
            TrackingNumber: o.tracking_number,
            ShippingStatus: o.shipping_status,
          }));
        }

        // Try to find matching WooCommerce customer by email
        if (customer.email) {
          const { data: wooCustomerDb } = await supabase
            .from("woo_customers")
            .select("*")
            .eq("email", customer.email.toLowerCase())
            .single();

          if (wooCustomerDb) {
            // Merge WooCommerce data
            customer.wooId = wooCustomerDb.woo_id;
            customer.sources = ["cin7", "woocommerce"];
            customer.totalOrders = wooCustomerDb.orders_count;
            customer.totalSpent = wooCustomerDb.total_spent || 0;
            customer.wooData = {
              username: wooCustomerDb.username,
              ordersCount: wooCustomerDb.orders_count,
              totalSpent: wooCustomerDb.total_spent,
              avatarUrl: wooCustomerDb.avatar_url,
              billingAddress: wooCustomerDb.billing_address,
              shippingAddress: wooCustomerDb.shipping_address,
            };

            // Get WooCommerce orders from cache
            const { data: wooOrdersDb } = await supabase
              .from("woo_orders")
              .select("*")
              .eq("customer_email", customer.email.toLowerCase())
              .order("order_date", { ascending: false });

            if (wooOrdersDb) {
              wooOrders = wooOrdersDb.map((o: SupabaseAny) => ({
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
          }
        }
      } else {
        // Not in cache, fall back to live Cin7 API
        const cin7Customer = await getCustomer(cin7Id);

        if (cin7Customer) {
          customer = cin7ToUnified(cin7Customer);

          // Get Cin7 orders from API
          const ordersResult = await getCustomerOrders(cin7Id, 50);
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
