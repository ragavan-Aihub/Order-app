import { fallbackParse, tryConfidentCartIntent } from '../lib/sam/fallback-parser';
import { matchProduct } from '../lib/sam/match-products';
import { normalizeTranscript } from '../lib/sam/normalize-input';
import { createAIService } from '../lib/sam/ai-service';
import type { CatalogProduct, ParsedIntent, SamIntent } from '../lib/sam/types';

const catalog: CatalogProduct[] = [
  { id: 'm200', name: 'Mango Pickle 200g', description: '', ingredients: 'mango', price: 120, available: true, active: true },
  { id: 'm500', name: 'Mango Pickle 500g', description: '', ingredients: 'mango', price: 250, available: true, active: true },
  { id: 'g200', name: 'Garlic Pickle 200g', description: '', ingredients: 'garlic', price: 110, available: true, active: true },
  { id: 'l200', name: 'Lemon Pickle 200g', description: '', ingredients: 'lemon', price: 100, available: true, active: true },
  { id: 't200', name: 'Tomato Pickle 200g', description: '', ingredients: null, price: 90, available: false, active: true },
  { id: 'x200', name: 'Mixed Vegetable Pickle 200g', description: '', ingredients: 'veg', price: 130, available: true, active: true },
];

type Expect = {
  id: string;
  transcript: string;
  intent: SamIntent;
  queryIncludes?: string;
  qty?: number;
  match?: 'unique' | 'ambiguous' | 'missing';
};

function addCase(id: string, transcript: string, intent: SamIntent, extra?: Partial<Expect>): Expect {
  return { id, transcript, intent, ...extra };
}

