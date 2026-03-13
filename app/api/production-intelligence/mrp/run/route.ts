import { NextResponse } from "next/server";
import { runMRPForAllPilotSkus } from "@/lib/pi/mrp-engine";

/**
 * POST /api/production-intelligence/mrp/run
 * Triggers MRP engine for all pilot SKUs
 */
export async function POST() {
  try {
    const result = await runMRPForAllPilotSkus();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[MRP] Run error:", error);
    return NextResponse.json(
      { error: "Failed to run MRP engine" },
      { status: 500 }
    );
  }
}
