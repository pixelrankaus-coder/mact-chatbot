import { NextResponse } from "next/server";
import crypto from "crypto";
import { getGoogleAdsCredentials } from "@/lib/ppc/credentials";

// Google OAuth configuration
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = ["https://www.googleapis.com/auth/adwords"];

// GET: Generate OAuth authorization URL
export async function GET() {
  try {
    const credentials = await getGoogleAdsCredentials();
    const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/ppc/oauth/callback`;

    if (!credentials?.client_id) {
      return NextResponse.json(
        {
          error: "Google OAuth not configured",
          configured: false,
        },
        { status: 200 }
      );
    }

    // Generate a secure state token for CSRF protection
    const state = crypto.randomBytes(32).toString("hex");

    // Build the authorization URL
    const authUrl = new URL(GOOGLE_AUTH_URL);
    authUrl.searchParams.set("client_id", credentials.client_id);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("access_type", "offline"); // Required for refresh token
    authUrl.searchParams.set("prompt", "consent"); // Force consent to get refresh token
    authUrl.searchParams.set("state", state);

    // Return the authorization URL
    // The frontend will redirect the user to this URL
    return NextResponse.json({
      authUrl: authUrl.toString(),
      state,
    });
  } catch (error) {
    console.error("OAuth authorize error:", error);
    return NextResponse.json(
      { error: "Failed to generate authorization URL" },
      { status: 500 }
    );
  }
}
