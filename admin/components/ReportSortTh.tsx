import Link from 'next/link';
import type { ReactNode } from 'react';

import {
  reportHref,
  type ReportFilterParseOptions,
  type ReportFilters,
} from '@/types/report';

export function reportSortHref(
  basePath: string,
  filters: ReportFilters,
  column: string,
  parseOptions?: ReportFilterParseOptions,
) {
  const dir = filters.sort === column && filters.dir === 'asc' ? 'desc' : 'asc';
  return reportHref(basePath, { ...filters, sort: column, dir, page: 1, focusOutstanding: false }, parseOptions);
}

export function ReportSortTh({
  label,
  column,
  filters,
  basePath,
  parseOptions,
}: {
  label: string;
  column: string;
  filters: ReportFilters;
  basePath: string;
  parseOptions?: ReportFilterParseOptions;
}) {
  const active = filters.sort === column;
  const dir = active ? filters.dir : 'asc';
  return (
    <th className="px-3 py-2" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <Link
        href={reportSortHref(basePath, filters, column, parseOptions)}
        className="inline-flex items-center gap-1 font-bold text-stone-800 hover:text-emerald-800"
      >
        {label}
        <span className={`text-sm font-semibold ${active ? 'text-emerald-800' : 'text-stone-400'}`} aria-hidden>
          {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </Link>
    </th>
  );
}

export function ReportTh({ children }: { children?: ReactNode }) {
  return <th className="px-3 py-2 font-bold text-stone-800">{children}</th>;
}
