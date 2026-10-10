'use client';

import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AdminOrderItemsTable } from '@/components/AdminOrderItemsTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { replaceAdminOrderItems, revertAdminOrderToPlaced } from '@/services/order-actions';
import {
  isPaymentCollected,
  type OrderItem,
  type OrderModificationItemSnapshot,
  type OrderStatus,
  type PaymentMethod,
} from '@/types/order';
import type { Product } from '@/types/product';
import { formatPrice } from '@/utils/format';

type Line = { productId: string; quantity: number };

const searchClass =
  'min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100';

function linesFromOrderItems(items: OrderItem[]): Line[] {
  const map = new Map<string, number>();
  for (const item of items) {
    if (!item.product_id) {
      continue;
    }
    map.set(item.product_id, (map.get(item.product_id) ?? 0) + item.quantity);
  }
  return [...map.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

function linesEqual(a: Line[], b: Line[]) {
  if (a.length !== b.length) {
    return false;
  }
  const sortKey = (lines: Line[]) =>
    [...lines].sort((x, y) => x.productId.localeCompare(y.productId)).map((l) => `${l.productId}:${l.quantity}`);
  const sa = sortKey(a);
  const sb = sortKey(b);
  return sa.every((value, index) => value === sb[index]);
}

export function AdminOrderModifyPanel({
  orderId,
  status,
  paymentMethod,
  originalTotal,
  originalItems,
  itemsRevision,
  products,
  adminModifiedFromPlaced = false,
  canRevertToPlaced = false,
  placedTotal,
  placedItems = [],
  relaxProductValidation = false,
}: {
  orderId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  originalTotal: number;
  originalItems: OrderItem[];
  itemsRevision: number;
  products: Product[];
  adminModifiedFromPlaced?: boolean;
  canRevertToPlaced?: boolean;
  placedTotal?: number;
  placedItems?: OrderModificationItemSnapshot[];
  relaxProductValidation?: boolean;
}) {
  const router = useRouter();
  const canModify = status === 'new' || status === 'confirmed';
  const baseline = useMemo(() => linesFromOrderItems(originalItems), [originalItems]);
  const [editing, setEditing] = useState(false);
  const [lines, setLines] = useState<Line[]>(() => linesFromOrderItems(originalItems));
  const [query, setQuery] = useState('');
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(itemsRevision);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const orderItemByProductId = useMemo(() => {
    const map = new Map<string, OrderItem>();
    for (const item of originalItems) {
      if (item.product_id) {
        map.set(item.product_id, item);
      }
    }
    return map;
  }, [originalItems]);

  const resolved = useMemo(() => {
    return lines
      .map((line) => {
        const product = productById.get(line.productId);
        const onOrder = orderItemByProductId.get(line.productId);
        if (!product && !onOrder) {
          return null;
        }
        const unit = product?.price ?? Number(onOrder?.product_price ?? 0);
        const name = product?.name ?? onOrder?.product_name ?? 'Item';
        const catalogAvailable = product ? product.available !== false && product.active !== false : false;
        const available = relaxProductValidation ? Boolean(product ?? onOrder) : catalogAvailable;
        return {
          ...line,
          name,
          unit,
          subtotal: unit * line.quantity,
          available,
        };
      })
      .filter(Boolean) as Array<Line & { name: string; unit: number; subtotal: number; available: boolean }>;
  }, [lines, orderItemByProductId, productById, relaxProductValidation]);

  const removedLines = useMemo(() => {
    const active = new Set(lines.map((line) => line.productId));
    return baseline
      .filter((line) => !active.has(line.productId))
      .map((line) => {
        const onOrder = orderItemByProductId.get(line.productId);
        const product = productById.get(line.productId);
        const name = product?.name ?? onOrder?.product_name ?? 'Item';
        const unit = product?.price ?? Number(onOrder?.product_price ?? 0);
        return {
          productId: line.productId,
          name,
          quantity: line.quantity,
          unit,
          subtotal: unit * line.quantity,
        };
      });
  }, [baseline, lines, orderItemByProductId, productById]);

  const previewTotal = resolved.reduce((sum, line) => sum + line.subtotal, 0);
  const hasChanges = !linesEqual(lines, baseline);
  const paid = isPaymentCollected(paymentMethod);
  const delta = previewTotal - originalTotal;

  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return [];
    }
    const inCart = new Set(lines.map((l) => l.productId));
    return products
      .filter(
        (p) =>
          p.available !== false &&
          p.active !== false &&
          !inCart.has(p.id) &&
          (p.name.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term)),
      )
      .slice(0, 8);
  }, [lines, products, query]);

  function startEditing() {
    setLines(linesFromOrderItems(originalItems));
    setQuery('');
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setLines(linesFromOrderItems(originalItems));
    setQuery('');
    setReason('');
    setError(null);
    setConfirmOpen(false);
    setEditing(false);
  }

  function setQty(productId: string, quantity: number) {
    setLines((current) => {
      if (quantity < 1) {
        return current.filter((line) => line.productId !== productId);
      }
      return current.map((line) => (line.productId === productId ? { ...line, quantity } : line));
    });
  }

  function addProduct(product: Product) {
    setLines((current) => {
      if (current.length >= 15) {
        setError('You can add up to 15 items in one order.');
        return current;
      }
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        if (existing.quantity >= 10) {
          setError('Each item quantity must be between 1 and 10.');
          return current;
        }
        return current.map((line) =>
          line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      setError(null);
      return [...current, { productId: product.id, quantity: 1 }];
    });
    setQuery('');
  }

  async function applyChanges() {
    setBusy(true);
    setError(null);
    const result = await replaceAdminOrderItems(
      orderId,
      lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      { reason, expectedRevision: revision, relaxedValidation: relaxProductValidation },
    );
    setBusy(false);
    if (result.error) {
      setError(result.error);
      if (result.conflict) {
        setConfirmOpen(false);
        setEditing(false);
        router.refresh();
      }
      return;
    }
    setConfirmOpen(false);
    setReason('');
    setRevision((value) => value + 1);
    setEditing(false);
    router.refresh();
  }

  async function applyRevert() {
    setBusy(true);
    setError(null);
    const result = await revertAdminOrderToPlaced(orderId, revision);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      if (result.conflict) {
        setRevertOpen(false);
        router.refresh();
      }
      return;
    }
    setRevertOpen(false);
    setRevision((value) => value + 1);
    router.refresh();
  }

  const panelClass = adminModifiedFromPlaced
    ? 'rounded-xl border border-amber-300 bg-amber-50/40 p-4 ring-1 ring-amber-100'
    : 'rounded-xl border border-stone-200 bg-white p-4';

  if (!editing) {
    return (
      <div className={panelClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Items</h2>
            {adminModifiedFromPlaced ? (
              <p className="mt-0.5 text-sm text-amber-900">
                Modified from original
                {typeof placedTotal === 'number' ? ` · Placed total ${formatPrice(placedTotal)}` : ''}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {canModify && canRevertToPlaced ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setRevertOpen(true)}
                className="min-h-10 rounded-lg border border-amber-400 bg-white px-4 text-sm font-semibold text-amber-950 shadow-sm hover:bg-amber-50 disabled:opacity-50"
              >
                Revert to original
              </button>
            ) : null}
            {canModify ? (
              <button
                type="button"
                onClick={startEditing}
                className="min-h-10 rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
              >
                Modify order
              </button>
            ) : null}
          </div>
        </div>
        {error ? (
          <p className="mb-3 text-sm font-medium text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <AdminOrderItemsTable
          items={originalItems}
          placedItems={placedItems}
          total={originalTotal}
          placedTotal={placedTotal}
          showDiff={adminModifiedFromPlaced}
        />
        {revertOpen ? (
          <ConfirmDialog
            title="Revert to original order?"
            body="This restores the lines and total from when the customer first placed the order."
            confirmLabel="Revert to original"
            busy={busy}
            onCancel={() => {
              if (!busy) {
                setRevertOpen(false);
              }
            }}
            onConfirm={() => void applyRevert()}
          >
            <div className="space-y-2 text-sm text-stone-700">
              <div className="flex justify-between">
                <span>Current total</span>
                <span>{formatPrice(originalTotal)}</span>
              </div>
              {typeof placedTotal === 'number' ? (
                <div className="flex justify-between font-semibold text-stone-900">
                  <span>Original total</span>
                  <span>{formatPrice(placedTotal)}</span>
                </div>
              ) : null}
            </div>
          </ConfirmDialog>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-white p-4 ring-1 ring-emerald-100">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Modify order</h2>
          <p className="mt-0.5 text-sm text-stone-600">
            Adjust lines below, then review. Current total {formatPrice(originalTotal)} · Preview{' '}
            {formatPrice(previewTotal)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={cancelEditing}
            className="min-h-10 rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!hasChanges || resolved.some((line) => !line.available) || busy}
            onClick={() => setConfirmOpen(true)}
            className="min-h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Review &amp; update
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="mt-4 space-y-2">
        {removedLines.map((line) => {
          const struck = 'text-stone-500 line-through decoration-stone-400 decoration-2';
          return (
            <li
              key={`removed-${line.productId}`}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-300 bg-stone-100/90 px-3 py-2 text-sm"
            >
              <span className={`min-w-0 flex-1 font-medium ${struck}`}>{line.name}</span>
              <span
                className={`rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-600 ${struck}`}
              >
                Removed
              </span>
              <span className={`min-w-[1.5rem] text-center font-semibold tabular-nums ${struck}`}>
                × {line.quantity}
              </span>
              <span className={`w-20 text-right font-semibold tabular-nums ${struck}`}>
                {formatPrice(line.subtotal)}
              </span>
              <button
                type="button"
                aria-label={`Restore ${line.name}`}
                onClick={() => setQty(line.productId, line.quantity)}
                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-stone-600 hover:bg-stone-200/80"
                title="Restore line"
              >
                <Plus size={16} />
              </button>
            </li>
          );
        })}
        {resolved.map((line) => (
          <li
            key={line.productId}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm"
          >
            <span className="min-w-0 flex-1 font-medium text-stone-900">{line.name}</span>
            {!line.available ? <span className="text-xs font-medium text-amber-700">Unavailable</span> : null}
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQty(line.productId, line.quantity - 1)}
                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-stone-300"
              >
                <Minus size={14} />
              </button>
              <span className="min-w-[1.5rem] text-center font-semibold">{line.quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQty(line.productId, Math.min(10, line.quantity + 1))}
                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-stone-300"
              >
                <Plus size={14} />
              </button>
            </div>
            <span className="w-20 text-right font-semibold tabular-nums">{formatPrice(line.subtotal)}</span>
            <button
              type="button"
              aria-label={`Remove ${line.name}`}
              onClick={() => setQty(line.productId, 0)}
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      <div className="relative mt-4">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products to add"
          className={`${searchClass} pl-9`}
        />
        {suggestions.length > 0 ? (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-stone-200 bg-white py-1 shadow-md">
            {suggestions.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => addProduct(product)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-stone-50"
                >
                  <span>{product.name}</span>
                  <span className="text-stone-500">{formatPrice(product.price)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {confirmOpen ? (
        <ConfirmDialog
          title="Update this order?"
          body="Prices and totals are calculated on the server when you confirm."
          confirmLabel="Update order"
          busy={busy}
          confirmDisabled={resolved.length === 0 || resolved.some((line) => !line.available)}
          onCancel={() => {
            if (!busy) {
              setConfirmOpen(false);
            }
          }}
          onConfirm={() => void applyChanges()}
        >
          <div className="space-y-3 text-sm text-stone-700">
            <div className="flex justify-between font-medium">
              <span>Current total</span>
              <span>{formatPrice(originalTotal)}</span>
            </div>
            <div className="flex justify-between font-semibold text-stone-900">
              <span>New total (preview)</span>
              <span>{formatPrice(previewTotal)}</span>
            </div>
            {paid && delta !== 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                {delta > 0
                  ? `Customer already paid ${formatPrice(originalTotal)}. New total ${formatPrice(previewTotal)} — collect ${formatPrice(delta)} manually. Payment status will not change automatically.`
                  : `Total reduced from ${formatPrice(originalTotal)} to ${formatPrice(previewTotal)}. Adjust or refund ${formatPrice(Math.abs(delta))} manually if needed.`}
              </p>
            ) : null}
            <label className="block">
              <span className="text-xs font-medium text-stone-500">Reason (optional, shown to customer)</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                placeholder="e.g. Customer requested extra item"
              />
            </label>
          </div>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
