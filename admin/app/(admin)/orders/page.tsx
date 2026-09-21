import { OrdersBoard } from '@/components/OrdersBoard';
import { getAllOrders } from '@/services/orders';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const orders = await getAllOrders();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Orders ({orders.length})</h1>
          <p className="mt-1 text-stone-600">Manage and track all your orders</p>
        </div>
      </div>
      <OrdersBoard orders={orders} />
    </div>
  );
}
