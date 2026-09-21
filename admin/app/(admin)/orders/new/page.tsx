import Link from 'next/link';

import { AdminOrderForm } from '@/components/AdminOrderForm';
import { getCustomerAddresses, getCustomers } from '@/services/customers';
import { getAllProducts } from '@/services/products';

export const dynamic = 'force-dynamic';

export default async function NewOrderPage() {
  const [customers, addresses, products] = await Promise.all([
    getCustomers(),
    getCustomerAddresses(),
    getAllProducts(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/orders" className="text-base font-medium text-emerald-800">
          ← All orders
        </Link>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">Place order</h1>
        <p className="mt-1 text-stone-600">Create an order for a WhatsApp, walk-in, or app customer.</p>
      </div>
      {customers.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <p className="text-stone-600">Add a customer first, then place the order here.</p>
          <Link href="/customers/new" className="mt-3 inline-block font-medium text-emerald-800">
            Add customer
          </Link>
        </div>
      ) : (
        <AdminOrderForm customers={customers} addresses={addresses} products={products} />
      )}
    </div>
  );
}
