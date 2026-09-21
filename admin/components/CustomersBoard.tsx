'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { TableScroll } from '@/components/TableScroll';
import type { CustomerListItem } from '@/services/customers';
import { customerSourceLabel } from '@/types/customer';
import { formatDateTime } from '@/utils/format';

export function CustomersBoard({ customers }: { customers: CustomerListItem[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return customers;
    }
    return customers.filter((customer) =>
      [customer.name ?? '', customer.mobile ?? '', customer.defaultAddress ?? '', customer.source ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [customers, query]);

  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name or phone"
        className="min-h-11 w-full max-w-md rounded-lg border border-stone-300 bg-white px-3 py-2"
      />
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">No customers match this search.</div>
      ) : (
        <div>
          <div className="space-y-3 md:hidden">
            {filtered.map((customer) => (
              <Link
                key={customer.id}
                href={`/customers/${customer.id}`}
                className="block rounded-xl border border-stone-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{customer.name || 'No name'}</p>
                  <p className="text-sm font-medium text-emerald-800">View</p>
                </div>
                <p className="text-sm text-stone-500">{customer.mobile || '—'}</p>
                <p className="mt-1 text-sm text-emerald-800">{customerSourceLabel(customer.source)}</p>
                <p className="mt-2 text-sm text-stone-700">{customer.defaultAddress || 'No saved address'}</p>
                <p className="mt-1 text-sm text-stone-500">
                  {customer.addressCount}/3 addresses · {customer.orderCount} orders
                  {customer.lastOrderAt ? ` · ${formatDateTime(customer.lastOrderAt)}` : ''}
                </p>
              </Link>
            ))}
          </div>
          <div className="hidden md:block">
            <TableScroll>
              <table className="w-full min-w-[48rem] text-left text-base">
                <thead className="bg-stone-50 text-stone-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Default address</th>
                    <th className="px-4 py-3 font-medium">Saved</th>
                    <th className="px-4 py-3 font-medium">Orders</th>
                    <th className="px-4 py-3 font-medium">Last order</th>
                    <th className="px-4 py-3 font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((customer) => (
                    <tr key={customer.id} className="border-t border-stone-200 align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium">{customer.name || 'No name'}</p>
                        <p className="text-sm text-stone-500">{customer.mobile || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-stone-700">{customerSourceLabel(customer.source)}</td>
                      <td className="max-w-xs px-4 py-3 text-stone-700">
                        {customer.defaultAddress || 'No saved address'}
                      </td>
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
            </TableScroll>
          </div>
        </div>
      )}
    </div>
  );
}
