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

function words(text: string): string[] {
  return text.split(/[^a-z0-9]+/).filter(Boolean);
}

function searchRank(product: Product, term: string): number {
  const name = product.name.toLowerCase();
  const description = (product.description ?? '').toLowerCase();
  if (name.startsWith(term)) {
    return 0;
  }
  if (words(name).some((word) => word.startsWith(term))) {
    return 1;
  }
  if (name.includes(term)) {
    return 2;
  }
  if (words(description).some((word) => word.startsWith(term))) {
    return 3;
  }
  if (description.includes(term)) {
    return 4;
  }
  return 5;
}

export function productMatchesSearch(product: Product, term: string): boolean {
  return searchRank(product, term) < 5;
}

export function sortProductsForSearch<T extends Product>(products: T[], term: string): T[] {
  const needle = term.trim().toLowerCase();
  if (!needle) {
    return sortProductsForDisplay(products);
  }
  return [...products].sort((a, b) => {
    const rank = searchRank(a, needle) - searchRank(b, needle);
    if (rank !== 0) {
      return rank;
    }
    return compareProductsForDisplay(a, b);
  });
}
