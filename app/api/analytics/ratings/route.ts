import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get("days") || "30", 10);

  try {
    const supabase = createServiceClient() as SupabaseAny;

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: ratings } = await supabase
      .from("chat_ratings")
      .select("rating, created_at")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false });

    if (!ratings || ratings.length === 0) {
      return NextResponse.json({
        total: 0,
        average: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        recentTrend: [],
      });
    }

    // Calculate distribution
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;

    ratings.forEach((r: { rating: number }) => {
      distribution[r.rating]++;
      sum += r.rating;
    });

    // Calculate daily trend (last 7 days)
    const recentTrend: { date: string; average: number; count: number }[] = [];
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const dayRatings = ratings.filter((r: { created_at: string }) =>
        r.created_at.startsWith(dateStr)
      );

      if (dayRatings.length > 0) {
        const daySum = dayRatings.reduce(
          (acc: number, r: { rating: number }) => acc + r.rating,
          0
        );
        recentTrend.push({
          date: dateStr,
          average: Number((daySum / dayRatings.length).toFixed(1)),
          count: dayRatings.length,
        });
      } else {
        recentTrend.push({
          date: dateStr,
          average: 0,
          count: 0,
        });
      }
    }

    return NextResponse.json({
      total: ratings.length,
      average: Number((sum / ratings.length).toFixed(1)),
      distribution,
      recentTrend: recentTrend.reverse(),
    });
  } catch (error) {
    console.error("Analytics ratings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ratings analytics" },
      { status: 500 }
    );
  }
}
