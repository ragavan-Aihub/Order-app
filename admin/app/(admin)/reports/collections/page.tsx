import Link from 'next/link';

import { MobileOrderRowCard } from '@/components/MobileOrderRowCard';
import { PaymentStatusBadge } from '@/components/OrderBadges';
import { ReportChrome, ReportLoadError } from '@/components/ReportChrome';
import { ScrollToOutstanding } from '@/components/ReportsFilters';
import { ReportSortTh, ReportTh } from '@/components/ReportSortTh';
import { TableScroll } from '@/components/TableScroll';
import { isCommunitiesEnabled } from '@/services/business';
import { getCommunities } from '@/services/communities';
import { getCollectionsReport } from '@/services/reports';
import { parseReportFilters, type ReportFilterParseOptions } from '@/types/report';
import { formatDateTime, formatOrderNumber, formatPrice } from '@/utils/format';

export const dynamic = 'force-dynamic';

const BASE = '/reports/collections';
const PARSE: ReportFilterParseOptions = { defaultStatus: 'delivered' };

export default async function CollectionsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = parseReportFilters(await searchParams, PARSE);
  const communitiesEnabled = await isCommunitiesEnabled();
  const [result, communities] = await Promise.all([
    getCollectionsReport(parsed),
    communitiesEnabled ? getCommunities() : Promise.resolve([]),
  ]);
  if (!result.ok) {
    return <ReportLoadError message={result.message} />;
  }
  const { filters, range, summary, outstanding, breakdown } = result.data;

  return (
    <ReportChrome
      title="Collections and outstanding"
      description="Money collected (cash and UPI) and delivered orders still unpaid. Default is delivered orders."
      filters={filters}
      rangeStart={range.startYmd}
      rangeEnd={range.endYmd}
      communities={communities}
      communitiesEnabled={communitiesEnabled}
      basePath={BASE}
      parseOptions={PARSE}
    >
      <ScrollToOutstanding active={filters.focusOutstanding} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Collected" value={formatPrice(summary.collected)} />
        <SummaryCard label="Cash" value={formatPrice(breakdown.cashCollected)} />
        <SummaryCard label="UPI" value={formatPrice(breakdown.upiCollected)} />
        <SummaryCard label="Outstanding" value={formatPrice(summary.outstanding)} />
      </div>

      <section
        id="outstanding"
        className={`scroll-mt-20 rounded-xl border p-5 ${
          summary.outstandingCount > 0 ? 'border-amber-300 bg-amber-50/60' : 'border-stone-200 bg-white'
        }`}
      >
        <h2 className="text-xl font-semibold text-stone-900">Outstanding</h2>
        <p className="mt-1 text-base text-stone-600">
          {formatPrice(summary.outstanding)} · {summary.outstandingCount} unpaid delivered{' '}
          {summary.outstandingCount === 1 ? 'order' : 'orders'}
          {breakdown.refundedCount > 0 ? ` · ${breakdown.refundedCount} refunded` : ''}
        </p>
        {outstanding.length === 0 ? (
          <p className="mt-4 text-stone-600">No outstanding payments in this period.</p>
        ) : (
          <div className="mt-4">
            <div className="space-y-3 md:hidden">
              {outstanding.map((order) => (
                <MobileOrderRowCard
                  key={order.id}
                  orderId={order.id}
                  orderNumber={order.order_number}
                  customerName={order.customer_name}
                  totalAmount={order.total_amount}
                  status={order.status}
                  paymentMethod={order.payment_method ?? 'pending'}
                  refundStatus={order.refund_status}
                  subtitle={order.mobile}
                  timeLabel="Delivered"
                  timeValue={order.deliveredAt}
                />
              ))}
            </div>
            <div className="hidden md:block">
              <TableScroll>
                <table className="min-w-full text-left text-base">
                  <thead className="border-b border-stone-200">
                    <tr>
                      <ReportSortTh label="Order No" column="order_number" filters={filters} basePath={BASE} parseOptions={PARSE} />
                      <ReportSortTh label="Customer" column="customer" filters={filters} basePath={BASE} parseOptions={PARSE} />
                      <ReportSortTh label="Phone" column="phone" filters={filters} basePath={BASE} parseOptions={PARSE} />
                      <ReportSortTh label="Delivered" column="delivered" filters={filters} basePath={BASE} parseOptions={PARSE} />
                      <ReportSortTh label="Amount" column="amount" filters={filters} basePath={BASE} parseOptions={PARSE} />
                      <ReportSortTh label="Payment" column="payment" filters={filters} basePath={BASE} parseOptions={PARSE} />
                      {communitiesEnabled ? (
                        <ReportSortTh label="Community" column="community" filters={filters} basePath={BASE} parseOptions={PARSE} />
                      ) : null}
                      <ReportTh>
                        <span className="sr-only">View</span>
                      </ReportTh>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {outstanding.map((order) => (
                      <tr key={order.id}>
                        <td className="px-3 py-2 font-semibold">{formatOrderNumber(order.order_number)}</td>
                        <td className="px-3 py-2">{order.customer_name}</td>
                        <td className="px-3 py-2">{order.mobile}</td>
                        <td className="px-3 py-2 text-stone-500">{formatDateTime(order.deliveredAt)}</td>
                        <td className="px-3 py-2">{formatPrice(order.total_amount)}</td>
                        <td className="px-3 py-2">
                          <PaymentStatusBadge
                            status={order.status}
                            paymentMethod={order.payment_method}
                            refundStatus={order.refund_status}
                          />
                        </td>
                        {communitiesEnabled ? (
                          <td className="px-3 py-2">{order.community_name || '—'}</td>
                        ) : null}
                        <td className="px-3 py-2">
                          <Link href={`/orders/${order.id}`} className="font-medium text-emerald-800">
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
      </section>
    </ReportChrome>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-900">{value}</p>
    </div>
  );
}
