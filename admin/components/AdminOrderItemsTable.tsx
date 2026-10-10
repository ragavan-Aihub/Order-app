import { TableScroll } from '@/components/TableScroll';
import {
  buildOrderDiffTableRows,
  orderDiffHasChanges,
  type OrderDiffRowKind,
} from '@/lib/order-modification-diff';
import type { OrderItem, OrderModificationItemSnapshot } from '@/types/order';
import { formatPrice } from '@/utils/format';

const STATUS_LABEL: Record<OrderDiffRowKind, string> = {
  unchanged: '—',
  added: 'New',
  removed: 'Removed',
  qty_changed: 'Qty updated',
};

function rowTone(kind: OrderDiffRowKind): string {
  switch (kind) {
    case 'added':
      return 'border-l-4 border-l-emerald-500 bg-emerald-50/70';
    case 'removed':
      return 'border-l-4 border-l-stone-400 bg-stone-100/90';
    case 'qty_changed':
      return 'border-l-4 border-l-amber-500 bg-amber-50/80';
    default:
      return 'border-l-4 border-l-transparent';
  }
}

function statusBadgeClass(kind: OrderDiffRowKind): string {
  switch (kind) {
    case 'added':
      return 'bg-emerald-100 text-emerald-900 ring-emerald-200';
    case 'removed':
      return 'bg-stone-200 text-stone-700 ring-stone-300';
    case 'qty_changed':
      return 'bg-amber-100 text-amber-950 ring-amber-200';
    default:
      return 'text-stone-400';
  }
}

export function AdminOrderItemsTable({
  items,
  placedItems = [],
  total,
  placedTotal,
  showDiff = false,
}: {
  items: OrderItem[];
  placedItems?: OrderModificationItemSnapshot[];
  total: number;
  placedTotal?: number;
  showDiff?: boolean;
}) {
  const diffRows = buildOrderDiffTableRows(placedItems, items);
  const useDiff = showDiff && placedItems.length > 0 && orderDiffHasChanges(diffRows);

  return (
    <div className="space-y-3">
      {useDiff ? (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600"
          role="note"
          aria-label="Change legend"
        >
          <span className="font-semibold text-stone-800">Changes vs placed order</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden />
            New line
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" aria-hidden />
            Qty updated
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-stone-400" aria-hidden />
            Removed
          </span>
          {typeof placedTotal === 'number' && placedTotal !== total ? (
            <span className="ml-auto font-medium text-stone-800">
              Total {formatPrice(placedTotal)} → {formatPrice(total)}
            </span>
          ) : null}
        </div>
      ) : null}

      <TableScroll>
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              {useDiff ? <th className="w-28 px-3 py-2 font-medium">Change</th> : null}
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Price</th>
              <th className="px-3 py-2 font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {useDiff
              ? diffRows.map((row) => {
                  const removed = row.kind === 'removed';
                  const removedRowClass =
                    'text-stone-500 line-through decoration-stone-400 decoration-2 [&_*]:line-through [&_*]:decoration-stone-400';
                  const cellClass = removed ? removedRowClass : '';
                  return (
                    <tr
                      key={row.rowKey}
                      className={`border-t border-stone-200 ${rowTone(row.kind)} ${removed ? removedRowClass : ''}`}
                    >
                      <td className={`px-3 py-2 ${cellClass}`}>
                        {row.kind === 'unchanged' ? (
                          <span className="text-stone-400">—</span>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${statusBadgeClass(row.kind)}`}
                          >
                            {STATUS_LABEL[row.kind]}
                          </span>
                        )}
                      </td>
                      <td className={`px-3 py-2 font-medium ${cellClass}`}>{row.productName}</td>
                      <td className={`px-3 py-2 tabular-nums ${cellClass}`}>
                        {row.kind === 'qty_changed' && row.placedQuantity != null ? (
                          <span className="inline-flex flex-wrap items-baseline gap-1.5">
                            <span className="font-semibold text-stone-900">{row.quantity}</span>
                            <span className="text-xs font-normal text-stone-500">
                              was{' '}
                              <span className="line-through decoration-stone-400">{row.placedQuantity}</span>
                            </span>
                          </span>
                        ) : (
                          row.quantity
                        )}
                      </td>
                      <td className={`px-3 py-2 tabular-nums ${cellClass}`}>{formatPrice(row.unitPrice)}</td>
                      <td className={`px-3 py-2 tabular-nums font-medium ${cellClass}`}>
                        {formatPrice(removed ? (row.placedSubtotal ?? row.subtotal) : row.subtotal)}
                      </td>
                    </tr>
                  );
                })
              : items.map((item) => (
                  <tr key={item.id} className="border-t border-stone-200">
                    <td className="px-3 py-2">{item.product_name}</td>
                    <td className="px-3 py-2 tabular-nums">{item.quantity}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPrice(item.product_price)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPrice(item.subtotal)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 px-3 py-3">
          <span className="font-semibold text-stone-900">Total</span>
          <div className="text-right">
            {useDiff && typeof placedTotal === 'number' && placedTotal !== total ? (
              <p className="text-xs text-stone-500 line-through">{formatPrice(placedTotal)}</p>
            ) : null}
            <p className="text-base font-semibold tabular-nums">{formatPrice(total)}</p>
          </div>
        </div>
      </TableScroll>
    </div>
  );
}
