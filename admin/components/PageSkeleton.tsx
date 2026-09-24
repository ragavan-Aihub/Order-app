export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
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
