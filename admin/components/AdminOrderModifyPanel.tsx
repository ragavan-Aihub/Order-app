'use client';

import { ChevronDown, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AdminOrderItemsTable } from '@/components/AdminOrderItemsTable';
import { AdminQtyStepper } from '@/components/AdminQtyStepper';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { VariantOptionCard, VariantOptionRow } from '@/components/VariantOptionCard';
import {
  ADMIN_PIECE_QTY_MAX,
  ADMIN_WEIGHT_QTY_MAX,
  formatLineMultiplier,
  formatOrderItemPackLabel,
  formatPackWeight,
  formatVolume,
  formatWeight,
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

type Line = {
  rowId: string;
  productId: string;
  quantity: number;
  weightGrams?: number;
  volumeMl?: number;
  packOptionId?: string;
};

function newRowId() {
  return crypto.randomUUID();
}

function lineMissingSize(line: {
  sellingType?: string | null;
  weightOptions: { id: string }[];
  volumeOptions: { id: string }[];
  packOptions: { id: string }[];
  weightGrams?: number;
  volumeMl?: number;
  packOptionId?: string;
}): boolean {
  if (line.sellingType === 'kg' && line.weightOptions.length > 1 && line.weightGrams == null) {
    return true;
  }
  if (line.sellingType === 'liter' && line.volumeOptions.length > 1 && line.volumeMl == null) {
    return true;
  }
  if (line.sellingType === 'fixed_pack' && line.packOptions.length > 1 && !line.packOptionId) {
    return true;
  }
  return false;
}

const searchClass =
  'min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100';

function linesFromOrderItems(items: OrderItem[]): Line[] {
  return items
    .filter((item) => item.product_id)
    .map((item) => ({
      rowId: item.id || newRowId(),
      productId: item.product_id as string,
      quantity: item.quantity,
      weightGrams: item.weight_grams ?? undefined,
      volumeMl: item.volume_ml ?? undefined,
      packOptionId: item.pack_option_id ?? undefined,
    }));
}

function linesEqual(a: Line[], b: Line[]) {
  if (a.length !== b.length) {
    return false;
  }
  const sortKey = (lines: Line[]) =>
    [...lines]
      .sort((x, y) => x.productId.localeCompare(y.productId) || x.rowId.localeCompare(y.rowId))
      .map(
        (l) =>
          `${l.productId}:${l.quantity}:${l.weightGrams ?? ''}:${l.volumeMl ?? ''}:${l.packOptionId ?? ''}`,
      );
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
  const canInvoice = status === 'confirmed' || status === 'out_for_delivery';
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
  const [variantRowId, setVariantRowId] = useState<string | null>(null);

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
        const placed = originalItems.find((item) => item.id === line.rowId);
        const grams = line.weightGrams ?? placed?.weight_grams ?? null;
        const ml = line.volumeMl ?? placed?.volume_ml ?? null;
        const packs = (product?.packs ?? []).filter((option) => option.is_active);
        const pack =
          packs.find((option) => option.id === line.packOptionId) ??
          packs.find((option) => option.id === placed?.pack_option_id) ??
          packs.find((option) => option.weight_grams === placed?.pack_weight_grams) ??
          null;
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
          grams,
          ml,
          packId: pack?.id ?? line.packOptionId ?? null,
          weightOptions: (product?.weightOptions ?? []).filter((option) => option.is_active),
          volumeOptions: (product?.volumeOptions ?? []).filter((option) => option.is_active),
          packOptions: packs,
          perKg,
          perL,
        };
      })
      .filter(Boolean) as Array<
      Line & {
        name: string;
        unit: number;
        subtotal: number;
        available: boolean;
        sellingType?: string | null;
        grams: number | null;
        ml: number | null;
        packId: string | null;
        weightOptions: NonNullable<Product['weightOptions']>;
        volumeOptions: NonNullable<Product['volumeOptions']>;
        packOptions: NonNullable<Product['packs']>;
        perKg: number;
        perL: number;
      }
    >;
  }, [lines, originalItems, orderItemByProductId, productById, relaxProductValidation]);

  const removedLines = useMemo(() => {
    const active = new Set(lines.map((line) => line.rowId));
    return baseline
      .filter((line) => !active.has(line.rowId))
      .map((line) => {
        const onOrder = originalItems.find((item) => item.id === line.rowId) ?? orderItemByProductId.get(line.productId);
        const product = productById.get(line.productId);
        const name = product?.name ?? onOrder?.product_name ?? 'Item';
        const unit = product?.price ?? Number(onOrder?.product_price ?? 0);
        return {
          ...line,
          name,
          unit,
          subtotal: unit * line.quantity,
        };
      });
  }, [baseline, lines, orderItemByProductId, originalItems, productById]);

  const pendingSize = resolved.find(lineMissingSize) ?? null;
  const previewTotal = resolved.reduce((sum, line) => sum + line.subtotal, 0);
  const hasChanges = !linesEqual(lines, baseline);
  const paid = isPaymentCollected(paymentMethod);
  const delta = previewTotal - originalTotal;

  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return [];
    }
    return products
      .filter(
        (p) =>
          p.available !== false &&
          p.active !== false &&
          p.name.toLowerCase().includes(term),
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

  function orderedQtyOf(line: Line): number | null {
    const live = originalItems.find(
      (item) =>
        item.id === line.rowId ||
        (item.product_id === line.productId &&
          (item.weight_grams ?? undefined) === line.weightGrams &&
          (item.volume_ml ?? undefined) === line.volumeMl &&
          (item.pack_option_id ?? undefined) === line.packOptionId),
    );
    if (live) {
      return live.quantity;
    }
    const placed = placedItems.find((item) => item.product_id === line.productId);
    return placed?.quantity ?? null;
  }

  function setQty(rowId: string, quantity: number, productId?: string) {
    const id = productId ?? lines.find((line) => line.rowId === rowId)?.productId;
    const sellingType = id ? sellingTypeOf(id) : undefined;
    const weight = isWeightSellingType(sellingType);
    const max = weight ? ADMIN_WEIGHT_QTY_MAX : ADMIN_PIECE_QTY_MAX;
    const minKeep = weight ? 0.01 : 1;
    const next = Math.min(max, Math.max(minKeep, weight ? roundQty2(quantity) : Math.floor(quantity)));
    if (pendingSize) {
      setError(`Choose a size for ${pendingSize.name} before changing quantity.`);
      setVariantRowId(pendingSize.rowId);
      return;
    }
    setLines((current) =>
      current.map((line) => (line.rowId === rowId ? { ...line, quantity: next } : line)),
    );
    setVariantRowId((open) => (open && open !== rowId ? null : open));
  }

  function restoreLine(line: Line) {
    setLines((current) => (current.some((item) => item.rowId === line.rowId) ? current : [...current, line]));
  }

  function removeLine(rowId: string) {
    setLines((current) => current.filter((line) => line.rowId !== rowId));
  }

  function patchLine(rowId: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.rowId === rowId ? { ...line, ...patch } : line)));
    setVariantRowId(null);
  }

  function addProduct(product: Product) {
    if (pendingSize) {
      setError(`Choose a size for ${pendingSize.name} before adding another item.`);
      setVariantRowId(pendingSize.rowId);
      setQuery('');
      return;
    }
    if (lines.length >= 15) {
      setError('You can add up to 15 items in one order.');
      return;
    }
    const rowId = newRowId();
    const weights = (product.weightOptions ?? []).filter((option) => option.is_active);
    const volumes = (product.volumeOptions ?? []).filter((option) => option.is_active);
    const packs = (product.packs ?? []).filter((pack) => pack.is_active);
    const needsPick =
      (product.selling_type === 'kg' && weights.length > 1) ||
      (product.selling_type === 'liter' && volumes.length > 1) ||
      (product.selling_type === 'fixed_pack' && packs.length > 1);
    setError(null);
    setLines((current) => [
      ...current,
      {
        rowId,
        productId: product.id,
        quantity: 1,
        weightGrams: product.selling_type === 'kg' && weights.length === 1 ? weights[0].weight_grams : undefined,
        volumeMl: product.selling_type === 'liter' && volumes.length === 1 ? volumes[0].volume_ml : undefined,
        packOptionId: product.selling_type === 'fixed_pack' && packs.length === 1 ? packs[0].id : undefined,
      },
    ]);
    setVariantRowId(needsPick ? rowId : null);
    setQuery('');
  }

  async function applyChanges() {
    if (!canInvoice) {
      setError('Confirm the order before preparing the invoice.');
      return;
    }
    const invalid = lines.find((line) => !isValidAdminQty(line.quantity, sellingTypeOf(line.productId)));
    if (invalid) {
      setError('Check item quantities. Kg and liter can use up to 2 decimal places.');
      return;
    }
    if (pendingSize) {
      setError(`Choose a size for ${pendingSize.name}.`);
      setVariantRowId(pendingSize.rowId);
      return;
    }
    setBusy(true);
    setError(null);
    const result = hasChanges
      ? await replaceAdminOrderItems(
          orderId,
          lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            weightGrams: line.weightGrams ?? null,
            volumeMl: line.volumeMl ?? null,
            packOptionId: line.packOptionId ?? null,
          })),
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

  if (!editing || !canInvoice) {
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
            {canInvoice && canRevertToPlaced ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setRevertOpen(true)}
                className="min-h-10 rounded-lg border border-amber-400 bg-white px-4 text-sm font-semibold text-amber-950 shadow-sm hover:bg-amber-50 disabled:opacity-50"
              >
                Reset to original order
              </button>
            ) : null}
            {canInvoice ? (
              <button
                type="button"
                onClick={startEditing}
                className="min-h-10 rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
              >
                {invoiceActionLabel}
              </button>
            ) : status === 'new' ? (
              <p className="text-sm font-medium text-amber-900">Confirm the order before preparing the invoice.</p>
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
              key={`removed-${line.rowId}`}
              className="grid grid-cols-1 items-center gap-2 rounded-lg border border-stone-300 bg-stone-100/90 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_6.5rem_9.5rem_5.5rem_2.5rem]"
            >
              <span className={`min-w-0 font-medium ${struck}`}>
                {line.name}
                {packLabel ? <span className="mt-0.5 block text-xs font-normal">{packLabel}</span> : null}
                <span className="mt-0.5 block text-xs font-normal sm:hidden">
                  Ordered qty {formatLineMultiplier(orderedQtyOf(line) ?? line.quantity)}
                </span>
              </span>
              <span className={`hidden text-center font-semibold tabular-nums sm:block ${struck}`}>
                {formatLineMultiplier(orderedQtyOf(line) ?? line.quantity)}
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
                onClick={() => restoreLine(line)}
                className="inline-flex min-h-9 min-w-9 items-center justify-center justify-self-end rounded-md text-stone-600 hover:bg-stone-200/80 sm:justify-self-center"
                title="Restore line"
              >
                <Plus size={16} />
              </button>
            </li>
          );
        })}
        {resolved.map((line) => {
          const orderedQty = orderedQtyOf(line);
          const packLabel = formatOrderItemPackLabel({
            selling_type: line.sellingType,
            pack_weight_grams: line.packOptions.find((pack) => pack.id === line.packId)?.weight_grams,
            weight_grams: line.grams,
            volume_ml: line.ml,
          });
          const showWeights = line.sellingType === 'kg' && line.weightOptions.length > 1;
          const showVolumes = line.sellingType === 'liter' && line.volumeOptions.length > 1;
          const showPacks = line.sellingType === 'fixed_pack' && line.packOptions.length > 1;
          const canChangeVariant = showWeights || showVolumes || showPacks;
          const sizePending = lineMissingSize(line);
          const variantOpen = (pendingSize?.rowId ?? variantRowId) === line.rowId;
          const selectedPackGrams = line.packOptions.find((pack) => pack.id === line.packId)?.weight_grams;
          const selectedLabel = showWeights
            ? line.grams != null
              ? formatWeight(line.grams)
              : null
            : showVolumes
              ? line.ml != null
                ? formatVolume(line.ml)
                : null
              : showPacks
                ? selectedPackGrams != null
                  ? formatPackWeight(selectedPackGrams)
                  : packLabel
                : packLabel;
          return (
            <li
              key={line.rowId}
              className="grid grid-cols-1 items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_6.5rem_9.5rem_5.5rem_2.5rem]"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 truncate font-medium text-stone-900">{line.name}</p>
                  {canChangeVariant ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (pendingSize && pendingSize.rowId !== line.rowId) {
                          setError(`Choose a size for ${pendingSize.name} first.`);
                          setVariantRowId(pendingSize.rowId);
                          return;
                        }
                        if (variantOpen && sizePending) {
                          return;
                        }
                        setVariantRowId(variantOpen ? null : line.rowId);
                      }}
                      aria-expanded={variantOpen}
                      aria-label={selectedLabel ? `Change size, ${selectedLabel}` : `Choose size for ${line.name}`}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded-full"
                    >
                      {selectedLabel ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-white">
                          {selectedLabel}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-dashed border-stone-300 px-2 py-0.5 text-xs font-medium text-stone-500">
                          Choose size
                        </span>
                      )}
                      <ChevronDown
                        size={14}
                        className={`text-stone-400 transition ${variantOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  ) : packLabel ? (
                    <p className="shrink-0 text-xs font-normal text-stone-500">{packLabel}</p>
                  ) : null}
                </div>
                {variantOpen && showWeights ? (
                  <div className="mt-1.5">
                    <VariantOptionRow>
                      {line.weightOptions.map((option) => (
                        <VariantOptionCard
                          key={option.id}
                          label={formatWeight(option.weight_grams)}
                          price={formatPrice(weightOptionPrice(line.perKg, option.weight_grams))}
                          on={line.grams === option.weight_grams}
                          onClick={() => patchLine(line.rowId, { weightGrams: option.weight_grams })}
                        />
                      ))}
                    </VariantOptionRow>
                  </div>
                ) : null}
                {variantOpen && showVolumes ? (
                  <div className="mt-1.5">
                    <VariantOptionRow>
                      {line.volumeOptions.map((option) => (
                        <VariantOptionCard
                          key={option.id}
                          label={formatVolume(option.volume_ml)}
                          price={formatPrice(volumeOptionPrice(line.perL, option.volume_ml))}
                          on={line.ml === option.volume_ml}
                          onClick={() => patchLine(line.rowId, { volumeMl: option.volume_ml })}
                        />
                      ))}
                    </VariantOptionRow>
                  </div>
                ) : null}
                {variantOpen && showPacks ? (
                  <div className="mt-1.5">
                    <VariantOptionRow>
                      {line.packOptions.map((pack) => (
                        <VariantOptionCard
                          key={pack.id}
                          label={formatPackWeight(pack.weight_grams)}
                          price={formatPrice(pack.selling_price)}
                          on={line.packId === pack.id}
                          onClick={() => patchLine(line.rowId, { packOptionId: pack.id })}
                        />
                      ))}
                    </VariantOptionRow>
                  </div>
                ) : null}
                {!line.available ? (
                  <p className="mt-0.5 text-xs font-medium text-amber-700">Unavailable</p>
                ) : (
                  <p className="mt-0.5 text-xs font-normal text-stone-500 sm:hidden">
                    Ordered qty {orderedQty == null ? '—' : formatLineMultiplier(orderedQty)}
                  </p>
                )}
              </div>
              <span className="hidden text-center font-semibold tabular-nums text-stone-700 sm:block">
                {orderedQty == null ? '—' : formatLineMultiplier(orderedQty)}
              </span>
              <div className={`flex justify-center ${pendingSize ? 'pointer-events-none opacity-40' : ''}`}>
                <AdminQtyStepper
                  quantity={line.quantity}
                  sellingType={line.sellingType}
                  productName={line.name}
                  onChange={(quantity) => setQty(line.rowId, quantity, line.productId)}
                />
              </div>
              <span className="text-right font-semibold tabular-nums">{formatPrice(line.subtotal)}</span>
              <button
                type="button"
                aria-label={`Remove ${line.name}`}
                onClick={() => removeLine(line.rowId)}
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
          placeholder={
            pendingSize ? `Choose a size for ${pendingSize.name} first` : 'Search products to add'
          }
          disabled={Boolean(pendingSize)}
          className={`${searchClass} pl-9 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400`}
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
