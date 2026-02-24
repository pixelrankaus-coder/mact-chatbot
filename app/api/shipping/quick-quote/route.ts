import { NextRequest, NextResponse } from "next/server";
import { getRates, type StarshipitAddress, type StarshipitPackage } from "@/lib/starshipit";

/**
 * GET /api/shipping/quick-quote?postcode=2000&weight=20&state=NSW
 *
 * Simplified endpoint — just postcode + weight.
 * Used for the admin UI "Get Shipping Quote" button.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postcode = searchParams.get("postcode");
    const weightStr = searchParams.get("weight");
    const state = searchParams.get("state") || undefined;
    const suburb = searchParams.get("suburb") || undefined;

    if (!postcode) {
      return NextResponse.json(
        { success: false, error: "postcode query parameter is required" },
        { status: 400 }
      );
    }

    const weight = parseFloat(weightStr || "0");
    if (!weight || weight <= 0) {
      return NextResponse.json(
        { success: false, error: "weight query parameter must be a positive number (kg)" },
        { status: 400 }
      );
    }

    const destination: StarshipitAddress = {
      suburb,
      city: suburb,
      state,
      post_code: postcode,
      country_code: "AU",
    };

    const packages: StarshipitPackage[] = [{ weight }];

    console.log(`[Quick Quote] ${postcode} ${state || ""} — ${weight}kg`);

    const result = await getRates(destination, packages);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: "No shipping rates available",
          details: result.errors,
        },
        { status: 422 }
      );
    }

    const quotes = result.rates.map((rate) => ({
      carrier: rate.carrier_name,
      service: rate.service_name,
      service_code: rate.service_code,
      price_inc_gst: rate.total_price,
      price: Math.round((rate.total_price / 1.1) * 100) / 100,
      estimated_days: rate.estimated_delivery_days
        ? `${rate.estimated_delivery_days} business day${rate.estimated_delivery_days > 1 ? "s" : ""}`
        : null,
      currency: rate.currency,
    }));

    return NextResponse.json({
      success: true,
      quotes,
      destination: { post_code: postcode, state, suburb, country_code: "AU" },
      total_weight_kg: weight,
      quoted_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Quick Quote] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get shipping quotes" },
      { status: 500 }
    );
  }
}
