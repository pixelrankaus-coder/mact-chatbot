/**
 * Order Merge Logic
 * Converts Cin7 and WooCommerce orders to unified format
 */

import { Cin7Sale, Cin7SaleListItem } from "./cin7";
import { WooOrder } from "./woocommerce";
import {
  UnifiedOrder,
  CIN7_STATUS_LABELS,
  WOO_STATUS_LABELS,
} from "@/types/order";

/**
 * Convert Cin7 sale list item to unified order format
 * Used for the orders list view (abbreviated data from saleList endpoint)
 */
export function cin7ListItemToUnifiedOrder(sale: Cin7SaleListItem): UnifiedOrder {
  return {
    id: `cin7-${sale.SaleID}`,
    cin7Id: sale.SaleID,
    orderNumber: sale.OrderNumber,
    source: "cin7",
    status: sale.Status,
    statusLabel: CIN7_STATUS_LABELS[sale.Status] || sale.Status,
    orderDate: sale.OrderDate,
    total: sale.SaleInvoicesTotalAmount || sale.InvoiceAmount || 0,
    currency: sale.BaseCurrency || "AUD",
    customerName: sale.Customer || "",
    customerEmail: "", // Not available in list response
    customerId: sale.CustomerID,
    trackingNumber: sale.CombinedTrackingNumbers || undefined,
    items: [], // Not available in list response
    lastUpdated: sale.Updated,
  };
}

/**
 * Convert full Cin7 sale to unified order format
 * Used for order detail view (full data from sale endpoint)
 */
export function cin7ToUnifiedOrder(sale: Cin7Sale): UnifiedOrder {
  // Get total from Order or first Invoice
  const total =
    sale.Order?.Total ||
    sale.Invoices?.[0]?.Total ||
    0;

  // Get order number from Order object or generate from ID
  const orderNumber = sale.Order?.SaleOrderNumber || `SO-${sale.ID.slice(0, 8)}`;

  // Get line items from Order or first Invoice
  const lines = sale.Order?.Lines || sale.Invoices?.[0]?.Lines || [];

  // Get tracking info from fulfilments
  const shipInfo = sale.Fulfilments?.[0]?.Ship;
  const trackingLine = shipInfo?.Lines?.[0];

  return {
    id: `cin7-${sale.ID}`,
    cin7Id: sale.ID,
    orderNumber,
    source: "cin7",
    status: sale.Status,
    statusLabel: CIN7_STATUS_LABELS[sale.Status] || sale.Status,
    orderDate: sale.SaleOrderDate,
    total,
    currency: sale.BaseCurrency || "AUD",
    customerName: sale.Customer || "",
    customerEmail: sale.Email || "",
    customerId: sale.CustomerID,
    shippingAddress: sale.ShippingAddress
      ? {
          address1: [sale.ShippingAddress.Line1, sale.ShippingAddress.Line2]
            .filter(Boolean)
            .join(" "),
          city: sale.ShippingAddress.City || "",
          state: sale.ShippingAddress.State || "",
          postcode: sale.ShippingAddress.Postcode || "",
          country: sale.ShippingAddress.Country || "",
        }
      : undefined,
    trackingNumber: sale.CombinedTrackingNumbers || trackingLine?.TrackingNumber,
    carrier: sale.Carrier || trackingLine?.Carrier,
    shippedDate: trackingLine?.ShipDate,
    items: lines.map((line) => ({
      name: line.Name || "",
      sku: line.SKU,
      quantity: line.Quantity,
      price: line.Price,
      total: line.Total,
    })),
  };
}

/**
 * Convert WooCommerce order to unified order format
 */
export function wooToUnifiedOrder(order: WooOrder): UnifiedOrder {
  return {
    id: `woo-${order.id}`,
    wooId: order.id,
    orderNumber: `#${order.number}`,
    source: "woocommerce",
    status: order.status,
    statusLabel: WOO_STATUS_LABELS[order.status] || order.statusLabel || order.status,
    orderDate: order.dateCreated,
    total: parseFloat(order.total) || 0,
    currency: order.currency,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    shippingAddress: order.shipping
      ? {
          address1: order.shipping.address1,
          city: order.shipping.city,
          state: order.shipping.state,
          postcode: order.shipping.postcode,
          country: order.shipping.country,
        }
      : undefined,
    trackingNumber: order.trackingInfo?.trackingNumber,
    carrier: order.trackingInfo?.provider,
    items: (order.items || []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: parseFloat(item.price),
      total: parseFloat(item.total),
    })),
    lastUpdated: order.dateModified,
  };
}

/**
 * Merge and sort orders from both sources
 * Uses list item converter for Cin7 since saleList returns abbreviated data
 */
export function mergeOrders(
  cin7Orders: Cin7SaleListItem[],
  wooOrders: WooOrder[]
): UnifiedOrder[] {
  const unified: UnifiedOrder[] = [];

  // Convert Cin7 orders (filter out any with missing SaleID)
  for (const sale of cin7Orders) {
    if (sale.SaleID) {
      unified.push(cin7ListItemToUnifiedOrder(sale));
    }
  }

  // Convert WooCommerce orders
  for (const order of wooOrders) {
    unified.push(wooToUnifiedOrder(order));
  }

  // Sort by date (newest first)
  unified.sort((a, b) => {
    const dateA = new Date(a.orderDate).getTime();
    const dateB = new Date(b.orderDate).getTime();
    return dateB - dateA;
  });

  return unified;
}

/**
 * Get order statistics
 */
export function getOrderStats(orders: UnifiedOrder[]) {
  const cin7 = orders.filter((o) => o.source === "cin7").length;
  const woocommerce = orders.filter((o) => o.source === "woocommerce").length;

  return {
    cin7,
    woocommerce,
    total: orders.length,
  };
}
