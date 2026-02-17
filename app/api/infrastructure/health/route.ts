import { NextResponse } from "next/server";
import { runAllHealthChecks } from "@/lib/infrastructure-health";

export async function GET() {
  try {
    const result = await runAllHealthChecks();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Infrastructure health check error:", error);
    return NextResponse.json(
      { error: "Health check failed" },
      { status: 500 }
    );
  }
}
