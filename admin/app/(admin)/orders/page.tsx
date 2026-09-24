import Link from 'next/link';

import { OrdersBoard } from '@/components/OrdersBoard';
import { isCommunitiesEnabled } from '@/services/business';
import { getCommunities } from '@/services/communities';
import { getAllOrders } from '@/services/orders';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
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
      <OrdersBoard orders={orders} communities={communities} communitiesEnabled={enabled} />
    </div>
  );
}
