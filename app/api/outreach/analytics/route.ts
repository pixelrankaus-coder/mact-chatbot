import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/outreach/analytics - Get aggregate analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from =
      searchParams.get("from") ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = searchParams.get("to") || new Date().toISOString();

    const supabase = getSupabase();

    // Get all campaigns in date range
    const { data: campaigns, error } = await supabase
      .from("outreach_campaigns")
      .select("*")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch campaigns:", error);
      return NextResponse.json(
        { error: "Failed to fetch analytics", details: error.message },
        { status: 500 }
      );
    }

    // Aggregate totals
    const overview = {
      total_campaigns: campaigns?.length || 0,
      total_sent: 0,
      total_delivered: 0,
      total_opened: 0,
      total_clicked: 0,
      total_replied: 0,
      total_bounced: 0,
    };

    campaigns?.forEach((c) => {
      overview.total_sent += c.sent_count || 0;
      overview.total_delivered += c.delivered_count || 0;
      overview.total_opened += c.opened_count || 0;
      overview.total_clicked += c.clicked_count || 0;
      overview.total_replied += c.replied_count || 0;
      overview.total_bounced += c.bounced_count || 0;
    });

    // Calculate rates
    const rates = {
      delivery_rate:
        overview.total_sent > 0
          ? ((overview.total_delivered / overview.total_sent) * 100).toFixed(1)
          : "0",
      open_rate:
        overview.total_delivered > 0
          ? ((overview.total_opened / overview.total_delivered) * 100).toFixed(1)
          : "0",
      click_rate:
        overview.total_delivered > 0
          ? ((overview.total_clicked / overview.total_delivered) * 100).toFixed(1)
          : "0",
      reply_rate:
        overview.total_delivered > 0
          ? ((overview.total_replied / overview.total_delivered) * 100).toFixed(1)
          : "0",
      bounce_rate:
        overview.total_sent > 0
          ? ((overview.total_bounced / overview.total_sent) * 100).toFixed(1)
          : "0",
    };

    // Campaign comparison
    const campaignComparison =
      campaigns?.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        created_at: c.created_at,
        sent: c.sent_count || 0,
        delivered: c.delivered_count || 0,
        open_rate:
          c.delivered_count > 0
            ? ((c.opened_count / c.delivered_count) * 100).toFixed(1)
            : "0",
        reply_rate:
          c.delivered_count > 0
            ? ((c.replied_count / c.delivered_count) * 100).toFixed(1)
            : "0",
        bounce_rate:
          c.sent_count > 0
            ? ((c.bounced_count / c.sent_count) * 100).toFixed(1)
            : "0",
      })) || [];

    // Industry benchmarks (for comparison)
    const benchmarks = {
      delivery_rate: {
        target: 95,
        rating:
          parseFloat(rates.delivery_rate) >= 95
            ? "excellent"
            : parseFloat(rates.delivery_rate) >= 90
              ? "good"
              : "fair",
      },
      open_rate: {
        target: 25,
        rating:
          parseFloat(rates.open_rate) >= 40
            ? "excellent"
            : parseFloat(rates.open_rate) >= 25
              ? "good"
              : "fair",
      },
      click_rate: {
        target: 4,
        rating:
          parseFloat(rates.click_rate) >= 10
            ? "excellent"
            : parseFloat(rates.click_rate) >= 4
              ? "good"
              : "fair",
      },
      reply_rate: {
        target: 2,
        rating:
          parseFloat(rates.reply_rate) >= 5
            ? "excellent"
            : parseFloat(rates.reply_rate) >= 2
              ? "good"
              : "fair",
      },
      bounce_rate: {
        target: 2,
        rating:
          parseFloat(rates.bounce_rate) <= 1
            ? "excellent"
            : parseFloat(rates.bounce_rate) <= 2
              ? "good"
              : "poor",
      },
    };

    return NextResponse.json({
      overview,
      rates,
      campaigns: campaignComparison,
      benchmarks,
      dateRange: { from, to },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
