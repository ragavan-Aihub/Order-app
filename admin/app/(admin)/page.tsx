import Link from 'next/link';

import { getAllProducts } from '@/services/products';

export default async function DashboardPage() {
  const products = await getAllProducts();
  const availableCount = products.filter((product) => product.available).length;

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
          <p className="text-3xl font-semibold">0</p>
          <p className="text-sm text-stone-500">No orders yet</p>
        </div>
      </div>
      <div className="flex gap-4 text-base font-medium text-emerald-800">
        <Link href="/products">View products</Link>
        <Link href="/orders">View orders</Link>
        <Link href="/settings">Business settings</Link>
      </div>
    </div>
  );
}
