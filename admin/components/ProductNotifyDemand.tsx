import Link from 'next/link';

import type { ProductNotifyDemandRow } from '@/services/product-notify-demand';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function ProductNotifyDemand({ rows }: { rows: ProductNotifyDemandRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
        No customers have tapped Notify me yet.
      </div>
    );
  }

  const byProduct = new Map<string, ProductNotifyDemandRow[]>();
  for (const row of rows) {
    const list = byProduct.get(row.product_id) ?? [];
    list.push(row);
    byProduct.set(row.product_id, list);
  }

  return (
    <div className="space-y-4">
      {[...byProduct.entries()].map(([productId, interests]) => {
        const head = interests[0];
        return (
          <div key={productId} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 bg-stone-50 px-4 py-3">
              <div>
                <p className="font-semibold text-stone-900">{head.product_name}</p>
                <p className="text-sm text-stone-600">
                  {interests.length} customer{interests.length === 1 ? '' : 's'} waiting
                  {head.product_available ? (
                    <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                      Available now
                    </span>
                  ) : (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      Coming soon
                    </span>
                  )}
                </p>
              </div>
              <Link href={`/products/${productId}`} className="text-sm font-medium text-emerald-800">
                Edit product
              </Link>
            </div>
            <ul className="divide-y divide-stone-100">
              {interests.map((row) => (
                <li key={`${row.user_id}-${row.interest_created_at}`} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      {row.customer_id ? (
                        <Link href={`/customers/${row.customer_id}`} className="font-medium text-emerald-800">
                          {row.customer_name}
                        </Link>
                      ) : (
                        <span className="font-medium text-stone-900">{row.customer_name}</span>
                      )}
                      {row.customer_mobile ? (
                        <span className="ml-2 text-stone-600">{row.customer_mobile}</span>
                      ) : null}
                    </div>
                    <span className="text-stone-500">{formatWhen(row.interest_created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function ProductNotifyWaitingList({
  productId,
  rows,
}: {
  productId: string;
  rows: ProductNotifyDemandRow[];
}) {
  const interests = rows.filter((row) => row.product_id === productId);
  if (interests.length === 0) {
    return null;
  }
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <h2 className="text-lg font-semibold text-stone-900">Customers waiting ({interests.length})</h2>
      <p className="mt-1 text-sm text-stone-600">
        These customers tapped Notify me in the app. Marking the product Available sends them a push (if they allow
        notifications).
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {interests.map((row) => (
          <li key={`${row.user_id}-${row.interest_created_at}`} className="flex flex-wrap justify-between gap-2">
            <span>
              {row.customer_id ? (
                <Link href={`/customers/${row.customer_id}`} className="font-medium text-emerald-800">
                  {row.customer_name}
                </Link>
              ) : (
                row.customer_name
              )}
              {row.customer_mobile ? ` · ${row.customer_mobile}` : ''}
            </span>
            <span className="text-stone-500">{formatWhen(row.interest_created_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
