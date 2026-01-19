import { NextRequest, NextResponse } from "next/server";
import {
  searchSales,
  getSale,
  formatSaleForChat,
  formatSaleListItemForChat,
  formatSalesListForChat,
} from "@/lib/cin7";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const id = searchParams.get("id");
  const orderNumber = searchParams.get("orderNumber");
  const search = searchParams.get("search");

  try {
    // Get single sale by ID
    if (id) {
      const sale = await getSale(id);
      if (!sale) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      return NextResponse.json({
        sale,
        formatted: formatSaleForChat(sale),
      });
    }

    // Search by order number
    if (orderNumber) {
      const results = await searchSales({ search: orderNumber, limit: 1 });
      if (results.SaleList && results.SaleList.length > 0) {
        const saleListItem = results.SaleList[0];
        // Try to fetch full details for richer information
        const fullSale = await getSale(saleListItem.SaleID);
        if (fullSale) {
          return NextResponse.json({
            sale: fullSale,
            formatted: formatSaleForChat(fullSale),
          });
        }
        // Fall back to list item data
        return NextResponse.json({
          sale: saleListItem,
          formatted: formatSaleListItemForChat(saleListItem),
        });
      }
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // General search
    if (search) {
      const results = await searchSales({ search, limit: 10 });
      return NextResponse.json({
        sales: results.SaleList,
        total: results.Total,
        formatted: formatSalesListForChat(results.SaleList),
      });
    }

    // Need at least one search parameter
    return NextResponse.json(
      { error: "Provide id, orderNumber, or search parameter" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Cin7 sales API error:", error);
    return NextResponse.json({ error: "Cin7 API error" }, { status: 500 });
  }
}
