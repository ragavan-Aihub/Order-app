import { transcriptToLlmLanguage } from '@/lib/sam/language';
import type { ParsedIntent, ParsedItem } from '@/lib/sam/types';

const QTY: Array<{ re: RegExp; n: number }> = [
  { re: /\b(one|a|an|oru|onnu|ondru|ondru|ஒரு|ஒன்று)\b/i, n: 1 },
  { re: /\b(two|rendu|இரண்டு|ரெண்டு)\b/i, n: 2 },
  { re: /\b(three|moonu|moonru|மூன்று)\b/i, n: 3 },
  { re: /\b(four|naalu|நாலு|நான்கு)\b/i, n: 4 },
  { re: /\b(five|anju|anai|ஐந்து)\b/i, n: 5 },
  { re: /\b(\d+)\b/, n: 0 },
];

function parseQty(segment: string): { qty: number; rest: string } {
  const digits = segment.match(/\b(\d+)\b/);
  if (digits) {
    return { qty: Math.max(1, Number(digits[1])), rest: segment.replace(digits[0], ' ') };
  }
  for (const row of QTY) {
    if (row.n === 0) {
      continue;
    }
    if (row.re.test(segment)) {
      return { qty: row.n, rest: segment.replace(row.re, ' ') };
    }
  }
  return { qty: 1, rest: segment };
}

function cleanName(raw: string) {
  return raw
    .replace(
      /\b(add|pannunga|pannu|venum|venu|vendaam|vendam|sertukonga|please|the|a|an|to|cart|order|sērkkavum|serkkavum|சேர்க்கவும்|வேண்டாம்)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function splitItems(text: string) {
  return text
    .split(/\band\b|,| plus | மற்றும் /i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function finish(transcript: string, intent: ParsedIntent['intent'], items: ParsedItem[]): ParsedIntent {
  return {
    intent,
    items,
    detected_language: transcriptToLlmLanguage(transcript),
    target_product: items[0]?.product_name ?? null,
  };
}

export function fallbackParse(transcript: string): ParsedIntent {
  const t = transcript.trim();
  const lower = t.toLowerCase();

  if (/\b(cancel|clear|stop|வேண்டாம்|vendaam|vendam|நிறுத்து)\b/i.test(t) && /\b(order|draft|cart|எல்லாம்)\b/i.test(t)) {
    return finish(t, 'CLEAR_DRAFT', []);
  }
  if (
    /^(cancel|clear)$/i.test(lower) ||
    lower === 'cancel pannunga' ||
    /^(vendaam|vendam|வேண்டாம்)$/i.test(lower)
  ) {
    return finish(t, 'CANCEL', []);
  }

  if (/\b(ingredient|ingredients|what.*(in|contain)|enna irukku|சேர்மான|பொருள்)\b/i.test(t)) {
    const name = cleanName(
      t.replace(/\b(what|are|the|ingredients|in|of|for|tell me about|contains?|enna|irukku|சேர்மானங்கள்|என்ன)\b/gi, ' '),
    );
    return finish(t, 'INGREDIENTS', name ? [{ product_name: name, quantity: 1 }] : []);
  }

  if (/\b(how much|price|cost|available|tell me about|what is)\b/i.test(t) || /விலை|கிடைக்குமா/.test(t)) {
    const name = cleanName(t);
    return finish(t, 'PRODUCT_INFORMATION', name ? [{ product_name: name, quantity: 1 }] : []);
  }

  if (/\b(where is my order|order status|last (order|time)|recent order|what did i order|cancel my order|how do i (place|change address)|place an order|change my address)\b/i.test(t)) {
    if (/cancel/.test(lower)) {
      return finish(t, 'GENERAL_HELP', []);
    }
    if (/last|recent|what did i order/.test(lower)) {
      return finish(t, 'ORDER_STATUS', []);
    }
    if (/where is my order|status/.test(lower)) {
      return finish(t, 'ORDER_STATUS', []);
    }
    return finish(t, 'GENERAL_HELP', []);
  }

  if (/\b(total|எவ்வளவு)\b/i.test(t) && !/\badd\b/i.test(t)) {
    return finish(t, 'PRODUCT_INFORMATION', []);
  }

  const change = t.match(/change\s+(.+?)\s+(?:quantity\s+)?to\s+(\d+|[a-zA-Z\u0B80-\u0BFF]+)/i);
  if (change) {
    const { qty } = parseQty(change[2]);
    return finish(t, 'CHANGE_QUANTITY', [{ product_name: cleanName(change[1]), quantity: qty }]);
  }

  if (/\b(remove|delete|எடு|vendaam|vendam|வேண்டாம்)\b/i.test(t) && !/\b(order|draft|cart|எல்லாம்)\b/i.test(t)) {
    const name = cleanName(t.replace(/\b(remove|delete|please|vendaam|vendam|வேண்டாம்)\b/gi, ' '));
    if (name) {
      return finish(t, 'REMOVE_ITEM', [{ product_name: name, quantity: 0 }]);
    }
  }

  if (/\b(add one more|one more|இன்னொன்று)\b/i.test(t)) {
    return finish(t, 'ADD_ITEMS', [{ product_name: '__last__', quantity: 1 }]);
  }

  if (
    /\b(add|venum|venu|pannunga|sertukonga|சேர்)\b/i.test(t) ||
    /\d/.test(t) ||
    /\brendu\b/i.test(t) ||
    /\boru\b/i.test(t) ||
    /\bonnu\b/i.test(t)
  ) {
    const stripped = t.replace(/^(please\s+)?(add|i want|i need|add pannunga)\s+/i, '');
    const items: ParsedItem[] = [];
    for (const part of splitItems(stripped)) {
      const { qty, rest } = parseQty(part);
      const name = cleanName(rest);
      if (name) {
        items.push({ product_name: name, quantity: qty });
      }
    }
    if (items.length) {
      return finish(t, 'ADD_ITEMS', items);
    }
  }

  return finish(t, 'UNKNOWN', []);
}
