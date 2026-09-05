import Link from 'next/link';

import { getAllOrders } from '@/services/orders';
import { getAllProducts } from '@/services/products';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [products, orders] = await Promise.all([getAllProducts(), getAllOrders()]);
  const availableCount = products.filter((product) => product.available).length;
  const newCount = orders.filter((order) => order.status === 'new').length;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-lg text-stone-600">Manage products, orders, and business settings.</p>
      <div className="grid max-w-xl grid-cols-2 gap-4">
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-500">Products</p>
          <p className="text-3xl font-semibold">{products.length}</p>
          <p className="text-sm text-stone-500">{availableCount} available</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-500">Orders</p>
          <p className="text-3xl font-semibold">{orders.length}</p>
          <p className="text-sm text-stone-500">
            {newCount === 0 ? 'No new orders' : `${newCount} new`}
          </p>
        </div>
      </div>
      <div className="flex gap-4 text-base font-medium text-emerald-800">
        <Link href="/products">View products</Link>
        <Link href="/orders">View orders</Link>
        <Link href="/settings/business-info">Settings</Link>
      </div>
    </div>
  );
}
