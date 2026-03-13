import { NextResponse } from "next/server";
import { runScheduler } from "@/lib/pi/scheduler";

/**
 * POST /api/production-intelligence/schedule/run
 * Triggers the scheduling engine
 */
export async function POST() {
  try {
    const result = await runScheduler();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Scheduler] Run error:", error);
    return NextResponse.json(
      { error: "Failed to run scheduler" },
      { status: 500 }
    );
  }
}
