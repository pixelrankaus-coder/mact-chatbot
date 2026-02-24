import { NextRequest, NextResponse } from "next/server";
import { validateAddress, type StarshipitAddress } from "@/lib/starshipit";

/**
 * POST /api/shipping/validate-address
 *
 * Validate an Australian delivery address via Starshipit.
 * Returns whether the address is valid plus any suggestions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.post_code) {
      return NextResponse.json(
        { success: false, error: "post_code is required" },
        { status: 400 }
      );
    }

    const address: StarshipitAddress = {
      street: body.street,
      suburb: body.suburb,
      city: body.city || body.suburb,
      state: body.state,
      post_code: body.post_code,
      country_code: body.country_code || "AU",
    };

    const result = await validateAddress(address);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Address Validation] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to validate address" },
      { status: 500 }
    );
  }
}
