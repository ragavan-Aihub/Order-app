export type SellingType = 'kg' | 'liter' | 'fixed_pack' | 'quantity';

export type WeightOption = {
  id: string;
  product_id: string;
  weight_grams: number;
  is_active: boolean;
  display_order: number;
};

export type VolumeOption = {
  id: string;
  product_id: string;
  volume_ml: number;
  is_active: boolean;
  display_order: number;
};

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

export function sellingTypeOf(product: { selling_type?: string | null }): SellingType {
  if (product.selling_type === 'kg' || product.selling_type === 'liter' || product.selling_type === 'fixed_pack') {
    return product.selling_type;
  }
  return 'quantity';
}

export function formatWeight(grams: number): string {
  return grams >= 1000 ? gramsToKgLabel(grams) : `${grams}g`;
}

/** Price of `quantity` units of one weight option (price per Kg x weight). */
export function weightOptionPrice(pricePerKg: number, weightGrams: number, quantity = 1): number {
  return roundMoney(pricePerKg * (weightGrams / 1000) * quantity);
}

/** "500g" for one unit, "2 × 500g" for several. */
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

function inrLabel(n: number): string {
  return Number.isInteger(n) ? `₹${n}` : `₹${roundMoney(n).toFixed(2)}`;
}

export function catalogPriceAmountLabel(product: {
  selling_type?: string | null;
  price: number;
  price_per_kg?: number | null;
  price_per_liter?: number | null;
  packs?: PackOption[] | null;
}): string {
  const type = sellingTypeOf(product);
  if (type === 'kg') {
    return inrLabel(product.price_per_kg ?? product.price);
  }
  if (type === 'liter') {
    return inrLabel(product.price_per_liter ?? product.price);
  }
  if (type === 'fixed_pack') {
    const active = (product.packs ?? []).filter((pack) => pack.is_active);
    if (active.length === 0) {
      return inrLabel(product.price);
    }
    const lowest = Math.min(...active.map((pack) => pack.selling_price));
    return active.length > 1 ? `From ${inrLabel(lowest)}` : inrLabel(lowest);
  }
  return inrLabel(product.price);
}

export function catalogUnitLabel(product: {
  selling_type?: string | null;
  selling_unit?: string | null;
  packs?: PackOption[] | null;
}): string | null {
  const type = sellingTypeOf(product);
  if (type === 'kg') {
    return 'per Kg';
  }
  if (type === 'liter') {
    return 'per L';
  }
  if (type === 'fixed_pack') {
    const active = (product.packs ?? []).filter((pack) => pack.is_active);
    if (active.length === 1) {
      return formatPackWeight(active[0].weight_grams);
    }
    if (active.length > 1) {
      return 'multiple sizes';
    }
  }
  const unit = product.selling_unit?.trim();
  return unit ? unit : null;
}

export function catalogPriceLabel(product: {
  selling_type?: string | null;
  price: number;
  price_per_kg?: number | null;
  price_per_liter?: number | null;
  selling_unit?: string | null;
  packs?: PackOption[] | null;
}): string {
  const type = sellingTypeOf(product);
  const amount = catalogPriceAmountLabel(product);
  if (type === 'kg') {
    return `${amount} / Kg`;
  }
  if (type === 'liter') {
    return `${amount} / L`;
  }
  if (type === 'fixed_pack') {
    const unit = catalogUnitLabel(product);
    if (unit && unit !== 'multiple sizes' && !amount.startsWith('From ')) {
      return `${amount} / ${unit}`;
    }
  }
  return amount;
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

export function cartLineKey(item: {
  product: { id: string; selling_type?: string | null };
  packOptionId?: string | null;
  weightGrams?: number | null;
  volumeMl?: number | null;
}): string {
  if (sellingTypeOf(item.product) === 'kg' && item.weightGrams) {
    return `${item.product.id}:w${item.weightGrams}`;
  }
  if (sellingTypeOf(item.product) === 'liter' && item.volumeMl) {
    return `${item.product.id}:v${item.volumeMl}`;
  }
  return item.packOptionId ? `${item.product.id}:${item.packOptionId}` : item.product.id;
}

export function cartLineTotal(item: {
  product: {
    selling_type?: string | null;
    price: number;
    price_per_kg?: number | null;
    price_per_liter?: number | null;
    packs?: PackOption[] | null;
  };
  quantity: number;
  weightGrams?: number | null;
  volumeMl?: number | null;
  packOptionId?: string | null;
}): number {
  const type = sellingTypeOf(item.product);
  if (type === 'kg') {
    const perKg = item.product.price_per_kg ?? item.product.price;
    return weightOptionPrice(perKg, item.weightGrams ?? 0, item.quantity);
  }
  if (type === 'liter') {
    const perL = item.product.price_per_liter ?? item.product.price;
    return volumeOptionPrice(perL, item.volumeMl ?? 0, item.quantity);
  }
  if (type === 'fixed_pack') {
    const pack = (item.product.packs ?? []).find((row) => row.id === item.packOptionId);
    const unit = pack?.selling_price ?? item.product.price;
    return roundMoney(unit * item.quantity);
  }
  return roundMoney(item.product.price * item.quantity);
}
