import { transcriptToLlmLanguage } from '@/lib/sam/language';
import { normalizeTranscript, stripQueryNoise } from '@/lib/sam/normalize-input';
import type { ParsedIntent, ParsedItem } from '@/lib/sam/types';

const QTY_WORDS: Array<{ re: RegExp; n: number }> = [
  { re: /\b(one|a|an|oru|onnu|ondru|ஒரு|ஒன்று)\b/i, n: 1 },
  { re: /\b(two|rendu|இரண்டு|ரெண்டு)\b/i, n: 2 },
  { re: /\b(three|moonu|moonnu|moonru|மூன்று)\b/i, n: 3 },
  { re: /\b(four|naalu|நாலு|நான்கு)\b/i, n: 4 },
  { re: /\b(five|anju|ஐந்து)\b/i, n: 5 },
  { re: /\b(six|aaru|ஆறு)\b/i, n: 6 },
  { re: /\b(seven|ezhu|ஏழு)\b/i, n: 7 },
  { re: /\b(eight|ettu|எட்டு)\b/i, n: 8 },
  { re: /\b(nine|onbadhu|ஒன்பது)\b/i, n: 9 },
  { re: /\b(ten|pathu|பத்து)\b/i, n: 10 },
];

function parseQty(segment: string): { qty: number; rest: string } {
  const digits = segment.match(/\b(\d+)\b/);
  if (digits) {
    return { qty: Math.max(1, Math.min(10, Number(digits[1]))), rest: segment.replace(digits[0], ' ') };
  }
  for (const row of QTY_WORDS) {
    if (row.re.test(segment)) {
      return { qty: row.n, rest: segment.replace(row.re, ' ') };
    }
  }
  return { qty: 1, rest: segment };
}

function cleanName(raw: string) {
  return stripQueryNoise(
    raw.replace(
      /\b(add|order|buy|get|want|need|remove|delete|change|make|quantity|qty|pannunga|pannu|venum|venu|vendaam|vendam|sertukonga|sērkkavum|serkkavum|சேர்க்கவும்|வேண்டாம்)\b/gi,
      ' ',
    ),
  );
}

