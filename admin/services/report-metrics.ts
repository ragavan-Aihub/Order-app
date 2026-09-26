import { formatPrice } from '@/utils/format';
import { displayPaymentStatus, type Order } from '@/types/order';

export function isSale(order: Order): boolean {
  return order.status !== 'cancelled';
}

export function isOutstanding(order: Order): boolean {
  return order.status === 'delivered' && displayPaymentStatus(order) === 'pending';
}

export function isCollected(order: Order): boolean {
  return order.status === 'delivered' && displayPaymentStatus(order) === 'paid';
}

export function sumAmount(orders: Order[]): number {
  return orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
}

export type ReportSummary = {
  totalOrders: number;
  totalSales: number;
  deliveredSales: number;
  collected: number;
  outstanding: number;
  outstandingCount: number;
};

export function summarizeOrders(orders: Order[]): ReportSummary {
  const sales = orders.filter(isSale);
  const outstanding = orders.filter(isOutstanding);
  return {
    totalOrders: orders.length,
    totalSales: sumAmount(sales),
    deliveredSales: sumAmount(sales.filter((order) => order.status === 'delivered')),
    collected: sumAmount(orders.filter(isCollected)),
    outstanding: sumAmount(outstanding),
    outstandingCount: outstanding.length,
  };
}

export function dashboardInsight(params: {
  outstandingCount: number;
  outstandingAmount: number;
  deliveredToday: number;
}): string {
  if (params.outstandingCount > 0) {
    const n = params.outstandingCount;
    return `${n} delivered ${n === 1 ? 'order is' : 'orders are'} still unpaid — ${formatPrice(params.outstandingAmount)} outstanding.`;
  }
  if (params.deliveredToday > 0) {
    const n = params.deliveredToday;
    return `${n} ${n === 1 ? 'order' : 'orders'} delivered today.`;
  }
  return 'No outstanding payments.';
}
