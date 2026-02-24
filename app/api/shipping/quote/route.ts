import { NextRequest, NextResponse } from "next/server";
import {
  getRates,
  type StarshipitAddress,
  type StarshipitPackage,
} from "@/lib/starshipit";

interface QuoteItem {
  product_code?: string;
  weight?: number; // kg per unit
  quantity: number;
}

interface QuoteRequestBody {
  destination: {
    street?: string;
    suburb?: string;
    state?: string;
    post_code: string;
    country_code?: string;
  };
  items?: QuoteItem[];
  total_weight?: number; // kg — alternative to items
}

/**
 * POST /api/shipping/quote
 *
 * Get real-time shipping quotes from Starshipit.
 *
 * Accepts either:
 *   - `items` array with per-item weight + quantity
 *   - `total_weight` in kg
 *
 * Returns carrier rates sorted cheapest-first.
 */
export async function POST(request: NextRequest) {
  try {
    const body: QuoteRequestBody = await request.json();

    // Validate destination
    if (!body.destination?.post_code) {
      return NextResponse.json(
        { success: false, error: "destination.post_code is required" },
        { status: 400 }
      );
    }

    // Calculate total weight
    let totalWeight = 0;

    if (body.total_weight && body.total_weight > 0) {
      totalWeight = body.total_weight;
    } else if (body.items && body.items.length > 0) {
      for (const item of body.items) {
        const itemWeight = item.weight;
        if (!itemWeight || itemWeight <= 0) {
          return NextResponse.json(
            {
              success: false,
              error: `Weight is required for each item. Missing weight for ${item.product_code || "an item"}.`,
            },
            { status: 400 }
          );
        }
        totalWeight += itemWeight * (item.quantity || 1);
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Provide either 'items' with weights or 'total_weight'" },
        { status: 400 }
      );
    }

    if (totalWeight <= 0) {
      return NextResponse.json(
        { success: false, error: "Total weight must be greater than 0" },
        { status: 400 }
      );
    }

    // Build Starshipit request
    const destination: StarshipitAddress = {
      street: body.destination.street,
      suburb: body.destination.suburb,
      city: body.destination.suburb, // Starshipit uses city = suburb for AU
      state: body.destination.state,
      post_code: body.destination.post_code,
      country_code: body.destination.country_code || "AU",
    };

    const packages: StarshipitPackage[] = [{ weight: totalWeight }];

    console.log(
      `[Shipping Quote] ${destination.post_code} ${destination.state || ""} — ${totalWeight}kg`
    );

    const result = await getRates(destination, packages);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: "No shipping rates available for this destination",
          details: result.errors,
        },
        { status: 422 }
      );
    }

    // Format response
    const quotes = result.rates.map((rate) => ({
      carrier: rate.carrier_name,
      service: rate.service_name,
      service_code: rate.service_code,
      price_inc_gst: rate.total_price,
      price: Math.round((rate.total_price / 1.1) * 100) / 100, // ex-GST estimate
      estimated_days: rate.estimated_delivery_days
        ? `${rate.estimated_delivery_days} business day${rate.estimated_delivery_days > 1 ? "s" : ""}`
        : null,
      currency: rate.currency,
    }));

    return NextResponse.json({
      success: true,
      quotes,
      destination: {
        post_code: destination.post_code,
        suburb: destination.suburb,
        state: destination.state,
        country_code: destination.country_code,
      },
      total_weight_kg: totalWeight,
      quoted_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Shipping Quote] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get shipping quotes" },
      { status: 500 }
    );
  }
}
