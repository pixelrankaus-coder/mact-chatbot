import { NextRequest, NextResponse } from "next/server";

// CORS headers for widget
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// GET /api/widget/visitor-info - Get visitor IP and geolocation
export async function GET(request: NextRequest) {
  try {
    // Get IP from headers
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0].trim()
      : request.headers.get("x-real-ip") || "unknown";

    // Skip geolocation for localhost/private IPs
    if (
      ip === "unknown" ||
      ip === "127.0.0.1" ||
      ip.startsWith("192.168.") ||
      ip.startsWith("10.") ||
      ip.startsWith("172.16.") ||
      ip === "::1"
    ) {
      return NextResponse.json(
        {
          ip,
          location: null,
        },
        { headers: corsHeaders }
      );
    }

    // Use free IP geolocation API (ip-api.com)
    const geoResponse = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,timezone`,
      {
        headers: { "User-Agent": "MACt-Chatbot/1.0" },
      }
    );

    if (!geoResponse.ok) {
      return NextResponse.json(
        { ip, location: null },
        { headers: corsHeaders }
      );
    }

    const geoData = await geoResponse.json();

    if (geoData.status !== "success") {
      return NextResponse.json(
        { ip, location: null },
        { headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        ip,
        location: {
          city: geoData.city,
          region: geoData.regionName,
          country: geoData.country,
          countryCode: geoData.countryCode,
          timezone: geoData.timezone,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Visitor info error:", error);
    return NextResponse.json(
      { ip: "unknown", location: null },
      { headers: corsHeaders }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
