import type { ReactNode } from 'react';

export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white [-webkit-overflow-scrolling:touch]">
      {children}
    </div>
  );
}
