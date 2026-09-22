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
    <div className="space-y-4">
      <div>
        <Link href="/orders" className="text-sm font-medium text-emerald-800">
          ← Orders
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Create order</h1>
      </div>
      <AdminOrderForm customers={customers} addresses={addresses} products={products} />
    </div>
  );
}
