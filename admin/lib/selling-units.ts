export type SellingType = 'kg' | 'liter' | 'fixed_pack' | 'quantity';

export type PackOption = {
  id: string;
  product_id: string;
  weight_grams: number;
  selling_price: number;
  is_active: boolean;
  display_order: number;
};

export type WeightOption = {
  id: string;
  product_id: string;
  weight_grams: number;
  is_active: boolean;
  display_order: number;
};

export const WEIGHT_PRESETS_GRAMS = [250, 500, 1000, 2000] as const;

export type VolumeOption = {
  id: string;
  product_id: string;
  volume_ml: number;
  is_active: boolean;
  display_order: number;
};

export const VOLUME_PRESETS_ML = [250, 500, 1000, 2000] as const;

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
  return `${kg.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')} Kg`.replace(/(\.\d)0 Kg$/, '$1 Kg');
}

export function formatPackWeight(grams: number): string {
  if (grams >= 1000 && grams % 1000 === 0) {
    return `${grams / 1000} Kg`;
  }
  return `${grams}g`;
}

export function formatWeight(grams: number): string {
  if (grams >= 1000) {
    return gramsToKgLabel(grams);
  }
  return `${grams}g`;
}

/** Price of `quantity` units of one weight option (price_per_kg x weight). */
export function weightOptionPrice(pricePerKg: number, weightGrams: number, quantity = 1): number {
  return roundMoney(pricePerKg * (weightGrams / 1000) * quantity);
}

/** "500g" for one unit, "2 × 500g" for several. Legacy typed-weight lines (qty 1) show their total. */
export function formatKgLine(weightGrams: number, quantity: number): string {
  return quantity > 1 ? `${quantity} × ${formatWeight(weightGrams)}` : formatWeight(weightGrams);
}

export function formatVolume(ml: number): string {
  if (ml >= 1000 && ml % 1000 === 0) {
    return `${ml / 1000} L`;
  }
  if (ml >= 1000) {
    const liters = ml / 1000;
    const text = liters.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
    return `${text} L`;
  }
  return `${ml}ml`;
}

export function volumeOptionPrice(pricePerLiter: number, volumeMl: number, quantity = 1): number {
  return roundMoney(pricePerLiter * (volumeMl / 1000) * quantity);
}

export function formatLiterLine(volumeMl: number, quantity: number): string {
  return quantity > 1 ? `${quantity} × ${formatVolume(volumeMl)}` : formatVolume(volumeMl);
}

export function catalogPriceLabel(product: {
  selling_type?: string | null;
  price: number;
  price_per_kg?: number | null;
  price_per_liter?: number | null;
  selling_unit?: string | null;
  packs?: PackOption[] | null;
}): string {
  const type = product.selling_type ?? 'quantity';
  const inr = (n: number) =>
    Number.isInteger(n) ? `₹${n}` : `₹${roundMoney(n).toFixed(2)}`;
  if (type === 'kg') {
    return `${inr(product.price_per_kg ?? product.price)} / Kg`;
  }
  if (type === 'liter') {
    return `${inr(product.price_per_liter ?? product.price)} / L`;
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
  return inr(product.price);
}

export function formatOrderItemUnit(item: {
  product_name: string;
  quantity: number;
  selling_type?: string | null;
  selling_unit?: string | null;
  pack_weight_grams?: number | null;
  weight_grams?: number | null;
  volume_ml?: number | null;
}): string {
  const type = item.selling_type ?? '';
  if (type === 'kg' && item.weight_grams) {
    return `${item.product_name} – ${formatKgLine(item.weight_grams, item.quantity)}`;
  }
  if (type === 'liter' && item.volume_ml) {
    return `${item.product_name} – ${formatLiterLine(item.volume_ml, item.quantity)}`;
  }
  if (type === 'fixed_pack' && item.pack_weight_grams) {
    return `${item.product_name} – ${item.quantity} × ${formatPackWeight(item.pack_weight_grams)}`;
  }
  return `${item.product_name} × ${item.quantity}`;
}

export function formatOrderItemQty(item: {
  quantity: number;
  selling_type?: string | null;
  selling_unit?: string | null;
  pack_weight_grams?: number | null;
  weight_grams?: number | null;
  volume_ml?: number | null;
}): string {
  const type = item.selling_type ?? '';
  if (type === 'kg' && item.weight_grams) {
    return formatKgLine(item.weight_grams, item.quantity);
  }
  if (type === 'liter' && item.volume_ml) {
    return formatLiterLine(item.volume_ml, item.quantity);
  }
  if (type === 'fixed_pack' && item.pack_weight_grams) {
    return `${item.quantity} × ${formatPackWeight(item.pack_weight_grams)}`;
  }
  return String(item.quantity);
}
