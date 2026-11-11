export function gramsToKgLabel(grams: number): string {
  const kg = grams / 1000;
  if (Number.isInteger(kg)) {
    return `${kg} Kg`;
  }
  const text = kg.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
  return `${text} Kg`;
}

export function formatWeight(grams: number): string {
  return grams >= 1000 ? gramsToKgLabel(grams) : `${grams}g`;
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

export function formatLiterLine(volumeMl: number, quantity: number): string {
  return quantity > 1 ? `${quantity} × ${formatVolume(volumeMl)}` : formatVolume(volumeMl);
}

export function formatPackWeight(grams: number): string {
  if (grams >= 1000 && grams % 1000 === 0) {
    return `${grams / 1000} Kg`;
  }
  return `${grams}g`;
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
