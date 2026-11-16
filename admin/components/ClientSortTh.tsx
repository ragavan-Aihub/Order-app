'use client';

import type { ReactNode } from 'react';

import type { ReportSortDir } from '@/utils/report-sort';

export function ClientSortTh({
  label,
  column,
  sort,
  dir,
  onSort,
}: {
  label: string;
  column: string;
  sort: string;
  dir: ReportSortDir;
  onSort: (column: string) => void;
}) {
  const active = sort === column;
  return (
    <th className="px-3 py-2" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 font-bold text-stone-800 hover:text-emerald-800"
      >
        {label}
        <span className={`text-sm font-semibold ${active ? 'text-emerald-800' : 'text-stone-400'}`} aria-hidden>
          {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

export function ClientPlainTh({ children }: { children?: ReactNode }) {
  return <th className="px-3 py-2 font-bold text-stone-800">{children}</th>;
}
