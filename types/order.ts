/**
 * Unified Order Types
 * Combines Cin7 and WooCommerce order data
 */

export interface UnifiedOrderItem {
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  total: number;
}

export interface UnifiedOrder {
  // Internal ID
  id: string;

  // Source IDs
  cin7Id?: string;
  wooId?: number;

  // Order number (displayed to customers)
  orderNumber: string;

  // Source
  source: "cin7" | "woocommerce";

  // Core fields
  status: string;
  statusLabel: string;
  orderDate: string;
  total: number;
  currency: string;

  // Customer info
  customerName: string;
  customerEmail: string;
  customerId?: string;

  // Shipping
  shippingAddress?: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };

  // Tracking
  trackingNumber?: string;
  carrier?: string;
  shippedDate?: string;

  // Line items
  items: UnifiedOrderItem[];

  // Metadata
  lastUpdated?: string;
}

export type OrderSource = "cin7" | "woocommerce" | "all";

export interface OrderStats {
  cin7: number;
  woocommerce: number;
  total: number;
}

// Order status mappings
export const CIN7_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ESTIMATED: "Estimated",
  ESTIMATING: "Estimating",
  ORDERING: "Ordering",
  ORDERED: "Ordered",
  APPROVED: "Approved",
  PICKING: "Picking",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  INVOICING: "Invoicing",
  INVOICED: "Invoiced",
  COMPLETED: "Completed",
  CLOSED: "Closed",
  BACKORDERED: "Backordered",
  CREDITED: "Credited",
  CANCELLED: "Cancelled",
  VOID: "Void",
  VOIDED: "Voided",
};

export const WOO_STATUS_LABELS: Record<string, string> = {
  pending: "Pending Payment",
  processing: "Processing",
  "on-hold": "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};
