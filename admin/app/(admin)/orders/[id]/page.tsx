import Link from 'next/link';
import { notFound } from 'next/navigation';

import { OrderPaymentForm } from '@/components/OrderPaymentForm';
import { OrderStatusForm } from '@/components/OrderStatusForm';
import { StatusBadge } from '@/components/OrderBadges';
import { TableScroll } from '@/components/TableScroll';
import { getOrderById } from '@/services/orders';
import { ORDER_CHANNELS } from '@/types/order';
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
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold md:text-3xl">Order {formatOrderNumber(order.order_number)}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-stone-600">
          {ORDER_CHANNELS.find((item) => item.value === order.channel)?.label ?? order.channel}
          {' · '}
          {formatDateTime(order.created_at)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <OrderStatusForm
            orderId={order.id}
            status={order.status}
            cancelReason={order.cancel_reason}
          />
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <OrderPaymentForm
            orderId={order.id}
            status={order.status}
            paymentMethod={order.payment_method ?? 'pending'}
            refundStatus={order.refund_status ?? null}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold">Customer</h2>
          <p className="font-medium">{order.customer_name}</p>
          <p className="text-stone-600">{order.mobile}</p>
          {order.customer_id ? (
            <Link href={`/customers/${order.customer_id}`} className="mt-3 inline-block font-medium text-emerald-800">
              View contact book
            </Link>
          ) : null}
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold">Delivery</h2>
          <p className="whitespace-pre-wrap text-stone-800">{order.delivery_address}</p>
          <p className="mt-2 text-stone-600">Pincode {order.pincode}</p>
        </div>
      </div>

      <TableScroll>
        <table className="w-full min-w-[28rem] text-left text-base">
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
      </TableScroll>
    </div>
  );
}
