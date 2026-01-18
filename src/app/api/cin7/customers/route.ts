import { NextRequest, NextResponse } from "next/server";
import {
  searchCustomers,
  getCustomer,
  formatCustomerForChat,
} from "@/lib/cin7";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const id = searchParams.get("id");
  const search = searchParams.get("search");
  const email = searchParams.get("email");

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

    // Search by email or general search
    const searchTerm = email || search;
    if (searchTerm) {
      const results = await searchCustomers(searchTerm);

      if (results.CustomerList && results.CustomerList.length > 0) {
        // If searching by email, return formatted info for the first match
        if (email) {
          return NextResponse.json({
            customer: results.CustomerList[0],
            formatted: formatCustomerForChat(results.CustomerList[0]),
          });
        }

        // General search returns list
        return NextResponse.json({
          customers: results.CustomerList,
          total: results.Total,
        });
      }

      return NextResponse.json(
        { error: "No customers found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Provide id, search, or email parameter" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Cin7 customers API error:", error);
    return NextResponse.json({ error: "Cin7 API error" }, { status: 500 });
  }
}
