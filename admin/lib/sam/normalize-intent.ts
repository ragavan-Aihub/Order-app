import { stripQueryNoise } from '@/lib/sam/normalize-input';
import type { DetectedLlmLanguage, ParsedIntent, ParsedItem, SamIntent } from '@/lib/sam/types';

const INTENTS = new Set<SamIntent>([
  'ADD_ITEMS',
  'REMOVE_ITEM',
  'CHANGE_QUANTITY',
  'CLEAR_DRAFT',
  'CONFIRM',
  'CANCEL',
  'SHOW_PRODUCTS',
  'SEARCH_PRODUCTS',
  'PRODUCT_INFORMATION',
  'PRODUCT_AVAILABILITY',
  'PRODUCT_PRICE',
  'INGREDIENTS',
  'ORDER_STATUS',
  'ORDER_HISTORY',
  'HOW_TO_ORDER',
  'FARM2FLAVOURS_HELP',
  'GENERAL_HELP',
  'GREETING',
  'ABOUT_SAM',
  'SAM_CAPABILITIES',
  'IRRELEVANT',
  'UNKNOWN',
]);

const INTENT_ALIASES: Record<string, SamIntent> = {
  HOW_TO_ORDER: 'HOW_TO_ORDER',
  FARM2FLAVOURS_HELP: 'FARM2FLAVOURS_HELP',
  GENERAL_HELP: 'GENERAL_HELP',
  PRODUCT_INFO: 'PRODUCT_INFORMATION',
  AVAILABILITY: 'PRODUCT_AVAILABILITY',
  PRICE: 'PRODUCT_PRICE',
  SEARCH: 'SEARCH_PRODUCTS',
  SHOW: 'SHOW_PRODUCTS',
  HELLO: 'GREETING',
  WHO_ARE_YOU: 'ABOUT_SAM',
  CAPABILITIES: 'SAM_CAPABILITIES',
  OFF_TOPIC: 'IRRELEVANT',
};

const LANGUAGES = new Set<DetectedLlmLanguage>(['en', 'ta', 'tanglish']);

export function stripJsonFences(content: string) {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function mapLanguage(raw: unknown): DetectedLlmLanguage | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const value = raw.trim().toLowerCase();
  if (value === 'english' || value === 'en') {
    return 'en';
  }
  if (value === 'tamil' || value === 'ta') {
    return 'ta';
  }
  if (value === 'tanglish' || value === 'mix' || value === 'mixed') {
    return 'tanglish';
  }
  return LANGUAGES.has(value as DetectedLlmLanguage) ? (value as DetectedLlmLanguage) : undefined;
}

function mapIntent(raw: unknown): SamIntent {
  if (typeof raw !== 'string') {
    return 'UNKNOWN';
  }
  const key = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if (INTENTS.has(key as SamIntent)) {
    return key as SamIntent;
  }
  return INTENT_ALIASES[key] ?? 'UNKNOWN';
}

function itemName(record: Record<string, unknown>) {
  const query = typeof record.product_query === 'string' ? record.product_query : '';
  const name = typeof record.product_name === 'string' ? record.product_name : '';
  return stripQueryNoise(query || name);
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
    const name = itemName(record);
    const qty = Number(record.quantity);
    if (!name) {
      continue;
    }
    items.push({
      product_name: name,
      quantity: Number.isFinite(qty) && qty >= 1 ? Math.min(10, Math.floor(qty)) : 1,
    });
  }
  return items;
}

export function normalizeParsedIntent(raw: unknown): ParsedIntent {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const intent = mapIntent(obj.intent);
  let items = asItems(obj.items);
  const targetRaw =
    typeof obj.target_product === 'string'
      ? obj.target_product
      : typeof obj.search_query === 'string'
        ? obj.search_query
        : '';
  const target = stripQueryNoise(targetRaw) || null;
  if (
    items.length === 0 &&
    target &&
    (intent === 'INGREDIENTS' ||
      intent === 'PRODUCT_INFORMATION' ||
      intent === 'PRODUCT_AVAILABILITY' ||
      intent === 'PRODUCT_PRICE' ||
      intent === 'SEARCH_PRODUCTS' ||
      intent === 'REMOVE_ITEM' ||
      intent === 'CHANGE_QUANTITY')
  ) {
    items = [{ product_name: target, quantity: 1 }];
  }
  const search_query =
    typeof obj.search_query === 'string' && obj.search_query.trim()
      ? stripQueryNoise(obj.search_query)
      : intent === 'SEARCH_PRODUCTS'
        ? target
        : null;
  return {
    intent,
    items,
    detected_language: mapLanguage(obj.language) ?? mapLanguage(obj.detected_language),
    target_product: target,
    search_query,
    user_query_summary:
      typeof obj.user_query_summary === 'string' && obj.user_query_summary.trim()
        ? obj.user_query_summary.trim()
        : undefined,
    requires_clarification: obj.requires_clarification === true,
    clarification_question:
      typeof obj.clarification_question === 'string' ? obj.clarification_question : null,
  };
}
