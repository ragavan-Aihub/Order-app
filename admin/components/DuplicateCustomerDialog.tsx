'use client';

export function DuplicateCustomerDialog({
  name,
  mobile,
  orderCount,
  onLoad,
  onDismiss,
}: {
  name?: string | null;
  mobile?: string | null;
  orderCount?: number;
  onLoad: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
        <h2 className="text-lg font-semibold">Mobile number already exists</h2>
        <p className="mt-2 text-sm text-stone-600">
          {name || 'A customer'} is already saved with {mobile}. Load that customer instead of creating a new one.
        </p>
        {typeof orderCount === 'number' ? (
          <p className="mt-1 text-xs text-stone-500">{orderCount} orders</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onLoad}
            className="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white"
          >
            Load this customer
          </button>
          <button type="button" onClick={onDismiss} className="min-h-11 rounded-lg border border-stone-300 px-4 py-2">
            Use a different number
          </button>
        </div>
      </div>
    </div>
  );
}
