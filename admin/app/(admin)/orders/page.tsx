import Link from 'next/link';

import { OrdersBoard, type OrdersBoardTab } from '@/components/OrdersBoard';
import { isCommunitiesEnabled } from '@/services/business';
import { getCommunities } from '@/services/communities';
import { getAllOrders } from '@/services/orders';
import { ORDER_STATUSES, type OrderStatus } from '@/types/order';

export const dynamic = 'force-dynamic';

function parseInitialStatus(value: string | string[] | undefined): OrderStatus | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return ORDER_STATUSES.find((item) => item.value === raw)?.value;
}

function parseInitialTab(params: Record<string, string | string[] | undefined>): OrdersBoardTab {
  const view = Array.isArray(params.view) ? params.view[0] : params.view;
  if (view === 'pending_delivery') {
    return 'pending_delivery';
  }
  if (view === 'customer_modified_after_confirm') {
    return 'customer_modified_after_confirm';
  }
  return parseInitialStatus(params.status) ?? 'all';
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialTab = parseInitialTab(params);
  const enabled = await isCommunitiesEnabled();
  const [orders, communities] = await Promise.all([
    getAllOrders({ hydrateCommunity: enabled }),
    enabled ? getCommunities() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Orders</h1>
        <Link
          href="/orders/new"
          className="inline-flex min-h-10 items-center rounded-md bg-emerald-600 hover:bg-emerald-700 px-4 text-sm font-semibold text-white"
        >
          Create order
        </Link>
      </div>
      <OrdersBoard
        key={initialTab}
        orders={orders}
        communities={communities}
        communitiesEnabled={enabled}
        initialTab={initialTab}
      />
    </div>
  );
}
