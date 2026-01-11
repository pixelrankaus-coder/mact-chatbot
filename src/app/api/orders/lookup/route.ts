import { NextRequest, NextResponse } from "next/server";
import {
  lookupOrderByNumber,
  lookupOrdersByEmail,
  formatOrderForChat,
  formatOrdersListForChat,
} from "@/lib/woocommerce";

// CORS headers for widget access
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * GET /api/orders/lookup
 * Query params:
 *   - order_number: Look up by order number
 *   - email: Look up by customer email
 *   - format: "raw" (default) or "chat" (formatted for chat display)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get("order_number");
    const email = searchParams.get("email");
    const format = searchParams.get("format") || "raw";

    // Validate input
    if (!orderNumber && !email) {
      return NextResponse.json(
        {
          success: false,
          error: "Please provide either an order number or email address.",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Look up by order number
    if (orderNumber) {
      const result = await lookupOrderByNumber(orderNumber);

      if (!result.success) {
        return NextResponse.json(result, { status: 404, headers: corsHeaders });
      }

      // Format for chat if requested
      if (format === "chat" && result.order) {
        return NextResponse.json(
          {
            success: true,
            formatted: formatOrderForChat(result.order),
            order: result.order,
          },
          { headers: corsHeaders }
        );
      }

      return NextResponse.json(result, { headers: corsHeaders });
    }

    // Look up by email
    if (email) {
      const result = await lookupOrdersByEmail(email);

      if (!result.success) {
        return NextResponse.json(result, { status: 404, headers: corsHeaders });
      }

      // Format for chat if requested
      if (format === "chat" && result.orders) {
        return NextResponse.json(
          {
            success: true,
            formatted: formatOrdersListForChat(result.orders),
            orders: result.orders,
          },
          { headers: corsHeaders }
        );
      }

      return NextResponse.json(result, { headers: corsHeaders });
    }

    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Order lookup error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred while looking up the order.",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
