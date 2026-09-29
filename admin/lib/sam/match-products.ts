import type { CatalogProduct, ParsedItem } from '@/lib/sam/types';

function norm(value: string) {
  return value
    .toLowerCase()
    .replace(/ஊறுகாய்|oorukai|urugai|pickle/g, 'pickle')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sizes(name: string) {
  return name.match(/\d+\s*(g|kg|ml|l)\b/gi) ?? [];
}

export type MatchResult =
  | { status: 'unique'; product: CatalogProduct }
  | { status: 'ambiguous'; products: CatalogProduct[] }
  | { status: 'unavailable'; product: CatalogProduct }
  | { status: 'missing' };

export function matchProduct(catalog: CatalogProduct[], query: string): MatchResult {
  const q = norm(query);
  if (!q) {
    return { status: 'missing' };
  }

  const scored = catalog
    .map((product) => {
      const n = norm(product.name);
      let score = 0;
      if (n === q) {
        score = 100;
      } else if (n.includes(q) || q.includes(n)) {
        score = 80;
      } else {
        const tokens = q.split(' ').filter((t) => t.length > 2);
        const hits = tokens.filter((t) => n.includes(t)).length;
        score = tokens.length ? (hits / tokens.length) * 60 : 0;
      }
      return { product, score, n };
    })
    .filter((row) => row.score >= 40)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { status: 'missing' };
  }

  const querySizes = sizes(query);
  let pool = scored.map((row) => row.product);
  if (querySizes.length) {
    const sized = pool.filter((p) =>
      querySizes.some((s) => norm(p.name).includes(norm(s))),
    );
    if (sized.length) {
      pool = sized;
    }
  }

  const top = scored[0].score;
  const close = scored.filter((row) => row.score >= top - 15).map((row) => row.product);
  const uniqueIds = new Set(pool.map((p) => p.id));
  const candidates = close.filter((p) => uniqueIds.has(p.id));
  const list = candidates.length ? candidates : pool;

  if (list.length > 1) {
    return { status: 'ambiguous', products: list };
  }

  const product = list[0];
  if (product.available === false) {
    return { status: 'unavailable', product };
  }
  return { status: 'unique', product };
}

export function formatSizeChoices(products: CatalogProduct[]) {
  const labels = products.map((p) => {
    const found = sizes(p.name);
    return found[0] ?? p.name;
  });
  return labels.join(', ').replace(/, ([^,]*)$/, ' or $1');
}
