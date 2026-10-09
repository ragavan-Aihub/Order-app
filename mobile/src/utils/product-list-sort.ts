import type { Product } from '@/types/product';

/** Available products A–Z first; coming soon (available === false) at the end, also A–Z. */
export function compareProductsForDisplay(a: Product, b: Product): number {
  const soonA = a.available === false ? 1 : 0;
  const soonB = b.available === false ? 1 : 0;
  if (soonA !== soonB) {
    return soonA - soonB;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

export function sortProductsForDisplay<T extends Product>(products: T[]): T[] {
  return [...products].sort(compareProductsForDisplay);
}
