/**
 * Klaviyo API Client
 * TASK MACT #037
 *
 * Provides functions to interact with the Klaviyo API for:
 * - Tracking events (chat started, handoff requested, etc.)
 * - Creating/updating profiles
 * - Subscribing to lists
 */

import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

const KLAVIYO_API_URL = "https://a.klaviyo.com/api";
const KLAVIYO_TRACK_URL = "https://a.klaviyo.com/client";

interface KlaviyoSettings {
  api_key: string;
  list_id: string;
}

// Event types for chat interactions
export type ChatEventType =
  | "chat_started"
  | "chat_message_sent"
  | "handoff_requested"
  | "chat_rated"
  | "pre_chat_form_submitted";

export interface KlaviyoProfile {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  properties?: Record<string, unknown>;
}

export interface KlaviyoEventData {
  eventName: string;
  profile: KlaviyoProfile;
  properties?: Record<string, unknown>;
  time?: string;
}

/**
 * Get Klaviyo settings from database
 */
async function getKlaviyoSettings(): Promise<KlaviyoSettings | null> {
  const supabase = createServiceClient() as SupabaseAny;

  const { data, error } = await supabase
    .from("integration_settings")
    .select("settings, is_enabled")
    .eq("integration_type", "klaviyo")
    .single();

  if (error || !data || !data.is_enabled) {
    return null;
  }

  return data.settings as KlaviyoSettings;
}

/**
 * Get the Klaviyo public API key from the private key
 * Klaviyo public keys start with "pk_" and private keys don't
 */
function getPublicKey(privateKey: string): string | null {
  // If the key looks like a public key already, return it
  if (privateKey.startsWith("pk_")) {
    return privateKey;
  }
  // Private keys can be used for server-side tracking
  // We'll use the private key directly for server-side events
  return null;
}

/**
 * Track an event in Klaviyo (server-side)
 */
export async function trackEvent(data: KlaviyoEventData): Promise<boolean> {
  const settings = await getKlaviyoSettings();
  if (!settings?.api_key) {
    console.log("Klaviyo not configured or disabled, skipping event tracking");
    return false;
  }

  try {
    // Create the event using the Events API (server-side)
    const response = await fetch(`${KLAVIYO_API_URL}/events/`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Klaviyo-API-Key ${settings.api_key}`,
        "revision": "2024-10-15",
      },
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            metric: {
              data: {
                type: "metric",
                attributes: {
                  name: data.eventName,
                },
              },
            },
            profile: {
              data: {
                type: "profile",
                attributes: {
                  email: data.profile.email,
                  first_name: data.profile.firstName,
                  last_name: data.profile.lastName,
                  phone_number: data.profile.phone,
                  properties: data.profile.properties,
                },
              },
            },
            properties: data.properties || {},
            time: data.time || new Date().toISOString(),
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Klaviyo trackEvent error:", response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Klaviyo trackEvent error:", error);
    return false;
  }
}

/**
 * Create or update a profile in Klaviyo
 */
export async function upsertProfile(profile: KlaviyoProfile): Promise<string | null> {
  const settings = await getKlaviyoSettings();
  if (!settings?.api_key) {
    console.log("Klaviyo not configured or disabled, skipping profile upsert");
    return null;
  }

  try {
    const response = await fetch(`${KLAVIYO_API_URL}/profiles/`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Klaviyo-API-Key ${settings.api_key}`,
        "revision": "2024-10-15",
      },
      body: JSON.stringify({
        data: {
          type: "profile",
          attributes: {
            email: profile.email,
            first_name: profile.firstName,
            last_name: profile.lastName,
            phone_number: profile.phone,
            properties: profile.properties,
          },
        },
      }),
    });

    if (response.status === 201) {
      const data = await response.json();
      return data.data?.id || null;
    }

    // Handle duplicate - profile already exists
    if (response.status === 409) {
      // Profile exists, try to update it
      // First, find the profile by email
      const searchResponse = await fetch(
        `${KLAVIYO_API_URL}/profiles/?filter=equals(email,"${encodeURIComponent(profile.email)}")`,
        {
          headers: {
            "Accept": "application/json",
            "Authorization": `Klaviyo-API-Key ${settings.api_key}`,
            "revision": "2024-10-15",
          },
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const existingProfile = searchData.data?.[0];
        if (existingProfile?.id) {
          // Update the existing profile
          await updateProfile(existingProfile.id, profile, settings.api_key);
          return existingProfile.id;
        }
      }
    }

    const errorText = await response.text();
    console.error("Klaviyo upsertProfile error:", response.status, errorText);
    return null;
  } catch (error) {
    console.error("Klaviyo upsertProfile error:", error);
    return null;
  }
}

/**
 * Update an existing profile
 */
async function updateProfile(
  profileId: string,
  profile: KlaviyoProfile,
  apiKey: string
): Promise<boolean> {
  try {
    const response = await fetch(`${KLAVIYO_API_URL}/profiles/${profileId}/`, {
      method: "PATCH",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Klaviyo-API-Key ${apiKey}`,
        "revision": "2024-10-15",
      },
      body: JSON.stringify({
        data: {
          type: "profile",
          id: profileId,
          attributes: {
            first_name: profile.firstName,
            last_name: profile.lastName,
            phone_number: profile.phone,
            properties: profile.properties,
          },
        },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Klaviyo updateProfile error:", error);
    return false;
  }
}

/**
 * Subscribe a profile to a list
 */
export async function subscribeToList(
  email: string,
  customListId?: string
): Promise<boolean> {
  const settings = await getKlaviyoSettings();
  if (!settings?.api_key) {
    console.log("Klaviyo not configured or disabled, skipping list subscription");
    return false;
  }

  const listId = customListId || settings.list_id;
  if (!listId) {
    console.log("No Klaviyo list ID configured");
    return false;
  }

  try {
    const response = await fetch(`${KLAVIYO_API_URL}/lists/${listId}/relationships/profiles/`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Klaviyo-API-Key ${settings.api_key}`,
        "revision": "2024-10-15",
      },
      body: JSON.stringify({
        data: [
          {
            type: "profile",
            attributes: {
              email: email,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Klaviyo subscribeToList error:", response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Klaviyo subscribeToList error:", error);
    return false;
  }
}

/**
 * Track a chat interaction event
 * This is a convenience function for tracking common chat events
 */
export async function trackChatEvent(
  eventType: ChatEventType,
  profile: KlaviyoProfile,
  conversationId: string,
  additionalProperties?: Record<string, unknown>
): Promise<boolean> {
  const eventNames: Record<ChatEventType, string> = {
    chat_started: "Chat Started",
    chat_message_sent: "Chat Message Sent",
    handoff_requested: "Chat Handoff Requested",
    chat_rated: "Chat Rated",
    pre_chat_form_submitted: "Pre-Chat Form Submitted",
  };

  return trackEvent({
    eventName: eventNames[eventType],
    profile,
    properties: {
      conversation_id: conversationId,
      source: "mact_chatbot",
      ...additionalProperties,
    },
  });
}

/**
 * Check if Klaviyo integration is enabled
 */
export async function isKlaviyoEnabled(): Promise<boolean> {
  const settings = await getKlaviyoSettings();
  return !!(settings?.api_key);
}

/**
 * Get Klaviyo public key for client-side tracking (if available)
 */
export async function getKlaviyoPublicKey(): Promise<string | null> {
  const settings = await getKlaviyoSettings();
  if (!settings?.api_key) return null;
  return getPublicKey(settings.api_key);
}
