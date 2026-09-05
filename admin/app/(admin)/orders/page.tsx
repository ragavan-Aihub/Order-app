import Link from 'next/link';

import { getAllOrders } from '@/services/orders';
import { ORDER_STATUSES } from '@/types/order';
import { formatDateTime, formatOrderNumber, formatPrice } from '@/utils/format';

export const dynamic = 'force-dynamic';

function statusLabel(status: string) {
  return ORDER_STATUSES.find((item) => item.value === status)?.label ?? status;
}

export default async function OrdersPage() {
  const orders = await getAllOrders();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Orders</h1>
      {orders.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
          No orders yet. New customer orders will appear here.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-base">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Placed</th>
                <th className="px-4 py-3 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-stone-200">
                  <td className="px-4 py-3 font-semibold">{formatOrderNumber(order.order_number)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{order.customer_name}</p>
                    <p className="text-sm text-stone-500">{order.mobile}</p>
                  </td>
                  <td className="px-4 py-3">{formatPrice(order.total_amount)}</td>
                  <td className="px-4 py-3">{statusLabel(order.status)}</td>
                  <td className="px-4 py-3 text-stone-600">{formatDateTime(order.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/orders/${order.id}`} className="font-medium text-emerald-800">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