function buildCases(): Expect[] {
  const cases: Expect[] = [];
  const garlicAdds = [
    'add garlic pickle',
    'please add garlic pickle',
    'can you add garlic pickle',
    'add garlic pickle into cart',
    'please add garlic pickle into cart',
    'I want garlic pickle',
    'I need garlic pickle',
    'add 1 garlic pickle',
    'add one garlic pickle',
    'garlic pickle one',
    'order garlic pickle',
    'buy garlic pickle',
    'get me garlic pickle',
    'add garlic pickle please',
    'kindly add garlic pickle',
    'garlic pickle add pannunga',
    'garlic pickle venum',
    'oru garlic pickle',
    'add garlic pickle to my cart',
    'could you add garlic pickle',
  ];
  garlicAdds.forEach((t, i) => {
    cases.push(addCase(`garlic-add-${i + 1}`, t, 'ADD_ITEMS', { queryIncludes: 'garlic', qty: 1, match: 'unique' }));
  });

  const twoMango = [
    'add 2 mango pickle',
    'Please add 2 mango pickle into cart',
    'can you add 2 mango pickle to my cart',
    'I want two mango pickle',
    'mango pickle two please',
    'add two mango pickle',
    'Rendu mango pickle add pannunga',
    'mango pickle rendu venum',
    'mango pickle two',
    'order 2 mango pickle',
    'add 2 mango pickle please',
    'i need two mango pickle',
    'give me two mango pickle',
    'mango pickle 2',
    '2 mango pickle add',
  ];
  twoMango.forEach((t, i) => {
    cases.push(addCase(`mango-2-${i + 1}`, t, 'ADD_ITEMS', { queryIncludes: 'mango', qty: 2, match: 'ambiguous' }));
  });

  const three = ['add three lemon pickle', 'lemon pickle moonnu', 'make lemon pickle three'];
  cases.push(addCase('lemon-3-1', three[0], 'ADD_ITEMS', { queryIncludes: 'lemon', qty: 3, match: 'unique' }));
  cases.push(addCase('lemon-3-2', three[1], 'ADD_ITEMS', { queryIncludes: 'lemon', qty: 3, match: 'unique' }));
  cases.push(addCase('lemon-3-3', three[2], 'CHANGE_QUANTITY', { queryIncludes: 'lemon', qty: 3, match: 'unique' }));

  cases.push(addCase('remove-1', 'remove lemon', 'REMOVE_ITEM', { queryIncludes: 'lemon', match: 'unique' }));
  cases.push(addCase('remove-2', 'delete garlic pickle', 'REMOVE_ITEM', { queryIncludes: 'garlic', match: 'unique' }));
  cases.push(addCase('qty-last', 'make it two', 'CHANGE_QUANTITY', { queryIncludes: '__last__', qty: 2 }));
  cases.push(addCase('second', 'add the second one', 'ADD_ITEMS', { queryIncludes: '__second__', qty: 1 }));
  cases.push(addCase('multi', 'add 1 garlic pickle and 2 lemon pickle', 'ADD_ITEMS', { queryIncludes: 'garlic', qty: 1 }));

  const greets = ['Hi', 'Hello', 'Hey', 'Vanakkam', 'hey sam'];
  greets.forEach((t, i) => cases.push(addCase(`greet-${i + 1}`, t, 'GREETING')));

  cases.push(addCase('about-1', 'Who are you?', 'ABOUT_SAM'));
  cases.push(addCase('about-2', 'who is sam', 'ABOUT_SAM'));
  cases.push(addCase('cap-1', 'What can you do?', 'SAM_CAPABILITIES'));
  cases.push(addCase('irr-1', 'What is the capital of France?', 'IRRELEVANT'));
  cases.push(addCase('irr-2', 'Tell me a joke', 'IRRELEVANT'));
  cases.push(addCase('irr-3', 'weather today', 'IRRELEVANT'));
  cases.push(addCase('show-1', 'What products do you have?', 'SHOW_PRODUCTS'));
  cases.push(addCase('show-2', 'show products', 'SHOW_PRODUCTS'));
  cases.push(addCase('show-3', 'enna products irukku', 'SHOW_PRODUCTS'));
  cases.push(addCase('search-1', 'show pickles', 'SEARCH_PRODUCTS', { queryIncludes: 'pickle' }));
  cases.push(addCase('price-1', 'How much is garlic pickle?', 'PRODUCT_PRICE', { queryIncludes: 'garlic', match: 'unique' }));
  cases.push(addCase('avail-1', 'Is garlic pickle available?', 'PRODUCT_AVAILABILITY', { queryIncludes: 'garlic', match: 'unique' }));
  cases.push(addCase('ing-1', 'What are the ingredients in garlic pickle?', 'INGREDIENTS', { queryIncludes: 'garlic', match: 'unique' }));
  cases.push(addCase('status-1', 'Where is my order?', 'ORDER_STATUS'));
  cases.push(addCase('how-1', 'How do I order?', 'HOW_TO_ORDER'));
  cases.push(addCase('confirm-1', 'Confirm', 'CONFIRM'));
  cases.push(addCase('confirm-2', 'place order', 'CONFIRM'));
  cases.push(addCase('cancel-1', 'cancel', 'CANCEL'));
  cases.push(addCase('noise-1', 'pls add 2 mango pickle', 'ADD_ITEMS', { queryIncludes: 'mango', qty: 2, match: 'ambiguous' }));
  cases.push(addCase('noise-2', 'uh add garlic pickle', 'ADD_ITEMS', { queryIncludes: 'garlic', qty: 1, match: 'unique' }));
  cases.push(addCase('noise-3', 'add mango oorugai rendu', 'ADD_ITEMS', { queryIncludes: 'mango', qty: 2, match: 'ambiguous' }));
  cases.push(addCase('ta-1', 'mango oorugai rendu', 'ADD_ITEMS', { queryIncludes: 'mango', qty: 2, match: 'ambiguous' }));
  cases.push(addCase('missing-1', 'add unicorn pickle', 'ADD_ITEMS', { queryIncludes: 'unicorn', match: 'missing' }));

  const stt = ['add 2 mango pickle.', 'Add two mango pickle!', 'ADD TWO MANGO PICKLE'];
  stt.forEach((t, i) => {
    cases.push(addCase(`stt-${i + 1}`, t, 'ADD_ITEMS', { queryIncludes: 'mango', qty: 2, match: 'ambiguous' }));
  });

  ['lemon', 'garlic', 'tomato'].forEach((name, i) => {
    cases.push(addCase(`qty-word-${i + 1}`, `add two ${name} pickle`, 'ADD_ITEMS', { queryIncludes: name, qty: 2 }));
  });

  for (let n = 1; n <= 5; n += 1) {
    cases.push(
      addCase(`digit-garlic-${n}`, `add ${n} garlic pickle`, 'ADD_ITEMS', {
        queryIncludes: 'garlic',
        qty: n,
        match: 'unique',
      }),
    );
  }

  const wrappers = ['please', 'can you', 'could you', 'I would like to', 'kindly'];
  wrappers.forEach((w, i) => {
    cases.push(
      addCase(`wrap-${i + 1}`, `${w} add 2 mango pickle`, 'ADD_ITEMS', {
        queryIncludes: 'mango',
        qty: 2,
        match: 'ambiguous',
      }),
    );
  });

  const extras: Array<[string, string, SamIntent, Partial<Expect>?]> = [
    ['ex-1', 'Hi Sam', 'GREETING'],
    ['ex-2', 'hello sam', 'GREETING'],
    ['ex-3', 'வணக்கம்', 'GREETING'],
    ['ex-4', 'namaste', 'GREETING'],
    ['ex-5', 'who are you sam', 'ABOUT_SAM'],
    ['ex-6', 'tell me a joke please', 'IRRELEVANT'],
    ['ex-7', 'what is the capital of india', 'IRRELEVANT'],
    ['ex-8', 'browse', 'SHOW_PRODUCTS'],
    ['ex-9', 'show me products', 'SHOW_PRODUCTS'],
    ['ex-10', 'search lemon', 'SEARCH_PRODUCTS', { queryIncludes: 'lemon' }],
    ['ex-11', 'find garlic', 'SEARCH_PRODUCTS', { queryIncludes: 'garlic' }],
    ['ex-12', 'how much is lemon pickle', 'PRODUCT_PRICE', { queryIncludes: 'lemon', match: 'unique' }],
    ['ex-13', 'lemon pickle price', 'PRODUCT_PRICE', { queryIncludes: 'lemon', match: 'unique' }],
    ['ex-14', 'is lemon pickle in stock', 'PRODUCT_AVAILABILITY', { queryIncludes: 'lemon', match: 'unique' }],
    ['ex-15', 'order status', 'ORDER_STATUS'],
    ['ex-16', 'my orders', 'ORDER_HISTORY'],
    ['ex-17', 'how to order', 'HOW_TO_ORDER'],
    ['ex-18', 'place the order', 'CONFIRM'],
    ['ex-19', 'clear cart', 'CLEAR_DRAFT'],
    ['ex-20', 'add one more', 'ADD_ITEMS', { queryIncludes: '__last__', qty: 1 }],
    ['ex-21', 'make garlic two', 'CHANGE_QUANTITY', { queryIncludes: 'garlic', qty: 2, match: 'unique' }],
    ['ex-22', 'change garlic pickle to 3', 'CHANGE_QUANTITY', { queryIncludes: 'garlic', qty: 3, match: 'unique' }],
    ['ex-23', 'add the first one', 'ADD_ITEMS', { queryIncludes: '__first__' }],
    ['ex-24', 'add the third one', 'ADD_ITEMS', { queryIncludes: '__third__' }],
    ['ex-25', 'pls add 1 garlic pickle', 'ADD_ITEMS', { queryIncludes: 'garlic', qty: 1, match: 'unique' }],
    ['ex-26', 'add four lemon pickle', 'ADD_ITEMS', { queryIncludes: 'lemon', qty: 4, match: 'unique' }],
    ['ex-27', 'naalu lemon pickle', 'ADD_ITEMS', { queryIncludes: 'lemon', qty: 4, match: 'unique' }],
    ['ex-28', 'please order garlic pickle', 'ADD_ITEMS', { queryIncludes: 'garlic', qty: 1, match: 'unique' }],
  ];
  for (const [id, transcript, intent, extra] of extras) {
    cases.push(addCase(id, transcript, intent, extra));
  }

  return cases;
}

