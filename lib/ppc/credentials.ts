import { createServiceClient } from "@/lib/supabase";

interface GoogleAdsCredentials {
  client_id: string;
  client_secret: string;
  developer_token: string;
}

/**
 * Fetch Google Ads OAuth credentials.
 * Checks DB (integration_settings) first, falls back to env vars.
 */
export async function getGoogleAdsCredentials(): Promise<GoogleAdsCredentials | null> {
  // Try DB first
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any;
    const { data } = await supabase
      .from("integration_settings")
      .select("settings")
      .eq("integration_type", "google_ads")
      .single();

    if (data?.settings) {
      const s = data.settings as GoogleAdsCredentials;
      if (s.client_id && s.client_secret && s.developer_token) {
        return s;
      }
    }
  } catch {
    // DB lookup failed, fall through to env vars
  }

  // Fall back to env vars
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  const developer_token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  if (client_id && client_secret) {
    return {
      client_id,
      client_secret,
      developer_token: developer_token || "",
    };
  }

  return null;
}
