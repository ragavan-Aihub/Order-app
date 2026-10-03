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
    <div className="space-y-5">
      <div>
        <Link href="/orders" className="text-sm font-medium text-stone-500 hover:text-emerald-700">
          ← Orders
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">Create order</h1>
      </div>
      <AdminOrderForm customers={customers} addresses={addresses} products={products} />
    </div>
  );
}
