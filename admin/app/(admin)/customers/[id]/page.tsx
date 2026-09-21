import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PaymentStatusBadge, StatusBadge } from '@/components/OrderBadges';
import { TableScroll } from '@/components/TableScroll';
import { getCustomerById } from '@/services/customers';
import { paymentModeLabel } from '@/types/order';
import { formatDateTime, formatOrderNumber, formatPrice } from '@/utils/format';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="text-base font-medium text-emerald-800">
          ← All customers
        </Link>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">{customer.name || 'Customer'}</h1>
        <p className="text-stone-600">
          {customer.mobile || 'No mobile'} · Joined {formatDateTime(customer.created_at)}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Saved addresses</h2>
        {customer.addresses.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
            This customer has not saved an address book yet. Order delivery details still appear on each order.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {customer.addresses.map((address) => (
              <div key={address.id} className="rounded-xl border border-stone-200 bg-white p-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
                    {address.label}
                    {address.is_default ? ' · Default' : ''}
                  </p>
                </div>
                <p className="font-medium">{address.name}</p>
                <p className="text-stone-600">{address.mobile}</p>
                {address.alt_mobile ? <p className="text-stone-500">Alt {address.alt_mobile}</p> : null}
                <p className="mt-2 whitespace-pre-wrap text-stone-800">
                  {[address.house, address.locality, address.address].filter(Boolean).join(', ')}
                </p>
                <p className="mt-1 text-stone-600">Pincode {address.pincode}</p>
                {address.instructions ? (
                  <p className="mt-2 text-sm text-stone-500">{address.instructions}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent orders</h2>
        {customer.orders.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">No orders yet.</div>
        ) : (
          <div>
          <div className="space-y-3 md:hidden">
            {customer.orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block rounded-xl border border-stone-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{formatOrderNumber(order.order_number)}</p>
                  <p className="text-sm font-medium text-emerald-800">View</p>
                </div>
                <p className="mt-1 text-sm text-stone-500">{formatDateTime(order.created_at)}</p>
                <p className="mt-2 text-sm text-stone-700">
                  {order.delivery_address}
                  <span className="block text-stone-500">{order.pincode}</span>
                </p>
                <p className="mt-2">{formatPrice(order.total_amount)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge status={order.status} />
                  <PaymentStatusBadge
                    status={order.status}
                    paymentMethod={order.payment_method}
                    refundStatus={order.refund_status}
                  />
                </div>
              </Link>
            ))}
          </div>
          <div className="hidden md:block">
            <TableScroll>
              <table className="w-full min-w-[48rem] text-left text-base">
                <thead className="bg-stone-50 text-stone-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Delivered to</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Payment Status</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {customer.orders.map((order) => (
                    <tr key={order.id} className="border-t border-stone-200 align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{formatOrderNumber(order.order_number)}</p>
                        <p className="text-sm text-stone-500">{formatDateTime(order.created_at)}</p>
                      </td>
                      <td className="px-4 py-3 text-stone-700">
                        {order.delivery_address}
                        <span className="block text-sm text-stone-500">{order.pincode}</span>
                      </td>
                      <td className="px-4 py-3">{formatPrice(order.total_amount)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge
                          status={order.status}
                          paymentMethod={order.payment_method}
                          refundStatus={order.refund_status}
                        />
                      </td>
                      <td className="px-4 py-3">{paymentModeLabel(order.payment_method)}</td>
                      <td className="px-4 py-3">
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
    </div>
  );
}
