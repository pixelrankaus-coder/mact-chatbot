import { NextRequest, NextResponse } from "next/server";
import { getCustomer, formatCustomerForChat } from "@/lib/cin7";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const customer = await getCustomer(id);
    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      customer,
      formatted: formatCustomerForChat(customer),
    });
  } catch (error) {
    console.error("Cin7 customer API error:", error);
    return NextResponse.json({ error: "Cin7 API error" }, { status: 500 });
  }
}
