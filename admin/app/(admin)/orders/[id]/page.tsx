import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminOrderModifyPanel } from '@/components/AdminOrderModifyPanel';
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
    <div className="space-y-3">
      <div>
        <Link href="/orders" className="inline-flex items-center py-1 text-base font-medium text-emerald-800">
          ← Orders
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold sm:text-2xl">Order {formatOrderNumber(order.order_number)}</h1>
          <StatusBadge status={order.status} size="lg" />
          {order.modification_summary?.modifiedFromPlaced ? (
            <span className="rounded-full bg-amber-200 px-3 py-1 text-sm font-bold uppercase tracking-wide text-amber-950">
              Invoice updated
            </span>
          ) : null}
          {order.modification_summary?.customerModifiedAfterConfirm ? (
            <span className="rounded-full bg-sky-200 px-3 py-1 text-sm font-bold uppercase tracking-wide text-sky-950">
              Customer modified
            </span>
          ) : null}
          {order.latest_delivery_attempt?.outcome === 'not_delivered' && order.status !== 'cancelled' ? (
            <span className="rounded-full bg-orange-200 px-3 py-1 text-sm font-bold uppercase tracking-wide text-orange-950">
              Not delivered
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-base text-stone-700">
          <span className="font-medium text-stone-900">{order.customer_name}</span>
          {' · '}
          {order.order_items.length} {order.order_items.length === 1 ? 'item' : 'items'}
          {' · '}
          {formatPrice(order.total_amount)}
          {' · '}
          Placed {formatDateTime(order.created_at)}
          {' · '}
          Channel {orderChannelLabel(order.channel)}
          {showCommunityType ? (
            <>
              {' · '}
              {deliveryTypeLabel(order)}
              {order.community_name ? ` · ${order.community_name}` : ''}
            </>
          ) : null}
        </p>
        {order.latest_delivery_attempt?.outcome === 'not_delivered' ? (
          <p className="mt-1 text-base font-medium text-orange-950">
            Last delivery attempt: {order.latest_delivery_attempt.reason_text}
            {order.latest_delivery_attempt.next_action === 'reschedule' ? ' · Try again' : ''}
            {order.latest_delivery_attempt.next_action === 'cancel' ? ' · Cancelled' : ''}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-3">
        <OrderWorkflow
          orderId={order.id}
          orderNumber={`#${formatOrderNumber(order.order_number)}`}
          status={order.status}
          cancelReason={order.cancel_reason}
          paymentMethod={order.payment_method ?? 'pending'}
          allowCorrection
          statusEvents={order.status_events}
          placedAt={order.created_at}
          invoicePrepared={Boolean(order.invoice_prepared_at)}
          amount={order.total_amount}
          refundStatus={order.refund_status ?? null}
          customerName={order.customer_name}
          mobile={order.mobile}
          customerId={order.customer_id}
          customerSourceLabel={customer ? customerSourceLabel(customer.source) : null}
          deliveryAddress={delivery.address}
          pincode={order.pincode}
          deliveryNotes={delivery.notes}
        />
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
        invoicePrepared={Boolean(order.invoice_prepared_at)}
      />
    </div>
  );
}
