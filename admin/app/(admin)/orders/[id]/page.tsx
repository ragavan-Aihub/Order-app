import Link from 'next/link';
import { notFound } from 'next/navigation';

import { OrderStatusForm } from '@/components/OrderStatusForm';
import { getOrderById } from '@/services/orders';
import { formatDateTime, formatOrderNumber, formatPrice } from '@/utils/format';

export const dynamic = 'force-dynamic';

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/orders" className="text-base font-medium text-emerald-800">
          ← All orders
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Order {formatOrderNumber(order.order_number)}</h1>
        <p className="text-stone-600">Placed {formatDateTime(order.created_at)}</p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <OrderStatusForm orderId={order.id} status={order.status} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold">Customer</h2>
          <p className="font-medium">{order.customer_name}</p>
          <p className="text-stone-600">{order.mobile}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold">Delivery</h2>
          <p className="whitespace-pre-wrap text-stone-800">{order.delivery_address}</p>
          <p className="mt-2 text-stone-600">Pincode {order.pincode}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-left text-base">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Qty</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((item) => (
              <tr key={item.id} className="border-t border-stone-200">
                <td className="px-4 py-3">{item.product_name}</td>
                <td className="px-4 py-3">{item.quantity}</td>
                <td className="px-4 py-3">{formatPrice(item.product_price)}</td>
                <td className="px-4 py-3">{formatPrice(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-stone-200 px-4 py-3 text-right text-lg font-semibold">
          Total {formatPrice(order.total_amount)}
        </div>
      </div>
    </div>
  );
}