function parseOffline(transcript: string): ParsedIntent {
  return tryConfidentCartIntent(transcript) ?? fallbackParse(transcript);
}

function scoreCase(row: Expect, parsed: ParsedIntent): string[] {
  const errors: string[] = [];
  if (parsed.intent !== row.intent) {
    errors.push(`intent ${parsed.intent} != ${row.intent}`);
  }
  if (row.queryIncludes) {
    const hay = `${parsed.items[0]?.product_name ?? ''} ${parsed.search_query ?? ''} ${parsed.target_product ?? ''}`.toLowerCase();
    if (!hay.includes(row.queryIncludes.toLowerCase())) {
      errors.push(`query missing "${row.queryIncludes}" got "${hay.trim()}"`);
    }
  }
  if (row.qty != null && parsed.items[0] && parsed.items[0].quantity !== row.qty) {
    errors.push(`qty ${parsed.items[0].quantity} != ${row.qty}`);
  }
  if (row.match && parsed.items[0] && !parsed.items[0].product_name.startsWith('__')) {
    const match = matchProduct(catalog, parsed.items[0].product_name);
    if (match.status !== row.match) {
      errors.push(`match ${match.status} != ${row.match}`);
    }
  }
  return errors;
}

async function main() {
  const live = process.argv.includes('--live');
  const cases = buildCases();
  if (cases.length < 100) {
    throw new Error(`Need 100+ cases, got ${cases.length}`);
  }
  const ai = live ? createAIService() : null;
  let passed = 0;
  const failed: string[] = [];
  for (const row of cases) {
    const parsed = ai
      ? await ai.parse(row.transcript, catalog, {
          catalogNames: catalog.map((p) => p.name),
          cartLines: [],
          displayedNames: ['Garlic Pickle 200g', 'Lemon Pickle 200g', 'Mango Pickle 200g'],
          recentTurns: [],
          transcript: row.transcript,
        })
      : parseOffline(row.transcript);
    const errors = scoreCase(row, parsed);
    if (errors.length) {
      failed.push(
        `${row.id}: "${row.transcript}" [${normalizeTranscript(row.transcript)}] ${errors.join('; ')}`,
      );
    } else {
      passed += 1;
    }
  }
  const total = cases.length;
  const accuracy = ((passed / total) * 100).toFixed(1);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Accuracy: ${accuracy}%`);
  console.log(`Cases: ${total}${live ? ' (live Ollama)' : ' (deterministic)'}`);
  for (const line of failed.slice(0, 40)) {
    console.log(`  - ${line}`);
  }
  if (failed.length > 40) {
    console.log(`  … ${failed.length - 40} more`);
  }
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
