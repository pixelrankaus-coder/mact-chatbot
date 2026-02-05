import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Utility to convert micros to dollars
function microsToDollars(micros: number | null): number {
  return (micros || 0) / 1000000;
}

// Utility to calculate CTR
function calcCtr(clicks: number, impressions: number): number {
  return impressions > 0 ? (clicks / impressions) * 100 : 0;
}

// Utility to calculate CPA
function calcCpa(costMicros: number, conversions: number): number | null {
  return conversions > 0 ? microsToDollars(costMicros) / conversions : null;
}

// Utility to calculate ROAS
function calcRoas(conversionValue: number, costMicros: number): number | null {
  const cost = microsToDollars(costMicros);
  return cost > 0 ? conversionValue / cost : null;
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);

    // Parse query parameters
    const period = searchParams.get("period") || "30"; // days
    const type = searchParams.get("type") || "summary"; // summary, campaigns, keywords, geo
    const connectionId = searchParams.get("connection_id");

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    // Get active connection if not specified
    let activeConnectionId = connectionId;
    if (!activeConnectionId) {
      const { data: connection } = await supabase
        .from("ppc_connections")
        .select("id")
        .eq("is_active", true)
        .single();

      if (!connection) {
        return NextResponse.json({
          error: "No active PPC connection",
          data: null,
        });
      }
      activeConnectionId = connection.id;
    }

    // Fetch data based on type
    switch (type) {
      case "summary": {
        // Get aggregate summary metrics
        const { data: campaignData, error } = await supabase
          .from("ppc_campaign_metrics")
          .select("impressions, clicks, cost_micros, conversions, conversion_value")
          .eq("connection_id", activeConnectionId)
          .gte("date", startDateStr)
          .lte("date", endDateStr);

        if (error) {
          console.error("Error fetching summary metrics:", error);
          return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
        }

        // Aggregate metrics
        const summary = (campaignData || []).reduce(
          (acc, row) => ({
            impressions: acc.impressions + (row.impressions || 0),
            clicks: acc.clicks + (row.clicks || 0),
            cost_micros: acc.cost_micros + (row.cost_micros || 0),
            conversions: acc.conversions + parseFloat(row.conversions || "0"),
            conversion_value: acc.conversion_value + parseFloat(row.conversion_value || "0"),
          }),
          { impressions: 0, clicks: 0, cost_micros: 0, conversions: 0, conversion_value: 0 }
        );

        // Calculate derived metrics
        const metrics = {
          impressions: summary.impressions,
          clicks: summary.clicks,
          spend: microsToDollars(summary.cost_micros),
          conversions: summary.conversions,
          conversion_value: summary.conversion_value,
          ctr: calcCtr(summary.clicks, summary.impressions),
          cpc: summary.clicks > 0 ? microsToDollars(summary.cost_micros) / summary.clicks : null,
          cpa: calcCpa(summary.cost_micros, summary.conversions),
          roas: calcRoas(summary.conversion_value, summary.cost_micros),
          period: parseInt(period),
        };

        return NextResponse.json({ data: metrics, type: "summary" });
      }

      case "campaigns": {
        // Get campaign-level metrics
        const { data, error } = await supabase
          .from("ppc_campaign_metrics")
          .select("*")
          .eq("connection_id", activeConnectionId)
          .gte("date", startDateStr)
          .lte("date", endDateStr)
          .order("date", { ascending: false });

        if (error) {
          console.error("Error fetching campaign metrics:", error);
          return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
        }

        // Group by campaign and aggregate
        const campaignMap = new Map<string, any>();
        (data || []).forEach((row) => {
          const existing = campaignMap.get(row.campaign_id) || {
            campaign_id: row.campaign_id,
            campaign_name: row.campaign_name,
            campaign_status: row.campaign_status,
            campaign_type: row.campaign_type,
            impressions: 0,
            clicks: 0,
            cost_micros: 0,
            conversions: 0,
            conversion_value: 0,
          };

          existing.impressions += row.impressions || 0;
          existing.clicks += row.clicks || 0;
          existing.cost_micros += row.cost_micros || 0;
          existing.conversions += parseFloat(row.conversions || "0");
          existing.conversion_value += parseFloat(row.conversion_value || "0");

          campaignMap.set(row.campaign_id, existing);
        });

        // Calculate derived metrics for each campaign
        const campaigns = Array.from(campaignMap.values()).map((c) => ({
          ...c,
          spend: microsToDollars(c.cost_micros),
          ctr: calcCtr(c.clicks, c.impressions),
          cpc: c.clicks > 0 ? microsToDollars(c.cost_micros) / c.clicks : null,
          cpa: calcCpa(c.cost_micros, c.conversions),
          roas: calcRoas(c.conversion_value, c.cost_micros),
        }));

        // Sort by spend descending
        campaigns.sort((a, b) => b.spend - a.spend);

        return NextResponse.json({ data: campaigns, type: "campaigns" });
      }

      case "keywords": {
        // Get keyword-level metrics
        const { data, error } = await supabase
          .from("ppc_keyword_metrics")
          .select("*")
          .eq("connection_id", activeConnectionId)
          .gte("date", startDateStr)
          .lte("date", endDateStr)
          .order("date", { ascending: false });

        if (error) {
          console.error("Error fetching keyword metrics:", error);
          return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
        }

        // Group by keyword and aggregate
        const keywordMap = new Map<string, any>();
        (data || []).forEach((row) => {
          const key = `${row.keyword_id}_${row.match_type}`;
          const existing = keywordMap.get(key) || {
            keyword_id: row.keyword_id,
            keyword_text: row.keyword_text,
            match_type: row.match_type,
            campaign_name: row.campaign_name,
            ad_group_name: row.ad_group_name,
            impressions: 0,
            clicks: 0,
            cost_micros: 0,
            conversions: 0,
            conversion_value: 0,
            quality_score: row.quality_score, // Take latest quality score
          };

          existing.impressions += row.impressions || 0;
          existing.clicks += row.clicks || 0;
          existing.cost_micros += row.cost_micros || 0;
          existing.conversions += parseFloat(row.conversions || "0");
          existing.conversion_value += parseFloat(row.conversion_value || "0");

          keywordMap.set(key, existing);
        });

        // Calculate derived metrics
        const keywords = Array.from(keywordMap.values()).map((k) => ({
          ...k,
          spend: microsToDollars(k.cost_micros),
          ctr: calcCtr(k.clicks, k.impressions),
          cpc: k.clicks > 0 ? microsToDollars(k.cost_micros) / k.clicks : null,
          cpa: calcCpa(k.cost_micros, k.conversions),
        }));

        // Sort by spend descending
        keywords.sort((a, b) => b.spend - a.spend);

        return NextResponse.json({ data: keywords.slice(0, 100), type: "keywords" }); // Limit to top 100
      }

      case "geo": {
        // Get geographic metrics
        const { data, error } = await supabase
          .from("ppc_geo_metrics")
          .select("*")
          .eq("connection_id", activeConnectionId)
          .gte("date", startDateStr)
          .lte("date", endDateStr)
          .order("date", { ascending: false });

        if (error) {
          console.error("Error fetching geo metrics:", error);
          return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
        }

        // Group by location and aggregate
        const geoMap = new Map<string, any>();
        (data || []).forEach((row) => {
          const existing = geoMap.get(row.location_name) || {
            location_id: row.location_id,
            location_name: row.location_name,
            location_type: row.location_type,
            impressions: 0,
            clicks: 0,
            cost_micros: 0,
            conversions: 0,
            conversion_value: 0,
          };

          existing.impressions += row.impressions || 0;
          existing.clicks += row.clicks || 0;
          existing.cost_micros += row.cost_micros || 0;
          existing.conversions += parseFloat(row.conversions || "0");
          existing.conversion_value += parseFloat(row.conversion_value || "0");

          geoMap.set(row.location_name, existing);
        });

        // Calculate derived metrics
        const geoData = Array.from(geoMap.values()).map((g) => ({
          ...g,
          spend: microsToDollars(g.cost_micros),
          ctr: calcCtr(g.clicks, g.impressions),
          cpa: calcCpa(g.cost_micros, g.conversions),
        }));

        // Sort by spend descending
        geoData.sort((a, b) => b.spend - a.spend);

        return NextResponse.json({ data: geoData, type: "geo" });
      }

      case "trend": {
        // Get daily trend data
        const { data, error } = await supabase
          .from("ppc_campaign_metrics")
          .select("date, impressions, clicks, cost_micros, conversions, conversion_value")
          .eq("connection_id", activeConnectionId)
          .gte("date", startDateStr)
          .lte("date", endDateStr)
          .order("date", { ascending: true });

        if (error) {
          console.error("Error fetching trend data:", error);
          return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
        }

        // Group by date
        const trendMap = new Map<string, any>();
        (data || []).forEach((row) => {
          const existing = trendMap.get(row.date) || {
            date: row.date,
            impressions: 0,
            clicks: 0,
            cost_micros: 0,
            conversions: 0,
            conversion_value: 0,
          };

          existing.impressions += row.impressions || 0;
          existing.clicks += row.clicks || 0;
          existing.cost_micros += row.cost_micros || 0;
          existing.conversions += parseFloat(row.conversions || "0");
          existing.conversion_value += parseFloat(row.conversion_value || "0");

          trendMap.set(row.date, existing);
        });

        // Calculate derived metrics and format
        const trend = Array.from(trendMap.values()).map((t) => ({
          date: t.date,
          impressions: t.impressions,
          clicks: t.clicks,
          spend: microsToDollars(t.cost_micros),
          conversions: t.conversions,
          ctr: calcCtr(t.clicks, t.impressions),
        }));

        return NextResponse.json({ data: trend, type: "trend" });
      }

      default:
        return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
    }
  } catch (error) {
    console.error("PPC metrics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
