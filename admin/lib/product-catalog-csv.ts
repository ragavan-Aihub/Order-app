import { formatPackWeight, formatVolume, WEIGHT_PRESETS_GRAMS, VOLUME_PRESETS_ML } from '@/lib/selling-units';
import { stockToInputValue } from '@/lib/stock';
import type { Product } from '@/types/product';

export const PRODUCT_CSV_HEADERS = [
  'name',
  'description',
  'ingredients',
  'selling_type',
  'price',
  'packs',
  'weights',
  'volumes',
  'stock_qty',
  'available',
  'active',
  'category',
  'image_path',
] as const;

export function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  return `\uFEFF${[headers, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(',')).join('\n')}\n`;
}

export function parseSellingType(raw: string): 'quantity' | 'kg' | 'liter' | 'fixed_pack' {
  const value = raw.trim().toLowerCase();
  if (value === 'kg' || value === 'kgs' || value === 'kilogram') {
    return 'kg';
  }
  if (value === 'liter' || value === 'litre' || value === 'l' || value === 'ltr') {
    return 'liter';
  }
  if (value === 'fixed_pack' || value === 'pack' || value === 'packs') {
    return 'fixed_pack';
  }
  return 'quantity';
}

function parseGramsToken(token: string): number | null {
  const trimmed = token.trim().toLowerCase().replace(/\s+/g, '');
  if (!trimmed) {
    return null;
  }
  if (/^\d+kg$/.test(trimmed)) {
    return Number(trimmed.replace('kg', '')) * 1000;
  }
  if (/^\d+(\.\d+)?kg$/.test(trimmed)) {
    return Math.round(Number(trimmed.replace('kg', '')) * 1000);
  }
  const grams = trimmed.replace(/g$/, '');
  if (!/^\d+$/.test(grams)) {
    return null;
  }
  const value = Number(grams);
  return Number.isInteger(value) && value >= 1 && value <= 100_000 ? value : null;
}

function parseMlToken(token: string): number | null {
  const trimmed = token.trim().toLowerCase().replace(/\s+/g, '');
  if (!trimmed) {
    return null;
  }
  if (/^\d+(\.\d+)?l$/.test(trimmed)) {
    return Math.round(Number(trimmed.replace('l', '')) * 1000);
  }
  const ml = trimmed.replace(/ml$/, '');
  if (!/^\d+$/.test(ml)) {
    return null;
  }
  const value = Number(ml);
  return Number.isInteger(value) && value >= 1 && value <= 100_000 ? value : null;
}

export function parseWeightList(raw: string): number[] | { error: string } {
  if (!raw.trim()) {
    return [];
  }
  const values: number[] = [];
  for (const part of raw.split(/[;|,]/)) {
    const grams = parseGramsToken(part);
    if (grams == null) {
      return { error: 'Weights must look like 250;500;1kg.' };
    }
    values.push(grams);
  }
  if (new Set(values).size !== values.length) {
    return { error: 'Each weight option must be unique.' };
  }
  return values;
}

export function parseVolumeList(raw: string): number[] | { error: string } {
  if (!raw.trim()) {
    return [];
  }
  const values: number[] = [];
  for (const part of raw.split(/[;|,]/)) {
    const ml = parseMlToken(part);
    if (ml == null) {
      return { error: 'Volumes must look like 250;500;1L.' };
    }
    values.push(ml);
  }
  if (new Set(values).size !== values.length) {
    return { error: 'Each volume option must be unique.' };
  }
  return values;
}

export function parsePackList(raw: string): Array<{ weight_grams: number; selling_price: number }> | { error: string } {
  if (!raw.trim()) {
    return [];
  }
  const packs: Array<{ weight_grams: number; selling_price: number }> = [];
  for (const part of raw.split(/[;|,]/)) {
    const chunk = part.trim();
    if (!chunk) {
      continue;
    }
    const match = chunk.match(/^(.+?)\s*[=:]\s*(.+)$/);
    if (!match) {
      return { error: 'Packs must look like 100g=80;300g=220.' };
    }
    const weight_grams = parseGramsToken(match[1]);
    const selling_price = Number(match[2].trim());
    if (weight_grams == null) {
      return { error: 'Each pack needs a weight like 100g or 1kg.' };
    }
    if (!Number.isFinite(selling_price) || selling_price < 0) {
      return { error: 'Each pack needs a selling price of 0 or more.' };
    }
    packs.push({ weight_grams, selling_price: Math.round(selling_price * 100) / 100 });
  }
  if (new Set(packs.map((pack) => pack.weight_grams)).size !== packs.length) {
    return { error: 'Each pack weight must be unique.' };
  }
  return packs;
}

