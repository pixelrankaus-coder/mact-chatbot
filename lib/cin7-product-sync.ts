/**
 * Cin7 Product & Inventory Sync
 * Syncs products, stock levels, and locations from Cin7 to Supabase
 */

import { createServiceClient } from "@/lib/supabase";

const CIN7_BASE_URL = "https://inventory.dearsystems.com/ExternalApi/v2";

function getHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "api-auth-accountid": process.env.CIN7_ACCOUNT_ID!,
    "api-auth-applicationkey": process.env.CIN7_API_KEY!,
  };
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface Cin7ProductRaw {
  ID: string;
  SKU: string;
  Name: string;
  Category: string;
  Brand: string | null;
  Type: string;
  CostingMethod: string;
  DefaultLocation: string;
  Length: number;
  Width: number;
  Height: number;
  Weight: number;
  UOM: string;
  WeightUnits: string;
  DimensionsUnits: string;
  Barcode: string | null;
  MinimumBeforeReorder: number;
  ReorderQuantity: number;
  PriceTier1: number;
  PriceTier2: number;
  PriceTier3: number;
  PriceTiers: Record<string, number>;
  AverageCost: number;
  ShortDescription: string | null;
  Description: string | null;
  Tags: string | null;
  Status: string;
  Sellable: boolean;
  LastModifiedOn: string;
  CartonHeight: number | null;
  CartonWidth: number | null;
  CartonLength: number | null;
  CartonQuantity: number | null;
  HSCode: string | null;
  CountryOfOrigin: string | null;
}

interface Cin7AvailabilityRaw {
  ID: string;
  SKU: string;
  Name: string;
  Location: string;
  Bin: string | null;
  OnHand: number;
  Allocated: number;
  Available: number;
  OnOrder: number;
  StockOnHand: number;
  InTransit: number;
}

interface Cin7LocationRaw {
  ID: string;
  Name: string;
  IsDefault: boolean;
  IsDeprecated: boolean;
  AddressLine1: string;
  AddressLine2: string;
  AddressCitySuburb: string;
  AddressStateProvince: string;
  AddressZipPostCode: string;
  AddressCountry: string;
}

interface SyncResult {
  synced: number;
  errors: number;
  total: number;
}

// ─── Fetch Helpers ──────────────────────────────────────────────────────────

async function fetchAllPages<T>(
  urlPath: string,
  listKey: string,
  pageSize = 250
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let total = Infinity;

  while (all.length < total) {
    const url = `${CIN7_BASE_URL}${urlPath}${urlPath.includes("?") ? "&" : "?"}Page=${page}&Limit=${pageSize}`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) {
      console.error(`Cin7 fetch error: ${res.status} for ${urlPath}`);
      break;
    }

    const data = await res.json();
    if (data.Errors?.length > 0) {
      console.error(`Cin7 API error: ${data.Errors.join(", ")}`);
      break;
    }

    const records = data[listKey] || [];
    total = data.Total ?? records.length;
    all.push(...records);
    page++;

    // Rate limit between pages
    if (all.length < total) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return all;
}

// ─── Location Sync ──────────────────────────────────────────────────────────

