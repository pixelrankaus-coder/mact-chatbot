import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import crypto from "crypto";
import { getGoogleAdsCredentials } from "@/lib/ppc/credentials";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ADS_API_URL = "https://googleads.googleapis.com/v23";

// Decrypt tokens
function decrypt(encryptedText: string, key: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key.padEnd(32, "0").slice(0, 32)),
    iv
  );
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Encrypt tokens
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

// Refresh access token if expired
async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || "Failed to refresh token");
  }

  return response.json();
}

// GET: List accessible Google Ads customer accounts
export async function GET() {
  try {
    const supabase = await createClient();
    const encryptionKey = process.env.PPC_TOKEN_ENCRYPTION_KEY || "default-key-change-in-production";
    const credentials = await getGoogleAdsCredentials();

    if (!credentials?.client_id || !credentials?.client_secret) {
      return NextResponse.json(
        { error: "Google OAuth credentials not configured" },
        { status: 500 }
      );
    }

    const clientId = credentials.client_id;
    const clientSecret = credentials.client_secret;
    const developerToken = credentials.developer_token;

    if (!developerToken) {
      return NextResponse.json(
        { error: "Google Ads Developer Token not configured" },
        { status: 500 }
      );
    }

    // Get active connection
    const { data: connection, error: connError } = await supabase
      .from("ppc_connections")
      .select("*")
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: "No active PPC connection found" },
        { status: 400 }
      );
    }

    // Decrypt refresh token
    let refreshToken: string;
    let accessToken: string;
    try {
      refreshToken = decrypt(connection.refresh_token, encryptionKey);
      accessToken = decrypt(connection.access_token, encryptionKey);
    } catch (e) {
      console.error("Failed to decrypt tokens:", e);
      return NextResponse.json(
        { error: "Failed to decrypt authentication tokens" },
        { status: 500 }
      );
    }

    // Check if access token is expired
    const tokenExpiresAt = new Date(connection.token_expires_at);
    if (tokenExpiresAt < new Date()) {
      // Refresh the access token
      try {
        const tokenData = await refreshAccessToken(refreshToken, clientId, clientSecret);
        accessToken = tokenData.access_token;

        // Update stored tokens
        const newTokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
        await supabase
          .from("ppc_connections")
          .update({
            access_token: encrypt(accessToken, encryptionKey),
            token_expires_at: newTokenExpiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);
      } catch (e) {
        console.error("Failed to refresh access token:", e);
        return NextResponse.json(
          { error: "Failed to refresh access token. Please reconnect your Google Ads account." },
          { status: 401 }
        );
      }
    }

    // Query Google Ads API for accessible customers
    // Using the CustomerService to list accessible customers
    const response = await fetch(
      `${GOOGLE_ADS_API_URL}/customers:listAccessibleCustomers`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "developer-token": developerToken,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Google Ads API error:", error);
      return NextResponse.json(
        {
          error: "Failed to fetch Google Ads accounts",
          details: error.error?.message || "Unknown error"
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const customerResourceNames: string[] = data.resourceNames || [];

    // For each customer, get the account details
    const accounts = [];
    for (const resourceName of customerResourceNames) {
      // Extract customer ID from resource name (customers/1234567890)
      const customerId = resourceName.split("/")[1];

      try {
        // Query for customer details using GAQL
        const query = `
          SELECT
            customer.id,
            customer.descriptive_name,
            customer.currency_code,
            customer.time_zone,
            customer.manager
          FROM customer
          LIMIT 1
        `;

        const searchResponse = await fetch(
          `${GOOGLE_ADS_API_URL}/customers/${customerId}/googleAds:search`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "developer-token": developerToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query }),
          }
        );

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const customer = searchData.results?.[0]?.customer;

          if (customer) {
            accounts.push({
              id: customerId,
              name: customer.descriptiveName || `Account ${customerId}`,
              currencyCode: customer.currencyCode,
              timeZone: customer.timeZone,
              isManager: customer.manager || false,
            });
          }
        } else {
          // If we can't get details, still include the account with minimal info
          accounts.push({
            id: customerId,
            name: `Google Ads Account ${customerId}`,
            currencyCode: null,
            timeZone: null,
            isManager: false,
          });
        }
      } catch (e) {
        console.error(`Failed to get details for customer ${customerId}:`, e);
        // Include with minimal info
        accounts.push({
          id: customerId,
          name: `Google Ads Account ${customerId}`,
          currencyCode: null,
          timeZone: null,
          isManager: false,
        });
      }
    }

    return NextResponse.json({
      accounts,
      currentCustomerId: connection.customer_id,
    });
  } catch (error) {
    console.error("List accounts error:", error);
    return NextResponse.json(
      { error: "Failed to list Google Ads accounts" },
      { status: 500 }
    );
  }
}

// POST: Select a Google Ads account
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { customerId, accountName } = body;

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 }
      );
    }

    // Get active connection
    const { data: connection, error: connError } = await supabase
      .from("ppc_connections")
      .select("id")
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: "No active PPC connection found" },
        { status: 400 }
      );
    }

    // Update connection with selected account
    const { error: updateError } = await supabase
      .from("ppc_connections")
      .update({
        customer_id: customerId,
        account_name: accountName || `Google Ads ${customerId}`,
        sync_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    if (updateError) {
      console.error("Failed to update connection:", updateError);
      return NextResponse.json(
        { error: "Failed to update connection" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Account selected successfully",
    });
  } catch (error) {
    console.error("Select account error:", error);
    return NextResponse.json(
      { error: "Failed to select account" },
      { status: 500 }
    );
  }
}
