import { ReportChrome, ReportLoadError } from '@/components/ReportChrome';
import { ReportCsvButton } from '@/components/ReportCsvButton';
import { ReportSortTh } from '@/components/ReportSortTh';
import { TableScroll } from '@/components/TableScroll';
import { isCommunitiesEnabled } from '@/services/business';
import { getCommunities } from '@/services/communities';
import { getItemSalesReport } from '@/services/reports';
import { parseReportFilters, type ReportFilterParseOptions } from '@/types/report';
import { formatPrice } from '@/utils/format';

export const dynamic = 'force-dynamic';

const BASE = '/reports/item-sales';
const PARSE: ReportFilterParseOptions = { defaultStatus: 'delivered' };

export default async function ItemSalesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = parseReportFilters(await searchParams, PARSE);
  const communitiesEnabled = await isCommunitiesEnabled();
  const [result, communities] = await Promise.all([
    getItemSalesReport(parsed),
    communitiesEnabled ? getCommunities() : Promise.resolve([]),
  ]);
  if (!result.ok) {
    return <ReportLoadError message={result.message} />;
  }
  const { filters, range, rows, totalAmount } = result.data;

  return (
    <ReportChrome
      title="Item-wise sales summary"
      description="Invoiced quantity and amount. Kg and litre are totals; each standard pack size is its own row. Default is delivered orders."
      filters={filters}
      rangeStart={range.startYmd}
      rangeEnd={range.endYmd}
      communities={communities}
      communitiesEnabled={communitiesEnabled}
      basePath={BASE}
      parseOptions={PARSE}
      actions={
        <ReportCsvButton
          filename="item-wise-sales.csv"
          header={['Item', 'Pack', 'Qty', 'Orders', 'Amount']}
          rows={rows.map((row) => [
            row.product_name,
            row.packLabel ?? '',
            row.qtyLabel,
            String(row.orderCount),
            String(row.amount),
          ])}
        />
      }
    >
      <p className="text-base text-stone-600">
        {rows.length} items · {formatPrice(totalAmount)}
      </p>
      <section className="rounded-xl border border-stone-200 bg-white">
        {rows.length === 0 ? (
          <p className="p-5 text-stone-600">No item sales in this period.</p>
        ) : (
          <TableScroll>
            <table className="min-w-full text-left text-base">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <ReportSortTh label="Item" column="item" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Pack" column="pack" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Qty sold" column="qty" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Orders" column="orders" filters={filters} basePath={BASE} parseOptions={PARSE} />
                  <ReportSortTh label="Amount" column="amount" filters={filters} basePath={BASE} parseOptions={PARSE} />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((row) => (
                  <tr key={row.rowKey}>
                    <td className="px-3 py-2 font-medium text-stone-900">{row.product_name}</td>
                    <td className="px-3 py-2 text-stone-600">{row.packLabel ?? 'pcs'}</td>
                    <td className="px-3 py-2 tabular-nums">{row.qtyLabel}</td>
                    <td className="px-3 py-2 tabular-nums">{row.orderCount}</td>
                    <td className="px-3 py-2 tabular-nums font-medium">{formatPrice(row.amount)}</td>
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
