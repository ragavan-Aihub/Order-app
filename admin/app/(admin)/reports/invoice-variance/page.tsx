import Link from 'next/link';

import { InvoiceChangeBadge } from '@/components/InvoiceChangeBadge';
import { ReportChrome, ReportLoadError } from '@/components/ReportChrome';
import { ReportCsvButton } from '@/components/ReportCsvButton';
import { ReportSortTh, ReportTh } from '@/components/ReportSortTh';
import { TableScroll } from '@/components/TableScroll';
import { isCommunitiesEnabled } from '@/services/business';
import { getCommunities } from '@/services/communities';
import { getInvoiceVarianceReport, invoiceOrderChangeLabel } from '@/services/reports';
import { parseReportFilters, type ReportFilterParseOptions } from '@/types/report';
import { formatOrderNumber, formatPrice, formatSignedPrice, signedPriceClass } from '@/utils/format';

export const dynamic = 'force-dynamic';

const BASE = '/reports/invoice-variance';
const PARSE: ReportFilterParseOptions = { defaultStatus: 'delivered' };

export default async function InvoiceVarianceReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = parseReportFilters(await searchParams, PARSE);
  const communitiesEnabled = await isCommunitiesEnabled();
  const [result, communities] = await Promise.all([
    getInvoiceVarianceReport(parsed),
    communitiesEnabled ? getCommunities() : Promise.resolve([]),
  ]);
  if (!result.ok) {
    return <ReportLoadError message={result.message} />;
  }
  const { filters, range, rows } = result.data;

  return (
    <ReportChrome
      title="Ordered vs billed"
      description="Each invoice is one row. Open it to see every line, including no difference, excess, short, removed, and added."
      filters={filters}
      rangeStart={range.startYmd}
      rangeEnd={range.endYmd}
      communities={communities}
      communitiesEnabled={communitiesEnabled}
      basePath={BASE}
      parseOptions={PARSE}
      hidePayment
      actions={
        <ReportCsvButton
          filename="ordered-vs-billed-orders.csv"
          header={['Order No', 'Customer', 'Ordered total', 'Invoiced total', 'Difference', 'Change']}
          rows={rows.map((row) => [
            formatOrderNumber(row.orderNumber),
            row.customerName,
            String(row.orderedTotal),
            String(row.billedTotal),
            String(row.billedTotal - row.orderedTotal),
            invoiceOrderChangeLabel(row.change),
          ])}
        />
      }
    >
      <section className="rounded-xl border border-stone-200 bg-white">
        {rows.length === 0 ? (
          <p className="p-5 text-stone-600">No invoices in this period.</p>
        ) : (
          <TableScroll>
            <table className="min-w-full text-left text-base">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <ReportSortTh label="Order No" column="order_number" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Customer" column="customer" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Ordered total" column="ordered" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Invoiced total" column="invoiced" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Difference" column="difference" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Change" column="change" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportTh>
                    <span className="sr-only">Open</span>
                  </ReportTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((row) => (
                  <tr key={row.orderId}>
                    <td className="px-3 py-2 font-semibold">{formatOrderNumber(row.orderNumber)}</td>
                    <td className="px-3 py-2">{row.customerName}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPrice(row.orderedTotal)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPrice(row.billedTotal)}</td>
                    <td className={`px-3 py-2 tabular-nums font-medium ${signedPriceClass(row.billedTotal - row.orderedTotal)}`}>
                      {formatSignedPrice(row.billedTotal - row.orderedTotal)}
                    </td>
                    <td className="px-3 py-2">
                      <InvoiceChangeBadge change={row.change} />
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`${BASE}/${row.orderId}`}
                        className="font-medium text-emerald-800"
                      >
                        View lines
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>
    </ReportChrome>
  );
}
