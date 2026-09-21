import Link from 'next/link';

import { CustomerForm } from '@/components/CustomerForm';

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="text-base font-medium text-emerald-800">
          ← All customers
        </Link>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">Add customer</h1>
        <p className="mt-1 text-stone-600">WhatsApp, walk-in, or phone — no app download needed.</p>
      </div>
      <CustomerForm />
    </div>
  );
}
