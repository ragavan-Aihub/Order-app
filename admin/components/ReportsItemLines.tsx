'use client';

import { useMemo, useState } from 'react';

import { ClientSortTh } from '@/components/ClientSortTh';
import { formatLineMultiplier, formatOrderItemPackLabel } from '@/lib/selling-units';
import type { ReportItemLine } from '@/types/report';
import { formatOrderNumber, formatPrice } from '@/utils/format';
import { sortReportRows, type ReportSortDir } from '@/utils/report-sort';

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function ReportsItemLines({ lines }: { lines: ReportItemLine[] }) {
  const [sort, setSort] = useState('');
  const [dir, setDir] = useState<ReportSortDir>('asc');
  const rows = useMemo(
    () =>
      sortReportRows(lines, sort, dir, {
        order_number: (line) => line.order_number ?? 0,
        item: (line) => line.product_name,
        pack: (line) => formatOrderItemPackLabel(line) ?? 'pcs',
        qty: (line) => line.quantity,
        total: (line) => line.subtotal,
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

  function exportCsv() {
    const header = ['Order No', 'Item', 'Pack', 'Qty', 'Line total'];
    const csvRows = rows.map((line) => [
      formatOrderNumber(line.order_number),
      line.product_name,
      formatOrderItemPackLabel(line) ?? 'pcs',
      formatLineMultiplier(line.quantity),
      String(line.subtotal),
    ]);
    const csv = [header, ...csvRows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'report-item-lines.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  if (lines.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Item lines</h2>
          <p className="mt-1 text-base text-stone-600">
            Snapshots from each order. Line totals are rupees — quantities are not added across Kg, packs, and
            bottles.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex min-h-10 items-center rounded-md border border-stone-300 px-3 text-sm font-medium text-stone-800"
        >
          Export item CSV
        </button>
      </div>
      <div className="mt-4 max-h-[28rem] overflow-auto">
        <table className="min-w-full text-left text-base">
          <thead className="sticky top-0 border-b border-stone-200 bg-white">
            <tr>
              <ClientSortTh label="Order No" column="order_number" sort={sort} dir={dir} onSort={onSort} />
              <ClientSortTh label="Item" column="item" sort={sort} dir={dir} onSort={onSort} />
              <ClientSortTh label="Pack" column="pack" sort={sort} dir={dir} onSort={onSort} />
              <ClientSortTh label="Qty" column="qty" sort={sort} dir={dir} onSort={onSort} />
              <ClientSortTh label="Line total" column="total" sort={sort} dir={dir} onSort={onSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((line, index) => (
              <tr key={`${line.order_number}-${index}`}>
                <td className="px-3 py-2 font-semibold">{formatOrderNumber(line.order_number)}</td>
                <td className="px-3 py-2">{line.product_name}</td>
                <td className="px-3 py-2 text-stone-600">{formatOrderItemPackLabel(line) ?? 'pcs'}</td>
                <td className="px-3 py-2 tabular-nums">{formatLineMultiplier(line.quantity)}</td>
                <td className="px-3 py-2 tabular-nums">{formatPrice(line.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
