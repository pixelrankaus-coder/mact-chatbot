import { NextResponse } from "next/server";
import { getSegmentsWithCounts, SEGMENTS } from "@/lib/outreach/segments";

// GET /api/outreach/segments - Get all segments with recipient counts
export async function GET() {
  try {
    const segments = await getSegmentsWithCounts();
    return NextResponse.json({ segments });
  } catch (error) {
    console.error("Segments fetch error:", error);
    // Return segments without counts on error
    return NextResponse.json({ segments: SEGMENTS });
  }
}
