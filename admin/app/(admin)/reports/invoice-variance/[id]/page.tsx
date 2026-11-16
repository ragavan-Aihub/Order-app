import Link from 'next/link';
import { notFound } from 'next/navigation';

import { InvoiceVarianceLinesTable } from '@/components/InvoiceVarianceLinesTable';
import { ReportCsvButton } from '@/components/ReportCsvButton';
import { TableScroll } from '@/components/TableScroll';
import { invoiceLineChangeLabel, invoiceOrderChangeLabel } from '@/lib/invoice-change';
import { getInvoiceVarianceOrder } from '@/services/reports';
import { formatOrderNumber, formatPrice } from '@/utils/format';

export const dynamic = 'force-dynamic';

export default async function InvoiceVarianceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getInvoiceVarianceOrder(id);
  if (!result.ok) {
    if (/could not find/i.test(result.message)) {
      notFound();
    }
    return (
      <div className="space-y-4">
        <Link href="/reports/invoice-variance" className="text-base font-medium text-stone-500 hover:text-emerald-700">
          ← Ordered vs billed
        </Link>
        <p className="text-red-800">{result.message}</p>
      </div>
    );
  }
  const row = result.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/reports/invoice-variance" className="text-base font-medium text-stone-500 hover:text-emerald-700">
            ← Ordered vs billed
          </Link>
          <h1 className="mt-1 text-3xl font-bold md:text-4xl">
            Order {formatOrderNumber(row.orderNumber)}
          </h1>
          <p className="mt-1 text-lg text-stone-600">
            {row.customerName} · {invoiceOrderChangeLabel(row.change)} · Ordered{' '}
            {formatPrice(row.orderedTotal)} · Invoiced {formatPrice(row.billedTotal)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ReportCsvButton
            filename={`order-${formatOrderNumber(row.orderNumber)}-ordered-vs-billed.csv`}
            header={['Item', 'Ordered qty', 'Invoiced qty', 'Ordered amount', 'Invoiced amount', 'Difference', 'Change']}
            rows={row.lines.map((line) => [
              line.product_name,
              String(line.orderedQty),
              String(line.billedQty),
              String(line.orderedAmount),
              String(line.billedAmount),
              String(line.billedAmount - line.orderedAmount),
              invoiceLineChangeLabel(line.change),
            ])}
          />
          <Link
            href={`/orders/${row.orderId}`}
            className="inline-flex min-h-11 items-center rounded-md border border-stone-300 px-3 text-base font-medium text-stone-800"
          >
            Open order
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white">
        {row.lines.length === 0 ? (
          <p className="p-5 text-stone-600">No lines on this invoice.</p>
        ) : (
          <TableScroll>
            <InvoiceVarianceLinesTable lines={row.lines} />
          </TableScroll>
        )}
      </section>
    </div>
  );
}
