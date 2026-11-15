'use client';

import { Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AdminOrderItemsTable } from '@/components/AdminOrderItemsTable';
import { AdminQtyStepper } from '@/components/AdminQtyStepper';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  ADMIN_PIECE_QTY_MAX,
  ADMIN_WEIGHT_QTY_MAX,
  formatLineMultiplier,
  formatOrderItemPackLabel,
  isValidAdminQty,
  isWeightSellingType,
  roundQty2,
  volumeOptionPrice,
  weightOptionPrice,
} from '@/lib/selling-units';
import { markAdminInvoicePrepared, replaceAdminOrderItems, revertAdminOrderToPlaced } from '@/services/order-actions';
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
  customerModifiedAfterConfirm = false,
  canRevertToPlaced = false,
  placedTotal,
  placedItems = [],
  shopDiffBaselineItems = [],
  adminCompareItems = [],
  customerDiffBaselineItems = [],
  confirmBaselineTotal,
  revertTargetTotal,
  relaxProductValidation = false,
  invoicePrepared = false,
}: {
  orderId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  originalTotal: number;
  originalItems: OrderItem[];
  itemsRevision: number;
  products: Product[];
  adminModifiedFromPlaced?: boolean;
  customerModifiedAfterConfirm?: boolean;
  canRevertToPlaced?: boolean;
  placedTotal?: number;
  placedItems?: OrderModificationItemSnapshot[];
  shopDiffBaselineItems?: OrderModificationItemSnapshot[];
  adminCompareItems?: OrderModificationItemSnapshot[];
  customerDiffBaselineItems?: OrderModificationItemSnapshot[];
  confirmBaselineTotal?: number;
  revertTargetTotal?: number;
  relaxProductValidation?: boolean;
  invoicePrepared?: boolean;
}) {
  const router = useRouter();
  const canModify = status === 'new' || status === 'confirmed' || status === 'out_for_delivery';
  const invoiceActionLabel = invoicePrepared || adminModifiedFromPlaced ? 'Update invoice' : 'Prepare invoice';
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
        const name = product?.name ?? onOrder?.product_name ?? 'Item';
        const sellingType = product?.selling_type ?? onOrder?.selling_type;
        const catalogAvailable = product ? product.available !== false && product.active !== false : false;
        const available = relaxProductValidation ? Boolean(product ?? onOrder) : catalogAvailable;
        const grams =
          onOrder?.weight_grams ??
          product?.weightOptions?.find((option) => option.is_active)?.weight_grams ??
          null;
        const ml =
          onOrder?.volume_ml ??
          product?.volumeOptions?.find((option) => option.is_active)?.volume_ml ??
          null;
        const packs = (product?.packs ?? []).filter((option) => option.is_active);
        const pack =
          packs.find((option) => option.id === onOrder?.pack_option_id) ??
          packs.find((option) => option.weight_grams === onOrder?.pack_weight_grams) ??
          packs[0];
        const perKg = Number(product?.price_per_kg ?? onOrder?.product_price ?? product?.price ?? 0);
        const perL = Number(product?.price_per_liter ?? onOrder?.product_price ?? product?.price ?? 0);
        const unit =
          sellingType === 'kg'
            ? perKg
            : sellingType === 'liter'
              ? perL
              : Number(pack?.selling_price ?? onOrder?.product_price ?? product?.price ?? 0);
        const subtotal =
          sellingType === 'kg' && grams
            ? weightOptionPrice(perKg, grams, line.quantity)
            : sellingType === 'liter' && ml
              ? volumeOptionPrice(perL, ml, line.quantity)
              : unit * line.quantity;
        return {
          ...line,
          name,
          unit,
          sellingType,
          subtotal,
          available,
        };
      })
      .filter(Boolean) as Array<
      Line & { name: string; unit: number; subtotal: number; available: boolean; sellingType?: string | null }
    >;
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

  function sellingTypeOf(productId: string) {
    return productById.get(productId)?.selling_type ?? orderItemByProductId.get(productId)?.selling_type;
  }

  function orderedQtyOf(productId: string): number | null {
    const placed = placedItems.find((line) => line.product_id === productId);
    if (placed) {
      return placed.quantity;
    }
    const live = originalItems.find((item) => item.product_id === productId);
    return live?.quantity ?? null;
  }

  function setQty(productId: string, quantity: number) {
    const sellingType = sellingTypeOf(productId);
    const weight = isWeightSellingType(sellingType);
    const max = weight ? ADMIN_WEIGHT_QTY_MAX : ADMIN_PIECE_QTY_MAX;
    const minKeep = weight ? 0.01 : 1;
    const next = Math.min(max, Math.max(minKeep, weight ? roundQty2(quantity) : Math.floor(quantity)));
    setLines((current) => {
      if (current.some((line) => line.productId === productId)) {
        return current.map((line) => (line.productId === productId ? { ...line, quantity: next } : line));
      }
      return [...current, { productId, quantity: next }];
    });
  }

  function removeLine(productId: string) {
    setLines((current) => current.filter((line) => line.productId !== productId));
  }

  function addProduct(product: Product) {
    setLines((current) => {
      if (current.length >= 15) {
        setError('You can add up to 15 items in one order.');
        return current;
      }
      const existing = current.find((line) => line.productId === product.id);
      const weight = isWeightSellingType(product.selling_type);
      const max = weight ? ADMIN_WEIGHT_QTY_MAX : ADMIN_PIECE_QTY_MAX;
      const step = 1;
      if (existing) {
        if (existing.quantity >= max) {
          setError(
            weight
              ? 'Kg and liter quantity can be up to 100, with 2 decimal places.'
              : 'Each item quantity must be between 1 and 10.',
          );
          return current;
        }
        return current.map((line) =>
          line.productId === product.id ? { ...line, quantity: roundQty2(line.quantity + step) } : line,
        );
      }
      setError(null);
      return [...current, { productId: product.id, quantity: 1 }];
    });
    setQuery('');
  }

  async function applyChanges() {
    const invalid = lines.find((line) => !isValidAdminQty(line.quantity, sellingTypeOf(line.productId)));
    if (invalid) {
      setError('Check item quantities. Kg and liter can use up to 2 decimal places.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = hasChanges
      ? await replaceAdminOrderItems(
          orderId,
          lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
          { reason, expectedRevision: revision, relaxedValidation: relaxProductValidation },
        )
      : await markAdminInvoicePrepared(orderId, revision);
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
    : customerModifiedAfterConfirm
      ? 'rounded-xl border border-sky-300 bg-sky-50/40 p-4 ring-1 ring-sky-100'
      : 'rounded-xl border border-stone-200 bg-white p-4';

  if (!editing) {
    return (
      <div className={panelClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Invoice</h2>
            <p className="mt-0.5 text-sm text-stone-600">
              Ordered lines stay on record. Invoice qty is what you bill and deliver.
            </p>
            {adminModifiedFromPlaced ? (
              <p className="mt-0.5 text-sm text-amber-900">
                Invoice differs from the original order
                {typeof placedTotal === 'number' ? ` · Ordered total ${formatPrice(placedTotal)}` : ''}
              </p>
            ) : null}
            {!adminModifiedFromPlaced && customerModifiedAfterConfirm ? (
              <p className="mt-0.5 text-sm text-sky-900">
                Customer changed this order after you confirmed it
                {typeof confirmBaselineTotal === 'number'
                  ? ` · At confirm ${formatPrice(confirmBaselineTotal)}`
                  : ''}
              </p>
            ) : null}
            {adminModifiedFromPlaced && customerModifiedAfterConfirm ? (
              <p className="mt-0.5 text-sm text-sky-900">Customer also changed lines after confirm — see below.</p>
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
                Reset to original order
              </button>
            ) : null}
            {canModify ? (
              <button
                type="button"
                onClick={startEditing}
                className="min-h-10 rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
              >
                {invoiceActionLabel}
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
          shopDiffBaselineItems={shopDiffBaselineItems}
          adminCompareItems={adminCompareItems}
          customerDiffBaselineItems={customerDiffBaselineItems}
          total={originalTotal}
          placedTotal={placedTotal}
          confirmBaselineTotal={confirmBaselineTotal}
          showDiff={adminModifiedFromPlaced}
          showCustomerDiff={customerModifiedAfterConfirm}
        />
        {revertOpen ? (
          <ConfirmDialog
            title="Reset to original order?"
            body="Restores invoice lines to the original order (including any customer edits from before the shop invoice). The original order stays on record."
            confirmLabel="Reset to original order"
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
              {typeof revertTargetTotal === 'number' ? (
                <div className="flex justify-between font-semibold text-stone-900">
                  <span>After undo (preview)</span>
                  <span>{formatPrice(revertTargetTotal)}</span>
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
          <h2 className="text-base font-semibold text-stone-900">{invoiceActionLabel}</h2>
          <p className="mt-0.5 text-sm text-stone-600">
            Change invoice qty, add or remove lines. Original order stays on record. Invoice total{' '}
            {formatPrice(originalTotal)} · Preview {formatPrice(previewTotal)}
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
            disabled={
              (!hasChanges && invoicePrepared) || resolved.some((line) => !line.available) || busy
            }
            onClick={() => setConfirmOpen(true)}
            className="min-h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Review invoice
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 hidden grid-cols-[minmax(0,1fr)_6.5rem_9.5rem_5.5rem_2.5rem] gap-x-2 px-3 text-xs font-medium uppercase tracking-wide text-stone-500 sm:grid">
        <span>Item</span>
        <span className="text-center">Ordered qty</span>
        <span className="text-center">Invoiced qty</span>
        <span className="text-right">Amount</span>
        <span />
      </div>
      <ul className="mt-1 space-y-2">
        {removedLines.map((line) => {
          const struck = 'text-stone-500 line-through decoration-stone-400 decoration-2';
          const packLabel = formatOrderItemPackLabel(orderItemByProductId.get(line.productId) ?? {});
          return (
            <li
              key={`removed-${line.productId}`}
              className="grid grid-cols-1 items-center gap-2 rounded-lg border border-stone-300 bg-stone-100/90 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_6.5rem_9.5rem_5.5rem_2.5rem]"
            >
              <span className={`min-w-0 font-medium ${struck}`}>
                {line.name}
                {packLabel ? <span className="mt-0.5 block text-xs font-normal">{packLabel}</span> : null}
                <span className="mt-0.5 block text-xs font-normal sm:hidden">
                  Ordered qty {formatLineMultiplier(orderedQtyOf(line.productId) ?? line.quantity)}
                </span>
              </span>
              <span className={`hidden text-center font-semibold tabular-nums sm:block ${struck}`}>
                {formatLineMultiplier(orderedQtyOf(line.productId) ?? line.quantity)}
              </span>
              <span className={`text-center text-xs font-bold uppercase tracking-wide text-stone-600 ${struck}`}>
                Removed
              </span>
              <span className={`text-right font-semibold tabular-nums ${struck}`}>
                {formatPrice(line.subtotal)}
              </span>
              <button
                type="button"
                aria-label={`Restore ${line.name}`}
                onClick={() => setQty(line.productId, line.quantity)}
                className="inline-flex min-h-9 min-w-9 items-center justify-center justify-self-end rounded-md text-stone-600 hover:bg-stone-200/80 sm:justify-self-center"
                title="Restore line"
              >
                <Plus size={16} />
              </button>
            </li>
          );
        })}
        {resolved.map((line) => {
          const orderedQty = orderedQtyOf(line.productId);
          const packLabel = formatOrderItemPackLabel(orderItemByProductId.get(line.productId) ?? {});
          return (
            <li
              key={line.productId}
              className="grid grid-cols-1 items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_6.5rem_9.5rem_5.5rem_2.5rem]"
            >
              <span className="min-w-0 font-medium text-stone-900">
                {line.name}
                {packLabel ? (
                  <span className="mt-0.5 block text-xs font-normal text-stone-500">{packLabel}</span>
                ) : null}
                {!line.available ? (
                  <span className="mt-0.5 block text-xs font-medium text-amber-700">Unavailable</span>
                ) : (
                  <span className="mt-0.5 block text-xs font-normal text-stone-500 sm:hidden">
                    Ordered qty {orderedQty == null ? '—' : formatLineMultiplier(orderedQty)}
                  </span>
                )}
              </span>
              <span className="hidden text-center font-semibold tabular-nums text-stone-700 sm:block">
                {orderedQty == null ? '—' : formatLineMultiplier(orderedQty)}
              </span>
              <div className="flex justify-center">
                <AdminQtyStepper
                  quantity={line.quantity}
                  sellingType={line.sellingType}
                  productName={line.name}
                  onChange={(quantity) => setQty(line.productId, quantity)}
                />
              </div>
              <span className="text-right font-semibold tabular-nums">{formatPrice(line.subtotal)}</span>
              <button
                type="button"
                aria-label={`Remove ${line.name}`}
                onClick={() => removeLine(line.productId)}
                className="inline-flex min-h-9 min-w-9 items-center justify-center justify-self-end rounded-md text-stone-500 hover:bg-stone-100 sm:justify-self-center"
              >
                <Trash2 size={16} />
              </button>
            </li>
          );
        })}
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
          title="Save invoice?"
          body={
            hasChanges
              ? 'Billed quantities and totals are saved on this order. The original order stays in the change history so you and the customer can see the difference.'
              : 'Quantities match the order. Saving marks this invoice as prepared so the order can go out for delivery.'
          }
          confirmLabel="Save invoice"
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
              <span>Invoice total (preview)</span>
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
