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
// Use latest stable revision - updated from 2024-10-15 (deprecated)
const KLAVIYO_REVISION = "2026-01-15";

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
        "revision": KLAVIYO_REVISION,
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
        "revision": KLAVIYO_REVISION,
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
            "revision": KLAVIYO_REVISION,
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
        "revision": KLAVIYO_REVISION,
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
        "revision": KLAVIYO_REVISION,
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

// ============================================================================
// BULK PROFILE SYNC FOR DORMANT CUSTOMER WIN-BACK CAMPAIGN (TASK #040)
// ============================================================================

export interface DormantCustomerProfile {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  // Customer metadata
  cin7Id?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  daysSinceLastOrder: number;
  // Order history for win-back personalization
  orderHistory: DormantCustomerOrder[];
  // TASK #041: Last product purchased for win-back personalization
  lastProduct?: string;
}

export interface DormantCustomerOrder {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  total: number;
  currency: string;
  status?: string;
}

export interface BulkSyncProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  currentCustomer?: string;
}

/**
 * Sync a single dormant customer profile to Klaviyo with full order history
 * Creates/updates the profile and tracks historical order events
 */
export async function syncDormantCustomerToKlaviyo(
  customer: DormantCustomerProfile,
  settings: KlaviyoSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[Klaviyo] Syncing customer: ${customer.email}`);

    // Check if phone is in valid E.164 format (+[country code][number])
    const isValidE164Phone = customer.phone && /^\+[1-9]\d{6,14}$/.test(customer.phone);

    // Build profile attributes - only include phone if valid E.164 format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profileAttributes: Record<string, any> = {
      email: customer.email,
      first_name: customer.firstName,
      last_name: customer.lastName,
      organization: customer.company,
      properties: {
        // Customer segment identifiers
        customer_segment: "dormant",
        cin7_customer_id: customer.cin7Id,
        // Order metrics for personalization
        total_orders: customer.totalOrders,
        total_spent: customer.totalSpent,
        last_order_date: customer.lastOrderDate,
        days_since_last_order: customer.daysSinceLastOrder,
        // TASK #041: Last product for win-back personalization
        last_product: customer.lastProduct || null,
        // Source tracking
        sync_source: "mact_admin",
        synced_at: new Date().toISOString(),
      },
    };

    // Only include phone_number if valid E.164 format
    if (isValidE164Phone) {
      profileAttributes.phone_number = customer.phone;
    }

    // 1. Create or update the profile with custom properties for segmentation
    const profileResponse = await fetch(`${KLAVIYO_API_URL}/profiles/`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Klaviyo-API-Key ${settings.api_key}`,
        "revision": KLAVIYO_REVISION,
      },
      body: JSON.stringify({
        data: {
          type: "profile",
          attributes: profileAttributes,
        },
      }),
    });

    let profileId: string | null = null;

    console.log(`[Klaviyo] Profile response status: ${profileResponse.status}`);

    if (profileResponse.status === 201) {
      const data = await profileResponse.json();
      profileId = data.data?.id;
      console.log(`[Klaviyo] Created new profile: ${profileId}`);
    } else if (profileResponse.status === 409) {
      console.log(`[Klaviyo] Profile exists, updating...`);
      // Profile exists, find and update it
      const searchResponse = await fetch(
        `${KLAVIYO_API_URL}/profiles/?filter=equals(email,"${encodeURIComponent(customer.email)}")`,
        {
          headers: {
            "Accept": "application/json",
            "Authorization": `Klaviyo-API-Key ${settings.api_key}`,
            "revision": KLAVIYO_REVISION,
          },
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        profileId = searchData.data?.[0]?.id;

        if (profileId) {
          // Update the existing profile with PATCH
          console.log(`[Klaviyo] Sending PATCH to update profile ${profileId} for ${customer.email}`);

          // Build attributes - only include phone if it's in valid E.164 format
          // E.164 format: +[country code][number], e.g., +12345678901
          const isValidE164Phone = customer.phone && /^\+[1-9]\d{6,14}$/.test(customer.phone);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const patchAttributes: Record<string, any> = {
            first_name: customer.firstName,
            last_name: customer.lastName,
            organization: customer.company,
            properties: {
              customer_segment: "dormant",
              cin7_customer_id: customer.cin7Id,
              total_orders: customer.totalOrders,
              total_spent: customer.totalSpent,
              last_order_date: customer.lastOrderDate,
              days_since_last_order: customer.daysSinceLastOrder,
              last_product: customer.lastProduct || null,
              sync_source: "mact_admin",
              synced_at: new Date().toISOString(),
            },
          };

          // Only include phone_number if valid
          if (isValidE164Phone) {
            patchAttributes.phone_number = customer.phone;
          }

          const patchBody = {
            data: {
              type: "profile",
              id: profileId,
              attributes: patchAttributes,
            },
          };
          console.log(`[Klaviyo] PATCH body properties:`, JSON.stringify(patchBody.data.attributes.properties, null, 2));

          const patchResponse = await fetch(`${KLAVIYO_API_URL}/profiles/${profileId}/`, {
            method: "PATCH",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json",
              "Authorization": `Klaviyo-API-Key ${settings.api_key}`,
              "revision": KLAVIYO_REVISION,
            },
            body: JSON.stringify(patchBody),
          });

          console.log(`[Klaviyo] PATCH response status: ${patchResponse.status}`);

          if (!patchResponse.ok) {
            const errorText = await patchResponse.text();
            console.error(`[Klaviyo] PATCH failed for ${customer.email}: ${patchResponse.status} - ${errorText}`);
          } else {
            const patchData = await patchResponse.json();
            console.log(`[Klaviyo] PATCH success - updated profile ${profileId}`);
            // Log the returned properties to verify they were saved
            const returnedProps = patchData.data?.attributes?.properties;
            if (returnedProps) {
              console.log(`[Klaviyo] Returned properties:`, JSON.stringify(returnedProps, null, 2));
            }
          }
        }
      }
    } else {
      const errorText = await profileResponse.text();
      console.error(`[Klaviyo] Profile creation failed (${profileResponse.status}):`, errorText);
      return { success: false, error: `Profile creation failed (${profileResponse.status}): ${errorText}` };
    }

    // 2. Track historical order events (for win-back email personalization)
    // Track the most recent 5 orders to avoid API rate limits
    const recentOrders = customer.orderHistory.slice(0, 5);

    for (const order of recentOrders) {
      await trackHistoricalOrderEvent(customer, order, settings);
      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 3. Subscribe to the configured list for campaign targeting
    if (settings.list_id && profileId) {
      console.log(`[Klaviyo] Adding profile ${profileId} to list ${settings.list_id}`);
      const listResponse = await fetch(`${KLAVIYO_API_URL}/lists/${settings.list_id}/relationships/profiles/`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Klaviyo-API-Key ${settings.api_key}`,
          "revision": KLAVIYO_REVISION,
        },
        body: JSON.stringify({
          data: [
            {
              type: "profile",
              id: profileId,
            },
          ],
        }),
      });
      console.log(`[Klaviyo] List subscription response: ${listResponse.status}`);
    }

    console.log(`[Klaviyo] Successfully synced: ${customer.email}`);
    return { success: true };
  } catch (error) {
    console.error(`[Klaviyo] Error syncing ${customer.email}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Track a historical order event for a customer
 * Uses the "Placed Order" metric for win-back flow triggers
 */
async function trackHistoricalOrderEvent(
  customer: DormantCustomerProfile,
  order: DormantCustomerOrder,
  settings: KlaviyoSettings
): Promise<void> {
  try {
    await fetch(`${KLAVIYO_API_URL}/events/`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Klaviyo-API-Key ${settings.api_key}`,
        "revision": KLAVIYO_REVISION,
      },
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            metric: {
              data: {
                type: "metric",
                attributes: {
                  name: "Placed Order",
                },
              },
            },
            profile: {
              data: {
                type: "profile",
                attributes: {
                  email: customer.email,
                },
              },
            },
            properties: {
              order_id: order.orderId,
              order_number: order.orderNumber,
              value: order.total,
              currency: order.currency || "AUD",
              status: order.status,
              source: "cin7",
              historical_sync: true,
            },
            time: order.orderDate,
            unique_id: `cin7-order-${order.orderId}`,
          },
        },
      }),
    });
  } catch (error) {
    console.error("Failed to track historical order event:", error);
  }
}

/**
 * Get Klaviyo settings (exported version for sync endpoint)
 */
export async function getKlaviyoSettingsPublic(): Promise<KlaviyoSettings | null> {
  return getKlaviyoSettings();
}
