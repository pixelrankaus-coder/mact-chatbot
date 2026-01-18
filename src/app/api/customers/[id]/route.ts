import { NextRequest, NextResponse } from "next/server";
import { getCustomer, getCustomerOrders } from "@/lib/cin7";
import { getWooCustomer, getWooCustomerOrders, WooCustomer } from "@/lib/woocommerce";
import { cin7ToUnified, wooToUnified } from "@/lib/customer-merge";
import { UnifiedCustomer } from "@/types/customer";

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
      const wooCustomer = await getWooCustomer(wooId);

      if (wooCustomer) {
        customer = wooToUnified(wooCustomer);
        wooOrders = await getWooCustomerOrders(wooId);
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
