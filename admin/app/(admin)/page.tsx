import Link from 'next/link';

import { StatusBadge } from '@/components/OrderBadges';
import { getAllOrders } from '@/services/orders';
import { getAllProducts } from '@/services/products';
import { ORDER_STATUSES, isPaymentCollected } from '@/types/order';
import { formatOrderNumber, formatPrice } from '@/utils/format';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [products, orders] = await Promise.all([
    getAllProducts(),
    getAllOrders({ hydrateCommunity: false }),
  ]);
  const availableCount = products.filter((product) => product.available).length;
  const attention = orders.filter(
    (order) => order.status === 'new' || (order.status === 'delivered' && !isPaymentCollected(order.payment_method)),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Dashboard</h1>
        <p className="mt-1 text-stone-600">Manage products, orders, and customers.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-sm text-stone-500">Products</p>
          <p className="text-2xl font-semibold">{products.length}</p>
          <p className="text-sm text-stone-500">{availableCount} available</p>
        </div>
        {ORDER_STATUSES.map((item) => (
          <div key={item.value} className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-sm text-stone-500">{item.label}</p>
            <p className="text-2xl font-semibold">{orders.filter((order) => order.status === item.value).length}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Needs attention</h2>
          <Link href="/orders" className="font-medium text-emerald-800">
            All orders
          </Link>
        </div>
        {attention.length === 0 ? (
          <p className="text-stone-600">Nothing waiting. New orders and unpaid deliveries will show here.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {attention.slice(0, 8).map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{formatOrderNumber(order.order_number)}</p>
                  <p className="text-sm text-stone-500">
                    {order.customer_name} · {formatPrice(order.total_amount)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={order.status} />
                  <Link href={`/orders/${order.id}`} className="font-medium text-emerald-800">
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
