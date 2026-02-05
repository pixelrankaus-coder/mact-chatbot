import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import crypto from "crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Simple encryption for tokens (in production, use a proper secrets manager)
function encrypt(text: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(key.padEnd(32, "0").slice(0, 32)),
    iv
  );
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

// GET: Handle OAuth callback from Google
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Base URL for redirects
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Handle OAuth errors
  if (error) {
    console.error("OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/settings/integrations?ppc_error=${encodeURIComponent(error)}`
    );
  }

  // Validate authorization code
  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/settings/integrations?ppc_error=${encodeURIComponent("No authorization code received")}`
    );
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI || `${baseUrl}/api/ppc/oauth/callback`;
    const encryptionKey = process.env.PPC_TOKEN_ENCRYPTION_KEY || "default-key-change-in-production";

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${baseUrl}/settings/integrations?ppc_error=${encodeURIComponent("OAuth credentials not configured")}`
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Token exchange error:", tokenData);
      return NextResponse.redirect(
        `${baseUrl}/settings/integrations?ppc_error=${encodeURIComponent(tokenData.error_description || "Token exchange failed")}`
      );
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    if (!refresh_token) {
      return NextResponse.redirect(
        `${baseUrl}/settings/integrations?ppc_error=${encodeURIComponent("No refresh token received. Please revoke access and try again.")}`
      );
    }

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Encrypt tokens before storing
    const encryptedRefreshToken = encrypt(refresh_token, encryptionKey);
    const encryptedAccessToken = encrypt(access_token, encryptionKey);

    // Now we need to discover which Google Ads accounts this user has access to
    // For now, we'll store a placeholder and let them select the account later
    // In production, you'd use the Google Ads API to list accessible customers

    const supabase = await createClient();

    // Check if there's already an active connection
    const { data: existingConnection } = await supabase
      .from("ppc_connections")
      .select("id")
      .eq("is_active", true)
      .single();

    if (existingConnection) {
      // Update existing connection
      await supabase
        .from("ppc_connections")
        .update({
          refresh_token: encryptedRefreshToken,
          access_token: encryptedAccessToken,
          token_expires_at: tokenExpiresAt.toISOString(),
          sync_status: "pending",
          sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingConnection.id);
    } else {
      // Create new connection
      // The customer_id will be set after account discovery
      await supabase.from("ppc_connections").insert({
        customer_id: "pending", // Will be updated after account selection
        account_name: "Google Ads (pending setup)",
        refresh_token: encryptedRefreshToken,
        access_token: encryptedAccessToken,
        token_expires_at: tokenExpiresAt.toISOString(),
        developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || null,
        is_active: true,
        sync_status: "pending",
      });
    }

    // Redirect back to integrations page with success
    return NextResponse.redirect(
      `${baseUrl}/settings/integrations?ppc_success=true`
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      `${baseUrl}/settings/integrations?ppc_error=${encodeURIComponent("Failed to complete authorization")}`
    );
  }
}
