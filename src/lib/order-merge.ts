/**
 * Order Merge Logic
 * Converts Cin7 and WooCommerce orders to unified format
 */

import { Cin7Sale } from "./cin7";
import { WooOrder } from "./woocommerce";
import {
  UnifiedOrder,
  CIN7_STATUS_LABELS,
  WOO_STATUS_LABELS,
} from "@/types/order";

/**
 * Convert Cin7 sale to unified order format
 */
export function cin7ToUnifiedOrder(sale: Cin7Sale): UnifiedOrder {
  return {
    id: `cin7-${sale.ID}`,
    cin7Id: sale.ID,
    orderNumber: sale.OrderNumber,
    source: "cin7",
    status: sale.Status,
    statusLabel: CIN7_STATUS_LABELS[sale.Status] || sale.Status,
    orderDate: sale.OrderDate,
    total: sale.Total || 0,
    currency: "AUD",
    customerName: sale.CustomerName,
    customerEmail: sale.CustomerEmail || "",
    shippingAddress: sale.ShippingAddress
      ? {
          address1: sale.ShippingAddress.Line1,
          city: sale.ShippingAddress.City,
          state: sale.ShippingAddress.State,
          postcode: sale.ShippingAddress.Postcode,
          country: sale.ShippingAddress.Country,
        }
      : undefined,
    trackingNumber: sale.Fulfilments?.[0]?.Ship?.TrackingNumber,
    carrier: sale.Fulfilments?.[0]?.Ship?.Carrier,
    shippedDate: sale.Fulfilments?.[0]?.Ship?.ShipDate,
    items: (sale.Lines || []).map((line) => ({
      name: line.ProductName,
      sku: line.ProductCode,
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
 */
export function mergeOrders(
  cin7Orders: Cin7Sale[],
  wooOrders: WooOrder[]
): UnifiedOrder[] {
  const unified: UnifiedOrder[] = [];

  // Convert Cin7 orders
  for (const sale of cin7Orders) {
    unified.push(cin7ToUnifiedOrder(sale));
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
