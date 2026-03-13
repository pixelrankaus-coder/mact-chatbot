import { NextRequest, NextResponse } from "next/server";
import { getScheduleForDateRange } from "@/lib/pi/scheduler";

/**
 * GET /api/production-intelligence/schedule?start=2026-03-14&end=2026-03-20
 * Returns scheduled production runs for a date range
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { error: "start and end query params required" },
        { status: 400 }
      );
    }

    const result = await getScheduleForDateRange(start, end);

    if (result.error) {
      return NextResponse.json({ runs: [], error: result.error });
    }

    // Enrich with SKU details
    const { createServiceClient } = await import("@/lib/supabase");
    const supabase = createServiceClient();

    const skuIds = [...new Set(result.runs.map((r) => r.sku_id))];

    if (skuIds.length > 0) {
      const { data: skus } = await supabase
        .from("pi_skus")
        .select("cin7_product_id, sku_code, name, category, std_batch_size")
        .in("cin7_product_id", skuIds);

      const skuMap = new Map(
        (skus || []).map((s) => [s.cin7_product_id, s])
      );

      const enriched = result.runs.map((r) => {
        const sku = skuMap.get(r.sku_id);
        return {
          ...r,
          sku_code: sku?.sku_code || r.sku_id,
          sku_name: sku?.name || "Unknown",
          category: sku?.category || null,
        };
      });

      return NextResponse.json({ runs: enriched });
    }

    return NextResponse.json({ runs: result.runs });
  } catch (error) {
    console.error("[Schedule] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch schedule" },
      { status: 500 }
    );
  }
}
