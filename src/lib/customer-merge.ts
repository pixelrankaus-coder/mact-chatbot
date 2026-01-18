/**
 * Customer Merge Logic
 * De-duplicates customers from Cin7 and WooCommerce by email/phone
 */

import { Cin7Customer } from "./cin7";
import { WooCustomer } from "./woocommerce";
import { UnifiedCustomer } from "@/types/customer";

/**
 * Normalize phone number for matching (last 9 digits)
 */
function normalizePhone(phone: string | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "").slice(-9);
}

/**
 * Normalize email for matching (lowercase, trimmed)
 */
function normalizeEmail(email: string | undefined): string {
  return (email || "").toLowerCase().trim();
}

/**
 * Convert Cin7 customer to unified format
 */
export function cin7ToUnified(c: Cin7Customer): UnifiedCustomer {
  const email = normalizeEmail(c.Email || c.Contacts?.[0]?.Email);
  const phone = c.Phone || c.Contacts?.[0]?.Phone || "";

  return {
    id: `cin7-${c.ID}`,
    cin7Id: c.ID,
    name: c.Name,
    email,
    phone,
    company: c.Name, // In Cin7, Name is often company name
    status: c.Status?.toLowerCase() === "active" ? "active" : "inactive",
    sources: ["cin7"],
    lastUpdated: c.LastModifiedOn || "",
    cin7Data: {
      currency: c.Currency,
      paymentTerm: c.PaymentTerm,
      creditLimit: c.CreditLimit,
      discount: c.Discount,
      priceTier: c.PriceTier,
      taxRule: c.TaxRule,
      taxNumber: c.TaxNumber,
      carrier: c.Carrier,
      location: c.Location,
      salesRepresentative: c.SalesRepresentative,
      tags: c.Tags,
      comments: c.Comments,
    },
  };
}

/**
 * Convert WooCommerce customer to unified format
 */
export function wooToUnified(c: WooCustomer): UnifiedCustomer {
  const name =
    `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
    c.billing?.company ||
    c.email;
  const email = normalizeEmail(c.email);
  const phone = c.billing?.phone || "";

  return {
    id: `woo-${c.id}`,
    wooId: c.id,
    name,
    email,
    phone,
    company: c.billing?.company,
    status: "active",
    sources: ["woocommerce"],
    lastUpdated: c.date_modified,
    totalOrders: c.orders_count,
    totalSpent: parseFloat(c.total_spent) || 0,
    wooData: {
      username: c.username,
      avatarUrl: c.avatar_url,
      billing: c.billing
        ? {
            address_1: c.billing.address_1,
            address_2: c.billing.address_2,
            city: c.billing.city,
            state: c.billing.state,
            postcode: c.billing.postcode,
            country: c.billing.country,
          }
        : undefined,
      shipping: c.shipping
        ? {
            address_1: c.shipping.address_1,
            address_2: c.shipping.address_2,
            city: c.shipping.city,
            state: c.shipping.state,
            postcode: c.shipping.postcode,
            country: c.shipping.country,
          }
        : undefined,
    },
  };
}

/**
 * Merge two customer lists, de-duplicating by email or phone
 * Cin7 is treated as the master source
 */
export function mergeCustomers(
  cin7List: Cin7Customer[],
  wooList: WooCustomer[]
): UnifiedCustomer[] {
  const unified: Map<string, UnifiedCustomer> = new Map();
  const phoneIndex: Map<string, string> = new Map(); // phone -> map key

  // Add Cin7 customers first (they're the master)
  for (const c of cin7List) {
    const customer = cin7ToUnified(c);
    const emailKey = customer.email;
    const phoneKey = normalizePhone(customer.phone);

    // Use email as primary key, fallback to phone or ID
    const key = emailKey || phoneKey || customer.id;
    unified.set(key, customer);

    // Index by phone for later matching
    if (phoneKey) {
      phoneIndex.set(phoneKey, key);
    }
  }

  // Add WooCommerce customers, merging if match found
  for (const w of wooList) {
    const wooCustomer = wooToUnified(w);
    const emailKey = wooCustomer.email;
    const phoneKey = normalizePhone(wooCustomer.phone);

    // Try to find existing by email first
    if (emailKey && unified.has(emailKey)) {
      const existing = unified.get(emailKey)!;
      // Merge WooCommerce data into existing Cin7 customer
      existing.wooId = wooCustomer.wooId;
      existing.sources = ["cin7", "woocommerce"];
      existing.totalOrders = wooCustomer.totalOrders;
      existing.totalSpent = wooCustomer.totalSpent;
      existing.wooData = wooCustomer.wooData;
      continue;
    }

    // Try to find existing by phone
    if (phoneKey && phoneIndex.has(phoneKey)) {
      const mapKey = phoneIndex.get(phoneKey)!;
      const existing = unified.get(mapKey)!;
      // Merge WooCommerce data into existing Cin7 customer
      existing.wooId = wooCustomer.wooId;
      existing.sources = ["cin7", "woocommerce"];
      existing.totalOrders = wooCustomer.totalOrders;
      existing.totalSpent = wooCustomer.totalSpent;
      existing.wooData = wooCustomer.wooData;
      continue;
    }

    // No match found - add as WooCommerce only customer
    const key = emailKey || phoneKey || wooCustomer.id;
    unified.set(key, wooCustomer);
  }

  return Array.from(unified.values());
}

/**
 * Get statistics about merged customers
 */
export function getCustomerStats(customers: UnifiedCustomer[]) {
  const cin7Only = customers.filter(
    (c) => c.sources.length === 1 && c.sources[0] === "cin7"
  ).length;
  const wooOnly = customers.filter(
    (c) => c.sources.length === 1 && c.sources[0] === "woocommerce"
  ).length;
  const both = customers.filter((c) => c.sources.length === 2).length;

  return {
    cin7Only,
    wooOnly,
    both,
    total: customers.length,
  };
}
