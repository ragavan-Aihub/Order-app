import Link from 'next/link';

import { getCustomers } from '@/services/customers';
import { formatDateTime } from '@/utils/format';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Customers</h1>
        <p className="mt-1 text-stone-600">Contact book with saved delivery addresses from the app.</p>
      </div>
      {customers.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
          No customers yet. People who sign in on the app and save an address will appear here.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-base">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Default address</th>
                <th className="px-4 py-3 font-medium">Saved</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Last order</th>
                <th className="px-4 py-3 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-t border-stone-200 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{customer.name || 'No name'}</p>
                    <p className="text-sm text-stone-500">{customer.mobile || '—'}</p>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-stone-700">{customer.defaultAddress || 'No saved address'}</td>
                  <td className="px-4 py-3">{customer.addressCount}/3</td>
                  <td className="px-4 py-3">{customer.orderCount}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {customer.lastOrderAt ? formatDateTime(customer.lastOrderAt) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/customers/${customer.id}`} className="font-medium text-emerald-800">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