export function formatWeightList(grams: number[]): string {
  return grams.map((value) => (value % 1000 === 0 ? `${value / 1000}kg` : `${value}g`)).join(';');
}

export function formatVolumeList(ml: number[]): string {
  return ml.map((value) => formatVolume(value).replace(/\s/g, '')).join(';');
}

export function formatPackList(packs: Array<{ weight_grams: number; selling_price: number }>): string {
  return packs.map((pack) => `${formatPackWeight(pack.weight_grams).replace(/\s/g, '')}=${pack.selling_price}`).join(';');
}

export function yesNo(value: boolean | undefined): string {
  return value === false ? 'No' : 'Yes';
}

export function productCatalogRow(product: Product, categoriesEnabled: boolean): string[] {
  const type = product.selling_type ?? 'quantity';
  const price =
    type === 'kg'
      ? String(product.price_per_kg ?? product.price ?? '')
      : type === 'liter'
        ? String(product.price_per_liter ?? product.price ?? '')
        : type === 'fixed_pack'
          ? ''
          : String(product.price ?? '');
  const packs = (product.packs ?? []).filter((pack) => pack.is_active);
  const weights = (product.weightOptions ?? []).filter((row) => row.is_active).map((row) => row.weight_grams);
  const volumes = (product.volumeOptions ?? []).filter((row) => row.is_active).map((row) => row.volume_ml);
  return [
    product.name,
    product.description ?? '',
    product.ingredients ?? '',
    type,
    price,
    type === 'fixed_pack' ? formatPackList(packs) : '',
    type === 'kg' ? formatWeightList(weights) : '',
    type === 'liter' ? formatVolumeList(volumes) : '',
    stockToInputValue(product.stock_qty, type),
    yesNo(product.available),
    yesNo(product.active),
    categoriesEnabled ? (product.category_name ?? '') : '',
    '',
  ];
}

export function buildProductTemplateCsv(categoriesEnabled: boolean, categoryNames: string[]): string {
  const sampleCategory = categoriesEnabled ? categoryNames[0] ?? 'Pickles' : '';
  const rows: string[][] = [
    [
      'Mango pickle',
      'Homemade pickle from farm mangoes',
      'Mango, oil, chilli',
      'quantity',
      '250',
      '',
      '',
      '',
      '20',
      'Yes',
      'Yes',
      sampleCategory,
      '/Users/YOUR_NAME/Desktop/products/mango.jpg',
    ],
    [
      'Besan flour',
      'Freshly milled gram flour',
      '',
      'kg',
      '90',
      '',
      formatWeightList([...WEIGHT_PRESETS_GRAMS]),
      '',
      '10',
      'Yes',
      'Yes',
      sampleCategory,
      '/Users/YOUR_NAME/Desktop/products/besan.jpg',
    ],
    [
      'Grated coconut',
      'Fresh grated coconut packs',
      '',
      'fixed_pack',
      '',
      '100g=80;300g=220',
      '',
      '',
      '40',
      'Yes',
      'Yes',
      sampleCategory,
      '/Users/YOUR_NAME/Desktop/products/coconut.jpg',
    ],
    [
      'Cold pressed oil',
      'Groundnut oil',
      '',
      'liter',
      '280',
      '',
      '',
      formatVolumeList([...VOLUME_PRESETS_ML]),
      '15',
      'Yes',
      'Yes',
      sampleCategory,
      '/Users/YOUR_NAME/Desktop/products/oil.jpg',
    ],
  ];
  const headers = categoriesEnabled
    ? [...PRODUCT_CSV_HEADERS]
    : PRODUCT_CSV_HEADERS.filter((header) => header !== 'category');
  const data = categoriesEnabled ? rows : rows.map((row) => row.filter((_, index) => index !== 11));
  return toCsv(headers, data);
}

export function buildProductExportCsv(products: Product[], categoriesEnabled: boolean): string {
  const headers = categoriesEnabled
    ? [...PRODUCT_CSV_HEADERS]
    : PRODUCT_CSV_HEADERS.filter((header) => header !== 'category');
  const rows = products.map((product) => {
    const row = productCatalogRow(product, categoriesEnabled);
    return categoriesEnabled ? row : row.filter((_, index) => index !== 11);
  });
  return toCsv(headers, rows);
}
