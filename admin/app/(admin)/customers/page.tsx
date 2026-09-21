import { CustomersBoard } from '@/components/CustomersBoard';
import { getCustomers } from '@/services/customers';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Customers ({customers.length})</h1>
        <p className="mt-1 text-stone-600">Contact book with saved delivery addresses from the app.</p>
      </div>
      {customers.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
          No customers yet. People who sign in on the app and save an address will appear here.
        </div>
      ) : (
        <CustomersBoard customers={customers} />
      )}
    </div>
  );
}
