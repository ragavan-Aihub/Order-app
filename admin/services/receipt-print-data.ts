'use server';

import type { ReceiptOrder, ReceiptShop } from '@/lib/order-receipt-html';
import { normalizePrintSettings, type PrintSettings } from '@/lib/print-settings';
import { loadOrderModificationSummaryForOrder } from '@/services/order-modifications';
import { getOrderById } from '@/services/orders';
import { getAdminBusiness } from '@/services/business';
import type { OrderModificationItemSnapshot, PaymentMethod } from '@/types/order';

export type OrderReceiptPrintData = {
  order: ReceiptOrder;
  shop: ReceiptShop;
  placedItems: OrderModificationItemSnapshot[];
  canPrint: boolean;
  settings: PrintSettings;
};

export async function getOrderReceiptPrintData(
  orderId: string,
): Promise<{ error: string | null; data: OrderReceiptPrintData | null }> {
  const order = await getOrderById(orderId);
  if (!order) {
    return { error: 'Order not found.', data: null };
  }

  const business = await getAdminBusiness();
  const shop: ReceiptShop = {
    name: business?.business_name?.trim() || 'Shop',
    phone: business?.phone ?? null,
    email: business?.email ?? null,
    address: business?.address ?? null,
    logoUrl: business?.logo_url ?? null,
  };

  const summary =
    order.modification_summary ??
    (await loadOrderModificationSummaryForOrder(order.id, order.order_items, {
      businessId: order.business_id,
      status: order.status,
      statusEvents: order.status_events,
    }));

  const placedItems =
    summary.placedItems.length > 0
      ? summary.placedItems
      : order.order_items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_price: Number(item.product_price),
          quantity: item.quantity,
          subtotal: Number(item.subtotal),
        }));

  const receiptOrder: ReceiptOrder = {
    order_number: order.order_number,
    customer_name: order.customer_name,
    mobile: order.mobile,
    delivery_address: order.delivery_address,
    pincode: order.pincode,
    total_amount: Number(order.total_amount),
    payment_method: (order.payment_method ?? 'pending') as PaymentMethod,
    created_at: order.created_at,
    order_items: order.order_items,
  };

  const invoiceReady = Boolean(order.invoice_prepared_at || summary.modifiedFromPlaced);
  const canPrint = invoiceReady && order.status !== 'cancelled';
  const settings = normalizePrintSettings(business?.print_settings);

  return {
    error: null,
    data: {
      order: receiptOrder,
      shop,
      placedItems,
      canPrint,
      settings,
    },
  };
}
