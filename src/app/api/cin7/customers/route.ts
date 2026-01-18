import { NextRequest, NextResponse } from "next/server";
import {
  listCustomers,
  getCustomer,
  formatCustomerForChat,
} from "@/lib/cin7";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const id = searchParams.get("id");
  const search = searchParams.get("search");
  const email = searchParams.get("email");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "25", 10);

  try {
    // Get customer by ID
    if (id) {
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
    }

    // Search by email - return single match
    if (email) {
      const results = await listCustomers({ search: email, limit: 1 });
      if (results.CustomerList && results.CustomerList.length > 0) {
        return NextResponse.json({
          customer: results.CustomerList[0],
          formatted: formatCustomerForChat(results.CustomerList[0]),
        });
      }
      return NextResponse.json(
        { error: "No customers found" },
        { status: 404 }
      );
    }

    // List customers with optional search and pagination
    const results = await listCustomers({ search: search || undefined, page, limit });

    return NextResponse.json({
      customers: results.CustomerList || [],
      total: results.Total || 0,
    });
  } catch (error) {
    console.error("Cin7 customers API error:", error);
    return NextResponse.json({ error: "Cin7 API error" }, { status: 500 });
  }
}
