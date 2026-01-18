/**
 * Unified Customer Types
 * Combines Cin7 and WooCommerce customer data
 */

export interface UnifiedCustomer {
  // Internal ID (for merged view)
  id: string;

  // Source IDs
  cin7Id?: string;
  wooId?: number;

  // Core fields
  name: string;
  email: string;
  phone: string;
  company?: string;
  status: "active" | "inactive";

  // Sources present
  sources: ("cin7" | "woocommerce")[];

  // Metadata
  lastUpdated: string;

  // Sales summary stats
  totalOrders?: number;
  totalSpent?: number;
  lastOrderDate?: string;

  // Additional Cin7 fields for detail view
  cin7Data?: {
    currency?: string;
    paymentTerm?: string;
    creditLimit?: number;
    discount?: number;
    priceTier?: string;
    taxRule?: string;
    taxNumber?: string;
    carrier?: string;
    location?: string;
    salesRepresentative?: string;
    tags?: string;
    comments?: string;
  };

  // Additional WooCommerce fields for detail view
  wooData?: {
    username?: string;
    avatarUrl?: string;
    billing?: {
      address_1: string;
      address_2: string;
      city: string;
      state: string;
      postcode: string;
      country: string;
    };
    shipping?: {
      address_1: string;
      address_2: string;
      city: string;
      state: string;
      postcode: string;
      country: string;
    };
  };
}

export type CustomerSource = "cin7" | "woocommerce" | "both" | "all";

export interface CustomerStats {
  cin7Only: number;
  wooOnly: number;
  both: number;
  total: number;
}
