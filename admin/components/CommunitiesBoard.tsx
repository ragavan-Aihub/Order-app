'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { TableScroll } from '@/components/TableScroll';
import type { CommunityListItem } from '@/types/community';

export function CommunitiesBoard({ communities }: { communities: CommunityListItem[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return communities.filter((item) => {
      if (status === 'active' && !item.active) {
        return false;
      }
      if (status === 'inactive' && item.active) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return item.name.toLowerCase().includes(needle);
    });
  }, [communities, query, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search communities"
          className="min-h-11 w-full max-w-md rounded-lg border border-stone-300 bg-white px-3 py-2"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as 'all' | 'active' | 'inactive')}
          className="min-h-11 rounded-lg border border-stone-300 bg-white px-3 py-2"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">No communities match this search.</div>
      ) : (
        <TableScroll>
          <table className="w-full min-w-[40rem] text-left text-base">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Community</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Customers</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-stone-200">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-sm font-medium ${
                        item.active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {item.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{item.customerCount}</td>
                  <td className="px-4 py-3">{item.orderCount}</td>
                  <td className="px-4 py-3">
                    <Link href={`/communities/${item.id}`} className="font-medium text-emerald-800">
                      Manage customers
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  );
}
