export function PageSkeleton({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3 text-stone-700">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-emerald-700" />
        <p className="text-base font-medium">{label}</p>
      </div>
      <div className="h-8 w-40 animate-pulse rounded-md bg-stone-200" />
      <div className="h-4 w-64 animate-pulse rounded-md bg-stone-200" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-24 animate-pulse rounded-xl bg-stone-200" />
        <div className="h-24 animate-pulse rounded-xl bg-stone-200" />
        <div className="h-24 animate-pulse rounded-xl bg-stone-200" />
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-stone-200" />
    </div>
  );
}
