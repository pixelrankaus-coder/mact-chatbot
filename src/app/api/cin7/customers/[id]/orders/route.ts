import { NextRequest, NextResponse } from "next/server";
import { getCustomerOrders } from "@/lib/cin7";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const result = await getCustomerOrders(id, limit);

    return NextResponse.json({
      orders: result.SaleList,
      total: result.Total,
    });
  } catch (error) {
    console.error("Cin7 customer orders API error:", error);
    return NextResponse.json({ error: "Cin7 API error" }, { status: 500 });
  }
}
