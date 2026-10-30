import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminOrderModifyPanel } from '@/components/AdminOrderModifyPanel';
import { OrderPaymentForm } from '@/components/OrderPaymentForm';
import { OrderWorkflow } from '@/components/OrderWorkflow';
import { StatusBadge } from '@/components/OrderBadges';
import { getCustomerById } from '@/services/customers';
import { getOrderById } from '@/services/orders';
import { getAllProducts } from '@/services/products';
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

  const [customer, products] = await Promise.all([
    order.customer_id ? getCustomerById(order.customer_id) : Promise.resolve(null),
    getAllProducts(),
  ]);
  const delivery = splitDeliveryNotes(order.delivery_address);
  const showCommunityType = await isCommunitiesEnabled();

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/orders"
          className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-800"
        >
          ← Orders
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="text-xl font-bold sm:text-2xl">Order {formatOrderNumber(order.order_number)}</h1>
          <StatusBadge status={order.status} size="lg" />
          {order.modification_summary?.modifiedFromPlaced ? (
            <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-950">
              Shop modified
            </span>
          ) : null}
          {order.modification_summary?.customerModifiedAfterConfirm ? (
            <span className="rounded-full bg-sky-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-950">
              Customer modified
            </span>
          ) : null}
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
        <div className="flex flex-col rounded-xl border border-stone-200 bg-white p-4 max-lg:order-1">
          <OrderWorkflow
            orderId={order.id}
            orderNumber={`#${formatOrderNumber(order.order_number)}`}
            status={order.status}
            cancelReason={order.cancel_reason}
            paymentMethod={order.payment_method ?? 'pending'}
            allowCorrection
            statusEvents={order.status_events}
            placedAt={order.created_at}
          />
        </div>
        <div className="flex flex-col rounded-xl border border-stone-200 bg-white p-4 max-lg:order-2">
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

      <AdminOrderModifyPanel
        key={`${order.id}-${order.items_revision ?? 0}-${order.order_items.length}-${order.total_amount}`}
        orderId={order.id}
        status={order.status}
        paymentMethod={order.payment_method ?? 'pending'}
        originalTotal={order.total_amount}
        originalItems={order.order_items}
        itemsRevision={order.items_revision ?? 0}
        products={products}
        adminModifiedFromPlaced={Boolean(order.modification_summary?.modifiedFromPlaced)}
        customerModifiedAfterConfirm={Boolean(order.modification_summary?.customerModifiedAfterConfirm)}
        canRevertToPlaced={Boolean(order.modification_summary?.canRevertToPlaced)}
        placedTotal={order.modification_summary?.placedTotal}
        placedItems={order.modification_summary?.placedItems ?? []}
        shopDiffBaselineItems={order.modification_summary?.revertTargetItems ?? []}
        adminCompareItems={order.modification_summary?.adminCompareItems ?? []}
        customerDiffBaselineItems={order.modification_summary?.confirmBaselineItems ?? []}
        confirmBaselineTotal={order.modification_summary?.confirmBaselineTotal ?? undefined}
        revertTargetTotal={order.modification_summary?.revertTargetTotal ?? undefined}
        relaxProductValidation={Boolean(order.modification_summary?.hasAdminModification)}
      />
    </div>
  );
}
