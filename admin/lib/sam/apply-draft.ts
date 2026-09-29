import type { CatalogProduct, DraftLine, DraftViewLine } from '@/lib/sam/types';

export function viewDraft(catalog: CatalogProduct[], draft: DraftLine[]) {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const items: DraftViewLine[] = [];
  let total = 0;
  for (const line of draft) {
    const product = byId.get(line.productId);
    if (!product || line.quantity <= 0) {
      continue;
    }
    const unitPrice = Number(product.price);
    const lineTotal = unitPrice * line.quantity;
    total += lineTotal;
    items.push({
      productId: product.id,
      name: product.name,
      quantity: line.quantity,
      unitPrice,
      lineTotal,
    });
  }
  return { items, total };
}

export function addLine(draft: DraftLine[], productId: string, quantity: number): DraftLine[] {
  const next = draft.filter((line) => line.quantity > 0);
  const index = next.findIndex((line) => line.productId === productId);
  if (index < 0) {
    return [...next, { productId, quantity }];
  }
  return next.map((line, i) =>
    i === index ? { ...line, quantity: line.quantity + quantity } : line,
  );
}

export function setLine(draft: DraftLine[], productId: string, quantity: number): DraftLine[] {
  if (quantity <= 0) {
    return draft.filter((line) => line.productId !== productId);
  }
  const index = draft.findIndex((line) => line.productId === productId);
  if (index < 0) {
    return [...draft, { productId, quantity }];
  }
  return draft.map((line, i) => (i === index ? { ...line, quantity } : line));
}

export function summarize(items: DraftViewLine[]) {
  return items.map((item) => `${item.quantity} ${item.name}`).join(' and ');
}
