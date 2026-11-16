'use client';

import { useMemo, useState } from 'react';

import { ClientSortTh } from '@/components/ClientSortTh';
import { InvoiceChangeBadge } from '@/components/InvoiceChangeBadge';
import { formatLineMultiplier } from '@/lib/selling-units';
import { invoiceLineChangeLabel, type InvoiceLineChange } from '@/lib/invoice-change';
import { formatPrice, formatSignedPrice, signedPriceClass } from '@/utils/format';
import { sortReportRows, type ReportSortDir } from '@/utils/report-sort';

type Line = {
  rowKey: string;
  product_name: string;
  orderedQty: number;
  billedQty: number;
  orderedAmount: number;
  billedAmount: number;
  change: InvoiceLineChange;
};

export function InvoiceVarianceLinesTable({ lines }: { lines: Line[] }) {
  const [sort, setSort] = useState('');
  const [dir, setDir] = useState<ReportSortDir>('asc');
  const rows = useMemo(
    () =>
      sortReportRows(lines, sort, dir, {
        item: (line) => line.product_name,
        ordered_qty: (line) => line.orderedQty,
        billed_qty: (line) => line.billedQty,
        ordered_amount: (line) => line.orderedAmount,
        billed_amount: (line) => line.billedAmount,
        difference: (line) => line.billedAmount - line.orderedAmount,
        change: (line) => invoiceLineChangeLabel(line.change),
      }),
    [dir, lines, sort],
  );

  function onSort(column: string) {
    if (sort === column) {
      setDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSort(column);
    setDir('asc');
  }

  return (
    <table className="min-w-full text-left text-base">
      <thead className="border-b border-stone-200 bg-stone-50">
        <tr>
          <ClientSortTh label="Item" column="item" sort={sort} dir={dir} onSort={onSort} />
          <ClientSortTh label="Ordered qty" column="ordered_qty" sort={sort} dir={dir} onSort={onSort} />
          <ClientSortTh label="Invoiced qty" column="billed_qty" sort={sort} dir={dir} onSort={onSort} />
          <ClientSortTh label="Ordered amount" column="ordered_amount" sort={sort} dir={dir} onSort={onSort} />
          <ClientSortTh label="Invoiced amount" column="billed_amount" sort={sort} dir={dir} onSort={onSort} />
          <ClientSortTh label="Difference" column="difference" sort={sort} dir={dir} onSort={onSort} />
          <ClientSortTh label="Change" column="change" sort={sort} dir={dir} onSort={onSort} />
        </tr>
      </thead>
      <tbody className="divide-y divide-stone-100">
        {rows.map((line) => (
          <tr key={line.rowKey}>
            <td className="px-3 py-2 font-medium">{line.product_name}</td>
            <td className="px-3 py-2 tabular-nums">{formatLineMultiplier(line.orderedQty)}</td>
            <td className="px-3 py-2 tabular-nums">{formatLineMultiplier(line.billedQty)}</td>
            <td className="px-3 py-2 tabular-nums">{formatPrice(line.orderedAmount)}</td>
            <td className="px-3 py-2 tabular-nums">{formatPrice(line.billedAmount)}</td>
            <td
              className={`px-3 py-2 tabular-nums font-medium ${signedPriceClass(line.billedAmount - line.orderedAmount)}`}
            >
              {formatSignedPrice(line.billedAmount - line.orderedAmount)}
            </td>
            <td className="px-3 py-2">
              <InvoiceChangeBadge change={line.change} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
