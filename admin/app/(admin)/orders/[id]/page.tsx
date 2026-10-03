import Link from 'next/link';
import { notFound } from 'next/navigation';

import { OrderPaymentForm } from '@/components/OrderPaymentForm';
import { OrderWorkflow } from '@/components/OrderWorkflow';
import { StatusBadge } from '@/components/OrderBadges';
import { TableScroll } from '@/components/TableScroll';
import { getCustomerById } from '@/services/customers';
import { getOrderById } from '@/services/orders';
import { isCommunitiesEnabled } from '@/services/business';
import { deliveryTypeLabel } from '@/types/community';
import { customerSourceLabel } from '@/types/customer';
import { orderChannelLabel } from '@/types/order';
import { formatDateTime, formatOrderNumber, formatPrice, splitDeliveryNotes } from '@/utils/format';

export const dynamic = 'force-dynamic';

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    notFound();
  }

  const customer = order.customer_id ? await getCustomerById(order.customer_id) : null;
  const delivery = splitDeliveryNotes(order.delivery_address);
  const showCommunityType = await isCommunitiesEnabled();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/orders" className="text-sm font-medium text-emerald-800">
          ← Orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Order {formatOrderNumber(order.order_number)}</h1>
          <StatusBadge status={order.status} size="lg" />
        </div>
        <p className="mt-1 text-sm font-medium text-stone-800">
          {order.customer_name} · {order.order_items.length}{' '}
          {order.order_items.length === 1 ? 'item' : 'items'} · {formatPrice(order.total_amount)}
        </p>
        <p className="mt-0.5 text-sm text-stone-600">
          Placed {formatDateTime(order.created_at)} · Channel {orderChannelLabel(order.channel)}
          {showCommunityType ? (
            <>
              {' '}
              · {deliveryTypeLabel(order)}
              {order.community_name ? ` · ${order.community_name}` : ''}
            </>
          ) : null}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <OrderWorkflow
            orderId={order.id}
            orderNumber={`#${formatOrderNumber(order.order_number)}`}
            status={order.status}
            cancelReason={order.cancel_reason}
            paymentMethod={order.payment_method ?? 'pending'}
            allowCorrection
          />
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <OrderPaymentForm
            orderId={order.id}
            orderNumber={`#${formatOrderNumber(order.order_number)}`}
            amount={order.total_amount}
            status={order.status}
            paymentMethod={order.payment_method ?? 'pending'}
            refundStatus={order.refund_status ?? null}
          />
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="mb-2 text-base font-semibold">Customer</h2>
            <p className="font-medium">{order.customer_name}</p>
            <p className="text-sm text-stone-600">{order.mobile}</p>
            {customer ? (
              <p className="mt-1 text-sm text-stone-500">Source {customerSourceLabel(customer.source)}</p>
            ) : null}
            {order.customer_id ? (
              <Link href={`/customers/${order.customer_id}`} className="mt-2 inline-block text-sm font-medium text-emerald-800">
                Customer history
              </Link>
            ) : null}
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold">Delivery</h2>
            <p className="whitespace-pre-wrap text-sm text-stone-800">{delivery.address}</p>
            <p className="mt-1 text-sm text-stone-600">Pincode {order.pincode}</p>
            {delivery.notes ? <p className="mt-2 text-sm text-stone-600">Notes: {delivery.notes}</p> : null}
          </div>
        </div>
      </div>

      <TableScroll>
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Price</th>
              <th className="px-3 py-2 font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((item) => (
              <tr key={item.id} className="border-t border-stone-200">
                <td className="px-3 py-2">{item.product_name}</td>
                <td className="px-3 py-2">{item.quantity}</td>
                <td className="px-3 py-2">{formatPrice(item.product_price)}</td>
                <td className="px-3 py-2">{formatPrice(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-stone-200 px-3 py-3 text-right font-semibold">
          Total {formatPrice(order.total_amount)}
        </div>
      </TableScroll>
    </div>
  );
}