function splitItems(text: string) {
  return text
    .split(/\band\b|,| plus | மற்றும் /i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function finish(transcript: string, intent: ParsedIntent['intent'], items: ParsedItem[], extra?: Partial<ParsedIntent>): ParsedIntent {
  return {
    intent,
    items,
    detected_language: transcriptToLlmLanguage(transcript),
    target_product: items[0]?.product_name ?? extra?.target_product ?? null,
    search_query: extra?.search_query ?? null,
    ...extra,
  };
}

function extractItems(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  for (const part of splitItems(text)) {
    const { qty, rest } = parseQty(part);
    const name = cleanName(rest);
    if (name) {
      items.push({ product_name: name, quantity: qty });
    }
  }
  return items;
}

function isQuestion(t: string) {
  return /^(what|whats|what's|who|how|where|when|why|is |are |do |does |enna |epdi |evlo )/i.test(t) || /\?/.test(t);
}

export function fallbackParse(transcript: string): ParsedIntent {
  const t = transcript.trim();
  const lower = t.toLowerCase();
  const wrapped = normalizeTranscript(t);

  if (/\b(cancel|clear|stop|வேண்டாம்|vendaam|vendam|நிறுத்து)\b/i.test(t) && /\b(order|draft|cart|எல்லாம்)\b/i.test(t)) {
    return finish(t, 'CLEAR_DRAFT', []);
  }
  if (
    /^(cancel|clear)$/i.test(wrapped) ||
    wrapped === 'cancel pannunga' ||
    /^(vendaam|vendam|வேண்டாம்)$/i.test(wrapped)
  ) {
    return finish(t, 'CANCEL', []);
  }

  if (/^(hi|hello|hey|hey sam|vanakkam|வணக்கம்|namaste)(\s+sam)?$/i.test(wrapped)) {
    return finish(t, 'GREETING', []);
  }
  if (/\b(who are you|who is sam|about (you|sam)|neenga yaar|நீங்கள் யார்)\b/i.test(lower)) {
    return finish(t, 'ABOUT_SAM', []);
  }
  if (/\b(what can you do|your (skills|capabilities)|enna pannuve|என்ன பண்ணுவே)\b/i.test(lower)) {
    return finish(t, 'SAM_CAPABILITIES', []);
  }
  if (
    /\b(capital of|tell me a joke|weather|poem|cricket score|who won|president of)\b/i.test(lower) ||
    /^(joke|story|song)$/i.test(wrapped)
  ) {
    return finish(t, 'IRRELEVANT', []);
  }

  if (/\b(ingredient|ingredients|what.*(in|contain)|enna irukku|சேர்மான|பொருள்)\b/i.test(t) && !/\bproducts?\b/i.test(t)) {
    const name = cleanName(
      t.replace(/\b(what|are|the|ingredients|in|of|for|tell me about|contains?|enna|irukku|சேர்மானங்கள்|என்ன)\b/gi, ' '),
    );
    return finish(t, 'INGREDIENTS', name ? [{ product_name: name, quantity: 1 }] : []);
  }

  if (/\b(how much|price|cost|evlo|விலை)\b/i.test(t)) {
    const name = cleanName(t.replace(/\b(how much|is|the|price|cost|of|for|evlo|விலை)\b/gi, ' '));
    return finish(t, 'PRODUCT_PRICE', name ? [{ product_name: name, quantity: 1 }] : []);
  }

  if (/\b(available|in stock|கிடைக்குமா|irukka)\b/i.test(t)) {
    const name = cleanName(t.replace(/\b(is|are|available|in stock|கிடைக்குமா|irukka)\b/gi, ' '));
    return finish(t, 'PRODUCT_AVAILABILITY', name ? [{ product_name: name, quantity: 1 }] : []);
  }

  if (/\b(tell me about|what is)\b/i.test(t) && !/\b(sam|you)\b/i.test(lower)) {
    const name = cleanName(t);
    return finish(t, 'PRODUCT_INFORMATION', name ? [{ product_name: name, quantity: 1 }] : []);
  }

  if (
    /^(what (products )?do you have|show( me)?( all)? products|browse|enna products?( irukku)?|என்ன பொருள்)/i.test(wrapped)
  ) {
    return finish(t, 'SHOW_PRODUCTS', []);
  }

  const search = wrapped.match(/^(show|search|find|list)\s+(.+)/i);
  if (search) {
    const q = cleanName(search[2]);
    if (q && q !== 'products') {
      return finish(t, 'SEARCH_PRODUCTS', [], { search_query: q, target_product: q });
    }
  }

  if (/\b(where is my order|order status|last (order|time)|recent order|what did i order)\b/i.test(t)) {
    return finish(t, 'ORDER_STATUS', []);
  }
  if (/\b(order history|my orders|past orders)\b/i.test(t)) {
    return finish(t, 'ORDER_HISTORY', []);
  }
  if (/\b(how do i (place|order)|how to order|place an order|change my address|cancel my order)\b/i.test(t)) {
    if (/cancel/.test(lower)) {
      return finish(t, 'HOW_TO_ORDER', []);
    }
    if (/address/.test(lower)) {
      return finish(t, 'FARM2FLAVOURS_HELP', []);
    }
    return finish(t, 'HOW_TO_ORDER', []);
  }

  if (/\b(total|எவ்வளவு)\b/i.test(t) && !/\badd\b/i.test(t)) {
    return finish(t, 'PRODUCT_INFORMATION', []);
  }

  if (/^(confirm|place (the )?order|order pannunga|confirm pannunga)$/i.test(wrapped)) {
    return finish(t, 'CONFIRM', []);
  }

  const changeNamed = t.match(/change\s+(.+?)\s+(?:quantity\s+)?to\s+(\d+|[a-zA-Z\u0B80-\u0BFF]+)/i);
  if (changeNamed) {
    const { qty } = parseQty(changeNamed[2]);
    return finish(t, 'CHANGE_QUANTITY', [{ product_name: cleanName(changeNamed[1]), quantity: qty }]);
  }

  const makeNamed = wrapped.match(/^make\s+(.+?)\s+(one|two|three|four|five|rendu|moonu|moonnu|\d+)$/i);
  if (makeNamed && !/^make it\b/i.test(wrapped)) {
    const { qty } = parseQty(makeNamed[2]);
    return finish(t, 'CHANGE_QUANTITY', [{ product_name: cleanName(makeNamed[1]), quantity: qty }]);
  }

  if (/^(make it|set it|change (it )?to|it to)\s+/i.test(wrapped) || /^make it\b/i.test(wrapped)) {
    const { qty } = parseQty(wrapped);
    return finish(t, 'CHANGE_QUANTITY', [{ product_name: '__last__', quantity: qty }]);
  }

  if (/\b(remove|delete|எடு)\b/i.test(t) && !/\b(order|draft|cart|எல்லாம்)\b/i.test(t)) {
    const name = cleanName(t.replace(/\b(remove|delete|please|vendaam|vendam|வேண்டாம்)\b/gi, ' '));
    if (name) {
      return finish(t, 'REMOVE_ITEM', [{ product_name: name, quantity: 1 }]);
    }
  }

  if (/\b(add one more|one more|இன்னொன்று)\b/i.test(t)) {
    return finish(t, 'ADD_ITEMS', [{ product_name: '__last__', quantity: 1 }]);
  }

  const ordinal = wrapped.match(/\b(add|get)?\s*(the\s+)?(first|second|third|1st|2nd|3rd)\s+(one|item|product)?\b/i);
  if (ordinal) {
    const slot = ordinal[3].toLowerCase();
    const token =
      slot === 'first' || slot === '1st' ? '__first__' : slot === 'second' || slot === '2nd' ? '__second__' : '__third__';
    return finish(t, 'ADD_ITEMS', [{ product_name: token, quantity: 1 }]);
  }

  const wantsAdd =
    /^(order|add|buy|get|want)\b/i.test(wrapped) ||
    /\b(add|order|buy|venum|venu|pannunga|sertukonga|சேர்)\b/i.test(t) ||
    /\b(i want|i need|get me|give me|i'd like|i would like)\b/i.test(t) ||
    /\b(one|two|three|four|five|rendu|oru|onnu|moonu|moonnu|naalu|anju)\b/i.test(t) ||
    /\b\d+\b/.test(t);

  if (wantsAdd && !/^(place (the )?order|confirm)$/i.test(wrapped) && !isQuestion(wrapped)) {
    const stripped = wrapped.replace(
      /^(to\s+)?(add|order|buy|get|i want|i need|add pannunga)\s+(me\s+)?(a|an|the|some)?\s*/i,
      '',
    );
    const items = extractItems(stripped);
    if (items.length) {
      return finish(t, 'ADD_ITEMS', items);
    }
  }

  return finish(t, 'UNKNOWN', []);
}

export function tryConfidentCartIntent(transcript: string): ParsedIntent | null {
  const parsed = fallbackParse(transcript);
  if (parsed.intent === 'CHANGE_QUANTITY' && parsed.items.length > 0) {
    return parsed;
  }
  if (parsed.intent === 'REMOVE_ITEM' && parsed.items.length > 0 && parsed.items[0].product_name) {
    return parsed;
  }
  if (parsed.intent !== 'ADD_ITEMS' || parsed.items.length === 0) {
    return null;
  }
  const t = normalizeTranscript(transcript);
  const hasVerb = /\b(add|order|buy|get|want|need|venum|venu|pannunga|sertukonga|சேர்)\b/i.test(transcript);
  const hasQty = /\b(\d+|one|two|three|four|five|oru|rendu|moonu|moonnu|naalu|anju)\b/i.test(t);
  const namesOk = parsed.items.every((item) => item.product_name.length >= 3);
  if ((hasVerb || hasQty) && namesOk && !isQuestion(t)) {
    return parsed;
  }
  return null;
}
