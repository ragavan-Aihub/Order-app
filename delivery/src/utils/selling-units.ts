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

export function formatOrderItemQty(item: {
  quantity: number;
  selling_type?: string | null;
  selling_unit?: string | null;
  pack_weight_grams?: number | null;
  weight_grams?: number | null;
}): string {
  const type = item.selling_type ?? '';
  if (type === 'kg' && item.weight_grams) {
    return gramsToKgLabel(item.weight_grams);
  }
  if (type === 'fixed_pack' && item.pack_weight_grams) {
    return `${item.quantity} × ${formatPackWeight(item.pack_weight_grams)}`;
  }
  if (type === 'quantity' && item.selling_unit?.trim()) {
    return `${item.quantity} ${item.selling_unit.trim()}`;
  }
  return String(item.quantity);
}
