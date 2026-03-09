import { NextRequest, NextResponse } from "next/server";
import { getSale, getCustomer } from "@/lib/cin7";
import { getWooOrder } from "@/lib/woocommerce";
import { cin7ToUnifiedOrder, wooToUnifiedOrder } from "@/lib/order-merge";

async function buildCin7OrderResponse(cin7Sale: NonNullable<Awaited<ReturnType<typeof getSale>>>) {
  const order = cin7ToUnifiedOrder(cin7Sale);

  // Fetch customer payment info if we have a customer ID
  if (cin7Sale.CustomerID) {
    try {
      const customer = await getCustomer(cin7Sale.CustomerID);
      if (customer) {
        order.paymentInfo = {
          paymentTerm: customer.PaymentTerm || undefined,
          creditLimit: customer.CreditLimit || undefined,
          accountReceivable: customer.AccountReceivable || undefined,
        };
      }
    } catch {
      // Non-critical — continue without payment info
    }
  }

  return order;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Check if it's a WooCommerce order (prefixed with woo-)
    if (id.startsWith("woo-")) {
      const wooId = parseInt(id.replace("woo-", ""), 10);
      const wooOrder = await getWooOrder(wooId);

      if (!wooOrder) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      return NextResponse.json({
        order: wooToUnifiedOrder(wooOrder),
      });
    }

    // Check if it's a Cin7 order (prefixed with cin7-)
    if (id.startsWith("cin7-")) {
      const cin7Id = id.replace("cin7-", "");
      const cin7Sale = await getSale(cin7Id);

      if (!cin7Sale) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      return NextResponse.json({
        order: await buildCin7OrderResponse(cin7Sale),
      });
    }

    // Try Cin7 first (default)
    const cin7Sale = await getSale(id);
    if (cin7Sale) {
      return NextResponse.json({
        order: await buildCin7OrderResponse(cin7Sale),
      });
    }

    // Try WooCommerce as fallback (if ID is numeric)
    const numericId = parseInt(id, 10);
    if (!isNaN(numericId)) {
      const wooOrder = await getWooOrder(numericId);
      if (wooOrder) {
        return NextResponse.json({
          order: wooToUnifiedOrder(wooOrder),
        });
      }
    }

    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  } catch (error) {
    console.error("Order detail API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}
