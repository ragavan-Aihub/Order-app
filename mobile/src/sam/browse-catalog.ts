import type { Product } from '@/types/product';

function availableOnly(catalog: Product[]) {
  return catalog.filter((product) => product.available !== false);
}

export function matchesQuery(product: Product, query: string) {
  const term = query.trim().toLowerCase();
  if (!term) {
    return true;
  }
  const stem = term.replace(/s$/, '');
  const name = product.name.toLowerCase();
  const description = (product.description ?? '').toLowerCase();
  const hay = `${name} ${description}`;
  return hay.includes(term) || (stem.length > 2 && hay.includes(stem));
}

function stripQueryFiller(q: string) {
  return q
    .replace(/^(any|some|the|all|your|something)\s+/i, '')
    .replace(/\s+(products?|items?)$/i, '')
    .trim();
}

function wantsFullCatalog(t: string) {
  return (
    /^(show|list|get|browse)\s+(me\s+)?(all\s+)?(the\s+)?(your\s+)?(products|items|catalog)$/.test(t) ||
    /^what\s+(products|items)(\s+do\s+you\s+have)?$/.test(t) ||
    /^what\s+do\s+you\s+(have|sell)$/.test(t) ||
    t === 'show products' ||
    t === 'browse products' ||
    t.includes('show products') ||
    t.includes('show me all products') ||
    t === 'all products' ||
    ((t.includes('product') || t.includes('பொருள்')) &&
      (t.includes('என்ன') || t.includes('irukku') || t.includes('iruku') || t.includes('irukka')) &&
      !/\b(homemade|home\s*made|pickle|podi|spice)\b/.test(t))
  );
}

export function productsForSamQuery(transcript: string, catalog: Product[]): Product[] | null {
  const available = availableOnly(catalog);
  const t = transcript.trim().toLowerCase().replace(/[?.!]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!t) {
    return null;
  }

  if (wantsFullCatalog(t)) {
    return available;
  }

  const whatKind = t.match(/^what(?:\s+kind\s+of)?\s+(.+)\s+(products?|items?)(?:\s+do\s+you\s+have)?$/);
  if (whatKind) {
    const q = stripQueryFiller(whatKind[1]);
    if (q) {
      return available.filter((product) => matchesQuery(product, q));
    }
  }

  const showKind = t.match(/^(show|list)\s+(me\s+)?(the\s+)?(your\s+)?(.+)\s+(products?|items?)$/);
  if (showKind) {
    const q = stripQueryFiller(showKind[5]);
    if (!q || q === 'all' || q === 'everything') {
      return available;
    }
    return available.filter((product) => matchesQuery(product, q));
  }

  const show = t.match(/^(show(\s+me)?|do\s+you\s+have|have\s+you\s+got|any)\s+(.+)$/);
  if (show) {
    const q = stripQueryFiller(show[3]);
    if (!q || q === 'products' || q === 'items' || q === 'everything') {
      return available;
    }
    return available.filter((product) => matchesQuery(product, q));
  }

  const namedList = t.match(/^(.+?)\s+(products?|items?)$/);
  if (namedList) {
    const q = stripQueryFiller(namedList[1]);
    if (q && q !== 'all' && q !== 'the' && q !== 'some' && q !== 'what') {
      return available.filter((product) => matchesQuery(product, q));
    }
  }

  return null;
}

export function isHowToOrder(transcript: string) {
  const t = transcript.trim().toLowerCase().replace(/[?.!]+$/g, '');
  return (
    t === 'how do i order' ||
    t === 'how to order' ||
    t === 'how do i order?' ||
    t === 'how to place an order' ||
    /how (do i|can i|to) (order|place (an )?order)/.test(t)
  );
}

export function isAddThatOne(transcript: string) {
  const t = transcript.trim().toLowerCase().replace(/[?.!]+$/g, '');
  return /^(add|get)\s+(that|this|it)(\s+one)?$/.test(t) || t === 'add that' || t === 'that one';
}

export const ORDER_HELP_REPLY =
  'Type a product name, tap Add, or say “add” plus the item. When you’re ready, tap Checkout.';

export function browseReply(matched: Product[], showingAll: boolean) {
  if (matched.length === 0) {
    return "I couldn't find that right now. Try another name, or say Show products.";
  }
  if (showingAll) {
    return "Sure! Here's what we have.";
  }
  if (matched.length === 1) {
    return `Yes, we have ${matched[0].name}.`;
  }
  return 'Here are matching products.';
}

export function browseListMode(matched: Product[], showingAll: boolean): 'single' | 'catalog' | undefined {
  if (matched.length === 0) {
    return undefined;
  }
  if (showingAll) {
    return 'catalog';
  }
  return 'single';
}

export function filterCatalog(catalog: Product[], query: string) {
  const available = availableOnly(catalog);
  const term = query.trim();
  if (!term) {
    return available;
  }
  return available.filter((product) => matchesQuery(product, term));
}
