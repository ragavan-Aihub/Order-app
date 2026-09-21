import Link from 'next/link';

import { CustomersBoard } from '@/components/CustomersBoard';
import { getCustomers } from '@/services/customers';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Customers ({customers.length})</h1>
          <p className="mt-1 text-stone-600">App, WhatsApp, walk-in, and phone contacts. Tag the source when you add someone.</p>
        </div>
        <Link
          href="/customers/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white"
        >
          Add customer
        </Link>
      </div>
      {customers.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
          No customers yet. Add someone from WhatsApp or a walk-in, or they will appear after they order in the app.
        </div>
      ) : (
        <CustomersBoard customers={customers} />
      )}
    </div>
  );
}
