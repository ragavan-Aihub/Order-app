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

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/customers/${customer.id}`} className="text-base font-medium text-emerald-800">
          ← {customer.name || 'Customer'}
        </Link>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">Place order</h1>
        <p className="mt-1 text-stone-600">
          {customer.name} · {customer.mobile}
        </p>
      </div>
      <AdminOrderForm
        customers={[{ id: customer.id, name: customer.name, mobile: customer.mobile }]}
        selectedCustomerId={customer.id}
        addresses={customer.addresses}
        products={products}
      />
    </div>
  );
}
