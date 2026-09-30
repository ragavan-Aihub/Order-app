import type { DetectedLlmLanguage, ParsedIntent, ParsedItem, SamIntent } from '@/lib/sam/types';

const INTENTS = new Set<SamIntent>([
  'ADD_ITEMS',
  'REMOVE_ITEM',
  'CHANGE_QUANTITY',
  'CLEAR_DRAFT',
  'CONFIRM',
  'CANCEL',
  'PRODUCT_INFORMATION',
  'INGREDIENTS',
  'ORDER_STATUS',
  'GENERAL_HELP',
  'UNKNOWN',
]);

const LANGUAGES = new Set<DetectedLlmLanguage>(['en', 'ta', 'tanglish']);

export function stripJsonFences(content: string) {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function asItems(raw: unknown): ParsedItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const items: ParsedItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const record = row as Record<string, unknown>;
    const name = typeof record.product_name === 'string' ? record.product_name.trim() : '';
    const qty = Number(record.quantity);
    if (!name) {
      continue;
    }
    items.push({ product_name: name, quantity: Number.isFinite(qty) && qty >= 1 ? Math.floor(qty) : 1 });
  }
  return items;
}

export function normalizeParsedIntent(raw: unknown): ParsedIntent {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const intentRaw = typeof obj.intent === 'string' ? obj.intent : 'UNKNOWN';
  const intent = INTENTS.has(intentRaw as SamIntent) ? (intentRaw as SamIntent) : 'UNKNOWN';
  let items = asItems(obj.items);
  const target =
    typeof obj.target_product === 'string' && obj.target_product.trim()
      ? obj.target_product.trim()
      : null;
  if (
    items.length === 0 &&
    target &&
    (intent === 'INGREDIENTS' || intent === 'PRODUCT_INFORMATION')
  ) {
    items = [{ product_name: target, quantity: 1 }];
  }
  const langRaw = typeof obj.detected_language === 'string' ? obj.detected_language.toLowerCase() : '';
  const detected_language = LANGUAGES.has(langRaw as DetectedLlmLanguage)
    ? (langRaw as DetectedLlmLanguage)
    : undefined;
  const user_query_summary =
    typeof obj.user_query_summary === 'string' && obj.user_query_summary.trim()
      ? obj.user_query_summary.trim()
      : undefined;
  return {
    intent,
    items,
    detected_language,
    target_product: target,
    user_query_summary,
  };
}
