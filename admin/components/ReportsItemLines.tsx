'use client';

import { formatOrderItemUnit } from '@/lib/selling-units';
import type { ReportItemLine } from '@/types/report';
import { formatOrderNumber, formatPrice } from '@/utils/format';

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function ReportsItemLines({ lines }: { lines: ReportItemLine[] }) {
  function exportCsv() {
    const header = ['Order No', 'Item', 'Line total'];
    const rows = lines.map((line) => [
      formatOrderNumber(line.order_number),
      formatOrderItemUnit(line),
      String(line.subtotal),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
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
          <h2 className="text-lg font-semibold">Item lines</h2>
          <p className="mt-1 text-sm text-stone-600">
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
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 border-b border-stone-200 bg-white text-stone-500">
            <tr>
              <th className="px-3 py-2 font-medium">Order No</th>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {lines.map((line, index) => (
              <tr key={`${line.order_number}-${index}`}>
                <td className="px-3 py-2 font-semibold">{formatOrderNumber(line.order_number)}</td>
                <td className="px-3 py-2">{formatOrderItemUnit(line)}</td>
                <td className="px-3 py-2 tabular-nums">{formatPrice(line.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