export async function syncLocations(): Promise<SyncResult> {
  const supabase = createServiceClient();
  const result: SyncResult = { synced: 0, errors: 0, total: 0 };

  try {
    const url = `${CIN7_BASE_URL}/ref/location`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Location fetch failed: ${res.status}`);

    const data = await res.json();
    const locations: Cin7LocationRaw[] = data.LocationList || [];
    result.total = locations.length;

    for (const loc of locations) {
      const { error } = await supabase
        .from("cin7_locations" as string)
        .upsert(
          {
            cin7_id: loc.ID,
            name: loc.Name,
            is_default: loc.IsDefault,
            is_deprecated: loc.IsDeprecated,
            address_line1: loc.AddressLine1,
            address_line2: loc.AddressLine2,
            city: loc.AddressCitySuburb,
            state: loc.AddressStateProvince,
            postcode: loc.AddressZipPostCode,
            country: loc.AddressCountry,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "cin7_id" }
        );

      if (error) {
        console.error(`Location sync error for ${loc.Name}:`, error);
        result.errors++;
      } else {
        result.synced++;
      }
    }
  } catch (err) {
    console.error("syncLocations error:", err);
    result.errors++;
  }

  return result;
}

// ─── Product Sync ───────────────────────────────────────────────────────────

export async function syncProducts(): Promise<SyncResult> {
  const supabase = createServiceClient();
  const result: SyncResult = { synced: 0, errors: 0, total: 0 };

  try {
    const products = await fetchAllPages<Cin7ProductRaw>(
      "/product",
      "Products",
      250
    );
    result.total = products.length;

    // Batch upsert in groups of 50
    for (let i = 0; i < products.length; i += 50) {
      const batch = products.slice(i, i + 50);
      const rows = batch.map((p) => ({
        cin7_id: p.ID,
        sku: p.SKU,
        name: p.Name,
        category: p.Category || null,
        brand: p.Brand || null,
        description: p.Description || null,
        short_description: p.ShortDescription || null,
        type: p.Type,
        costing_method: p.CostingMethod,
        default_location: p.DefaultLocation,
        weight: p.Weight,
        weight_units: p.WeightUnits || null,
        length: p.Length,
        width: p.Width,
        height: p.Height,
        dimensions_units: p.DimensionsUnits || null,
        uom: p.UOM || "Each",
        barcode: p.Barcode || null,
        sellable: p.Sellable,
        cin7_status: p.Status,
        average_cost: p.AverageCost,
        price_tier_1: p.PriceTier1,
        price_tier_2: p.PriceTier2,
        price_tier_3: p.PriceTier3,
        price_tiers: p.PriceTiers || null,
        min_before_reorder: p.MinimumBeforeReorder,
        reorder_quantity: p.ReorderQuantity,
        carton_height: p.CartonHeight,
        carton_width: p.CartonWidth,
        carton_length: p.CartonLength,
        carton_quantity: p.CartonQuantity,
        tags: p.Tags,
        hs_code: p.HSCode,
        country_of_origin: p.CountryOfOrigin,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("cin7_products" as string)
        .upsert(rows, { onConflict: "cin7_id" });

      if (error) {
        console.error(`Product batch sync error (batch ${i / 50}):`, error);
        result.errors += batch.length;
      } else {
        result.synced += batch.length;
      }
    }
  } catch (err) {
    console.error("syncProducts error:", err);
    result.errors++;
  }

  return result;
}

// ─── Stock / Availability Sync ──────────────────────────────────────────────

export async function syncStock(): Promise<SyncResult> {
  const supabase = createServiceClient();
  const result: SyncResult = { synced: 0, errors: 0, total: 0 };

  try {
    const availability = await fetchAllPages<Cin7AvailabilityRaw>(
      "/ref/productavailability",
      "ProductAvailabilityList",
      250
    );
    result.total = availability.length;

    // Batch upsert in groups of 100
    for (let i = 0; i < availability.length; i += 100) {
      const batch = availability.slice(i, i + 100);
      const rows = batch.map((a) => ({
        cin7_product_id: a.ID,
        sku: a.SKU,
        product_name: a.Name,
        location: a.Location,
        bin: a.Bin || null,
        on_hand: a.OnHand,
        allocated: a.Allocated,
        available: a.Available,
        on_order: a.OnOrder,
        stock_on_hand: a.StockOnHand,
        in_transit: a.InTransit,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("cin7_product_stock" as string)
        .upsert(rows, { onConflict: "cin7_product_id,location" });

      if (error) {
        console.error(`Stock batch sync error (batch ${i / 100}):`, error);
        result.errors += batch.length;
      } else {
        result.synced += batch.length;
      }
    }
  } catch (err) {
    console.error("syncStock error:", err);
    result.errors++;
  }

  return result;
}

// ─── Full Inventory Sync ────────────────────────────────────────────────────

export async function syncInventory(): Promise<{
  locations: SyncResult;
  products: SyncResult;
  stock: SyncResult;
}> {
  console.log("[Cin7 Inventory] Starting sync...");

  // Sync locations first (small, needed as reference)
  const locations = await syncLocations();
  console.log(`[Cin7 Inventory] Locations: ${locations.synced}/${locations.total} synced`);

  // Sync products
  const products = await syncProducts();
  console.log(`[Cin7 Inventory] Products: ${products.synced}/${products.total} synced`);

  // Sync stock availability
  const stock = await syncStock();
  console.log(`[Cin7 Inventory] Stock: ${stock.synced}/${stock.total} synced`);

  return { locations, products, stock };
}
