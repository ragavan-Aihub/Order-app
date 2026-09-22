import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminOrderForm } from '@/components/AdminOrderForm';
import { getCustomerById } from '@/services/customers';
import { getAllProducts } from '@/services/products';

export const dynamic = 'force-dynamic';

export default async function NewCustomerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, products] = await Promise.all([getCustomerById(id), getAllProducts()]);
  if (!customer) {
    notFound();
  }

  const preferred = customer.addresses.find((item) => item.is_default) ?? customer.addresses[0];
  const defaultAddress = preferred
    ? [preferred.house, preferred.locality, preferred.address, preferred.pincode].filter(Boolean).join(', ')
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/customers/${customer.id}`} className="text-sm font-medium text-emerald-800">
          ← {customer.name || 'Customer'}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Create order</h1>
        <p className="mt-1 text-sm text-stone-600">
          {customer.name} · {customer.mobile}
        </p>
      </div>
      <AdminOrderForm
        customers={[
          {
            id: customer.id,
            name: customer.name,
            mobile: customer.mobile,
            source: customer.source,
            orderCount: customer.orders.length,
            defaultAddress,
          },
        ]}
        selectedCustomerId={customer.id}
        addresses={customer.addresses}
        products={products}
      />
    </div>
  );
}
