import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CustomerAddressBook } from '@/components/CustomerAddressBook';
import { CustomerDeleteButton } from '@/components/CustomerDeleteButton';
import { getCustomerById } from '@/services/customers';
import { customerSourceLabel } from '@/types/customer';
import { formatDateTime, formatOrderNumber, formatPrice } from '@/utils/format';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="text-sm font-medium text-emerald-800">
          ← All customers
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{customer.name || 'Customer'}</h1>
        <p className="text-stone-600">
          {customer.mobile || 'No mobile'} · {customerSourceLabel(customer.source)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/customers/${customer.id}/orders/new`}
            className="inline-flex min-h-10 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Place order
          </Link>
          <Link
            href={`/customers/${customer.id}/edit`}
            className="inline-flex min-h-10 items-center rounded-lg border border-stone-300 px-4 text-sm font-medium"
          >
            Edit
          </Link>
          <CustomerDeleteButton customerId={customer.id} disabled={customer.orders.length > 0} />
        </div>
      </div>

      <CustomerAddressBook
        customerId={customer.id}
        addresses={customer.addresses}
        receiverName={customer.name ?? ''}
        receiverPhone={customer.mobile ?? ''}
      />

      {customer.orders.length > 0 ? (
        <section className="max-w-xl space-y-2">
          <h2 className="text-base font-semibold">Recent orders</h2>
          <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
            {customer.orders.slice(0, 8).map((order) => (
              <li key={order.id}>
                <Link href={`/orders/${order.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span>
                    <span className="font-medium">{formatOrderNumber(order.order_number)}</span>
                    <span className="mt-0.5 block text-xs text-stone-500">{formatDateTime(order.created_at)}</span>
                  </span>
                  <span className="text-sm">{formatPrice(order.total_amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
