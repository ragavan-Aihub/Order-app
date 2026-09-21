import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CustomerForm } from '@/components/CustomerForm';
import { getCustomerById } from '@/services/customers';

export const dynamic = 'force-dynamic';

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/customers/${customer.id}`} className="text-base font-medium text-emerald-800">
          ← {customer.name || 'Customer'}
        </Link>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">Edit customer</h1>
      </div>
      <CustomerForm
        customer={{
          id: customer.id,
          name: customer.name ?? '',
          mobile: customer.mobile ?? '',
          source: customer.source,
          notes: customer.notes,
        }}
      />
    </div>
  );
}
