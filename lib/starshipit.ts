/**
 * Starshipit API Client
 * Provides real-time shipping quotes using MACt's contracted carrier rates.
 *
 * API Docs: https://api-docs.starshipit.com/
 * Rate Limit: 20 req/s, no daily limit
 */

// ── Types ──────────────────────────────────────────────────────────

export interface StarshipitAddress {
  street?: string;
  suburb?: string;
  city?: string;
  state?: string;
  post_code: string;
  country_code: string; // "AU", "NZ", etc.
}

export interface StarshipitPackage {
  weight: number; // kg
  height?: number; // cm
  width?: number; // cm
  length?: number; // cm
}

export interface ShippingRate {
  service_name: string;
  service_code: string;
  carrier_name: string;
  total_price: number;
  currency: string;
  estimated_delivery_days?: number;
}

export interface RatesResponse {
  success: boolean;
  rates: ShippingRate[];
  errors?: string[];
}

export interface AddressValidationResponse {
  success: boolean;
  is_valid: boolean;
  matched_address?: StarshipitAddress;
  suggestions?: StarshipitAddress[];
}

// ── In-memory cache (1 hour TTL) ──────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expires_at: number;
}

const ratesCache = new Map<string, CacheEntry<ShippingRate[]>>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCacheKey(destination: StarshipitAddress, packages: StarshipitPackage[]): string {
  const totalWeight = packages.reduce((sum, p) => sum + p.weight, 0);
  return `${destination.post_code}:${destination.state || ""}:${destination.country_code}:${totalWeight}`;
}

function getCachedRates(key: string): ShippingRate[] | null {
  const entry = ratesCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires_at) {
    ratesCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedRates(key: string, rates: ShippingRate[]): void {
  // Cap cache size to prevent memory issues
  if (ratesCache.size > 500) {
    const firstKey = ratesCache.keys().next().value;
    if (firstKey) ratesCache.delete(firstKey);
  }
  ratesCache.set(key, { data: rates, expires_at: Date.now() + CACHE_TTL_MS });
}

// ── Core API call ─────────────────────────────────────────────────

const BASE_URL = "https://api.starshipit.com/api";
const TIMEOUT_MS = 15_000;

function getHeaders(): Record<string, string> {
  const apiKey = process.env.STARSHIPIT_API_KEY;
  const subKey = process.env.STARSHIPIT_SUBSCRIPTION_KEY;
  if (!apiKey || !subKey) {
    throw new Error("Starshipit API keys not configured");
  }
  return {
    "Content-Type": "application/json",
    "StarShipIT-Api-Key": apiKey,
    "Ocp-Apim-Subscription-Key": subKey,
  };
}

async function starshipitFetch<T>(
  endpoint: string,
  method: "GET" | "POST",
  body?: unknown
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const start = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method,
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const elapsed = Date.now() - start;
    const data = await res.json();

    console.log(`[Starshipit] ${method} ${endpoint} → ${res.status} (${elapsed}ms)`);

    if (!res.ok) {
      const errorMsg = data?.errors?.join(", ") || data?.message || `HTTP ${res.status}`;
      console.error(`[Starshipit] Error:`, errorMsg);
      throw new Error(`Starshipit API error: ${errorMsg}`);
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`[Starshipit] ${method} ${endpoint} timed out after ${TIMEOUT_MS}ms`);
      throw new Error("Starshipit API request timed out — carrier may be slow");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Get shipping rates for a destination and packages.
 * Results are cached for 1 hour per destination+weight combo.
 */
export async function getRates(
  destination: StarshipitAddress,
  packages: StarshipitPackage[]
): Promise<RatesResponse> {
  if (!destination.post_code) {
    return { success: false, rates: [], errors: ["Postcode is required"] };
  }
  if (packages.length === 0 || packages.every((p) => p.weight <= 0)) {
    return { success: false, rates: [], errors: ["At least one package with weight > 0 is required"] };
  }

  const cacheKey = getCacheKey(destination, packages);
  const cached = getCachedRates(cacheKey);
  if (cached) {
    console.log(`[Starshipit] Cache hit for ${cacheKey} (${cached.length} rates)`);
    return { success: true, rates: cached };
  }

  try {
    const body = { destination, packages };
    const data = await starshipitFetch<{
      success: boolean;
      rates?: Array<{
        service_name: string;
        service_code: string;
        carrier_name: string;
        total_price: number;
        currency_code?: string;
        currency?: string;
        delivery_estimate_business_days?: number;
      }>;
      errors?: string[];
    }>("/rates", "POST", body);

    if (!data.success || !data.rates) {
      return {
        success: false,
        rates: [],
        errors: data.errors || ["No rates returned"],
      };
    }

    const rates: ShippingRate[] = data.rates.map((r) => ({
      service_name: r.service_name,
      service_code: r.service_code,
      carrier_name: r.carrier_name,
      total_price: r.total_price,
      currency: r.currency_code || r.currency || "AUD",
      estimated_delivery_days: r.delivery_estimate_business_days,
    }));

    // Sort cheapest first
    rates.sort((a, b) => a.total_price - b.total_price);

    setCachedRates(cacheKey, rates);

    return { success: true, rates };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, rates: [], errors: [msg] };
  }
}

/**
 * Get available delivery services (optionally with pricing).
 */
export async function getServices(
  destination: StarshipitAddress,
  packages: StarshipitPackage[],
  includePricing = true
): Promise<{ success: boolean; services: unknown[]; errors?: string[] }> {
  try {
    const body = { destination, packages, include_pricing: includePricing };
    const data = await starshipitFetch<{
      success: boolean;
      services?: unknown[];
      errors?: string[];
    }>("/deliveryservices", "POST", body);

    return {
      success: data.success,
      services: data.services || [],
      errors: data.errors,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, services: [], errors: [msg] };
  }
}

/**
 * Validate an Australian address.
 */
export async function validateAddress(
  address: StarshipitAddress
): Promise<AddressValidationResponse> {
  try {
    const data = await starshipitFetch<{
      success: boolean;
      is_valid?: boolean;
      matched_address?: StarshipitAddress;
      suggestions?: StarshipitAddress[];
      errors?: string[];
    }>("/address/validate", "POST", address);

    return {
      success: data.success,
      is_valid: data.is_valid ?? false,
      matched_address: data.matched_address,
      suggestions: data.suggestions,
    };
  } catch (error) {
    console.error("[Starshipit] Address validation failed:", error);
    return { success: false, is_valid: false };
  }
}

/**
 * Get tracking info for an order. (Stub for future use)
 */
export async function getTracking(
  orderId: string
): Promise<{ success: boolean; data?: unknown; errors?: string[] }> {
  try {
    const data = await starshipitFetch<{ success: boolean }>(`/orders/${orderId}`, "GET");
    return { success: true, data };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, errors: [msg] };
  }
}
