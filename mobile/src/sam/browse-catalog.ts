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

export function stripShoppingWrapper(transcript: string) {
  let t = transcript
    .trim()
    .toLowerCase()
    .replace(/[?.!,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  t = t.replace(/^(hey\s+)?sam\s+/i, '');
  for (let i = 0; i < 4; i += 1) {
    const next = t
      .replace(/^(please|pls|plz|kindly)\s+/i, '')
      .replace(/^(can you|could you|would you|will you|can u)\s+/i, '')
      .replace(/^(i would like|i'd like|i wanna|i want|i need)\s+(to\s+)?/i, '')
      .replace(/^(get me|give me|send me)\s+/i, '');
    if (next === t) {
      break;
    }
    t = next;
  }
  return t.replace(/\s+(please|pls|plz)$/i, '').trim();
}

function stripAddVerb(t: string) {
  return t
    .replace(/^(to\s+)?(order|add|buy|get|want)\s+(me\s+)?(a|an|the|some\s+)?/i, '')
    .replace(/\b(venum|venu|pannunga|sertukonga|சேர்)\b/gi, ' ')
    .replace(/\s+(to (the )?cart|in (the )?cart|for me)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function looksLikeAddOrder(transcript: string) {
  const t = stripShoppingWrapper(transcript);
  if (isHowToOrder(transcript)) {
    return false;
  }
  if (/^(place (the )?order|confirm( the order)?|confirm order)$/.test(t)) {
    return false;
  }
  const raw = transcript.trim().toLowerCase();
  return (
    /^(order|add|buy|get|want)\b/.test(t) ||
    /\b(please|pls|plz|kindly)\s+(order|add|buy)\b/.test(raw) ||
    /\b(i want|i need|i'd like|i would like|get me|give me)\b/.test(raw) ||
    /\b(venum|venu|pannunga|sertukonga|சேர்)\b/.test(t)
  );
}

export function shoppingAddQuery(transcript: string) {
  if (!looksLikeAddOrder(transcript)) {
    return null;
  }
  const q = stripAddVerb(stripShoppingWrapper(transcript)).replace(/^(a|an|the|some)\s+/i, '');
  if (!q || /^(it|that|this|one)$/.test(q)) {
    return null;
  }
  return q;
}

function wantsFullCatalog(t: string) {
  return (
    /^(show|list|get|browse)\s+(me\s+)?(all\s+)?(the\s+)?(your\s+)?(products|items|catalog)$/.test(t) ||
    /^what\s+(are\s+)?(the\s+)?(products|items)(\s+do\s+you\s+have)?$/.test(t) ||
    /^what\s+(products|items)\s+do\s+you\s+have$/.test(t) ||
    /^what\s+do\s+you\s+(have|sell)$/.test(t) ||
    t.includes('what are the products') ||
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

export function isFullCatalogAsk(transcript: string) {
  return wantsFullCatalog(stripShoppingWrapper(transcript));
}

export function productsForSamQuery(transcript: string, catalog: Product[]): Product[] | null {
  const available = availableOnly(catalog);
  const t = stripShoppingWrapper(transcript);
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

  const addQuery = shoppingAddQuery(transcript);
  if (addQuery) {
    return available.filter((product) => matchesQuery(product, addQuery));
  }

  const leftover = stripAddVerb(t).replace(/^(a|an|the|some)\s+/i, '');
  const original = transcript
    .trim()
    .toLowerCase()
    .replace(/[?.!,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (
    leftover.length >= 3 &&
    leftover !== original &&
    !/^(show|list|browse|hello|hi)$/.test(leftover)
  ) {
    const hits = available.filter((product) => matchesQuery(product, leftover));
    if (hits.length) {
      return hits;
    }
  }

  return null;
}

export function isFillerUtterance(transcript: string) {
  const t = transcript.trim().toLowerCase().replace(/[?.!]+$/g, '');
  return /^(please|pls|thanks|thank you|ok|okay|hmm|uh|um|yes please)$/.test(t);
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
    if (showingAll) {
      return "I couldn't load the shop list yet. Open Home once, then say Show products again.";
    }
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
