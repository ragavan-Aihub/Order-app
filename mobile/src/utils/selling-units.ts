export type SellingType = 'kg' | 'fixed_pack' | 'quantity';

export type PackOption = {
  id: string;
  product_id: string;
  weight_grams: number;
  selling_price: number;
  is_active: boolean;
  display_order: number;
};

export function roundMoney(amount: number): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

export function kgToGrams(kg: number): number {
  return Math.round(kg * 1000);
}

export function gramsToKgLabel(grams: number): string {
  const kg = grams / 1000;
  if (Number.isInteger(kg)) {
    return `${kg} Kg`;
  }
  const text = kg.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
  return `${text} Kg`;
}

export function formatPackWeight(grams: number): string {
  if (grams >= 1000 && grams % 1000 === 0) {
    return `${grams / 1000} Kg`;
  }
  return `${grams}g`;
}

export function parseKgInput(raw: string): { grams: number } | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: 'Enter a weight.' };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { error: 'Use a positive weight with up to two decimal places.' };
  }
  const kg = Number(trimmed);
  if (!Number.isFinite(kg) || kg <= 0) {
    return { error: 'Enter a weight greater than 0 Kg.' };
  }
  return { grams: kgToGrams(kg) };
}

export function sellingTypeOf(product: { selling_type?: string | null }): SellingType {
  if (product.selling_type === 'kg' || product.selling_type === 'fixed_pack') {
    return product.selling_type;
  }
  return 'quantity';
}

export function catalogPriceLabel(product: {
  selling_type?: string | null;
  price: number;
  price_per_kg?: number | null;
  selling_unit?: string | null;
  packs?: PackOption[] | null;
}): string {
  const type = sellingTypeOf(product);
  const inr = (n: number) => (Number.isInteger(n) ? `₹${n}` : `₹${roundMoney(n).toFixed(2)}`);
  if (type === 'kg') {
    return `${inr(product.price_per_kg ?? product.price)} / Kg`;
  }
  if (type === 'fixed_pack') {
    const active = (product.packs ?? []).filter((pack) => pack.is_active);
    if (active.length === 0) {
      return inr(product.price);
    }
    const lowest = Math.min(...active.map((pack) => pack.selling_price));
    return active.length === 1
      ? `${inr(lowest)} / ${formatPackWeight(active[0].weight_grams)}`
      : `From ${inr(lowest)}`;
  }
  const unit = product.selling_unit?.trim();
  return unit ? `${inr(product.price)} / ${unit}` : inr(product.price);
}

export function formatOrderItemUnit(item: {
  product_name: string;
  quantity: number;
  selling_type?: string | null;
  selling_unit?: string | null;
  pack_weight_grams?: number | null;
  weight_grams?: number | null;
}): string {
  const type = item.selling_type ?? '';
  if (type === 'kg' && item.weight_grams) {
    return `${item.product_name} – ${gramsToKgLabel(item.weight_grams)}`;
  }
  if (type === 'fixed_pack' && item.pack_weight_grams) {
    return `${item.product_name} – ${item.quantity} × ${formatPackWeight(item.pack_weight_grams)}`;
  }
  if (type === 'quantity') {
    const unit = item.selling_unit?.trim();
    if (unit) {
      const plural = item.quantity === 1 ? unit : `${unit}${/s$/i.test(unit) ? '' : 's'}`;
      return `${item.product_name} – ${item.quantity} ${plural}`;
    }
  }
  return `${item.product_name} × ${item.quantity}`;
}

export function cartLineKey(item: {
  product: { id: string };
  packOptionId?: string | null;
}): string {
  return item.packOptionId ? `${item.product.id}:${item.packOptionId}` : item.product.id;
}

export function cartLineTotal(item: {
  product: {
    selling_type?: string | null;
    price: number;
    price_per_kg?: number | null;
    packs?: PackOption[] | null;
  };
  quantity: number;
  weightGrams?: number | null;
  packOptionId?: string | null;
}): number {
  const type = sellingTypeOf(item.product);
  if (type === 'kg') {
    const perKg = item.product.price_per_kg ?? item.product.price;
    return roundMoney(perKg * ((item.weightGrams ?? 0) / 1000));
  }
  if (type === 'fixed_pack') {
    const pack = (item.product.packs ?? []).find((row) => row.id === item.packOptionId);
    const unit = pack?.selling_price ?? item.product.price;
    return roundMoney(unit * item.quantity);
  }
  return roundMoney(item.product.price * item.quantity);
}
