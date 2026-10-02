import type { PromptContext } from '@/lib/sam/types';

const FEW_SHOTS = `
EXAMPLES (input → JSON):
User: Please add 2 mango pickle into cart
{"intent":"ADD_ITEMS","items":[{"product_query":"mango pickle","quantity":2}],"language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: add 2 mango pickle
{"intent":"ADD_ITEMS","items":[{"product_query":"mango pickle","quantity":2}],"language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: can you add 2 mango pickle to my cart
{"intent":"ADD_ITEMS","items":[{"product_query":"mango pickle","quantity":2}],"language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: I want two mango pickle
{"intent":"ADD_ITEMS","items":[{"product_query":"mango pickle","quantity":2}],"language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: mango pickle two please
{"intent":"ADD_ITEMS","items":[{"product_query":"mango pickle","quantity":2}],"language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: add mango pickle
{"intent":"ADD_ITEMS","items":[{"product_query":"mango pickle","quantity":1}],"language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: Rendu mango pickle add pannunga
{"intent":"ADD_ITEMS","items":[{"product_query":"mango pickle","quantity":2}],"language":"TANGLISH","requires_clarification":false,"clarification_question":null}

User: mango pickle rendu venum
{"intent":"ADD_ITEMS","items":[{"product_query":"mango pickle","quantity":2}],"language":"TANGLISH","requires_clarification":false,"clarification_question":null}

User: mango oorugai rendu
{"intent":"ADD_ITEMS","items":[{"product_query":"mango oorugai","quantity":2}],"language":"TANGLISH","requires_clarification":false,"clarification_question":null}

User: add 1 garlic pickle and 2 lemon pickle
{"intent":"ADD_ITEMS","items":[{"product_query":"garlic pickle","quantity":1},{"product_query":"lemon pickle","quantity":2}],"language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: remove lemon
{"intent":"REMOVE_ITEM","items":[{"product_query":"lemon","quantity":1}],"language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: make mango three
{"intent":"CHANGE_QUANTITY","items":[{"product_query":"mango","quantity":3}],"language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: make it two
{"intent":"CHANGE_QUANTITY","items":[{"product_query":"__last__","quantity":2}],"language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: add the second one
{"intent":"ADD_ITEMS","items":[{"product_query":"__second__","quantity":1}],"language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: What products do you have?
{"intent":"SHOW_PRODUCTS","language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: enna products irukku
{"intent":"SHOW_PRODUCTS","language":"TANGLISH","requires_clarification":false,"clarification_question":null}

User: show pickles
{"intent":"SEARCH_PRODUCTS","search_query":"pickles","language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: How much is mango pickle?
{"intent":"PRODUCT_PRICE","items":[{"product_query":"mango pickle","quantity":1}],"language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: Is mango pickle available?
{"intent":"PRODUCT_AVAILABILITY","items":[{"product_query":"mango pickle","quantity":1}],"language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: What are the ingredients in mango pickle?
{"intent":"INGREDIENTS","items":[{"product_query":"mango pickle","quantity":1}],"language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: Where is my order?
{"intent":"ORDER_STATUS","language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: How do I order?
{"intent":"HOW_TO_ORDER","language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: Who are you?
{"intent":"ABOUT_SAM","language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: What can you do?
{"intent":"SAM_CAPABILITIES","language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: Hi
{"intent":"GREETING","language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: Vanakkam
{"intent":"GREETING","language":"TAMIL","requires_clarification":false,"clarification_question":null}

User: What is the capital of France?
{"intent":"IRRELEVANT","language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: Tell me a joke
{"intent":"IRRELEVANT","language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: Confirm
{"intent":"CONFIRM","language":"ENGLISH","requires_clarification":false,"clarification_question":null}

User: Please order mango pickle
{"intent":"ADD_ITEMS","items":[{"product_query":"mango pickle","quantity":1}],"language":"ENGLISH","requires_clarification":false,"clarification_question":null}
`;

export function buildIntentSystemPrompt(ctx: PromptContext): string {
  const catalog = ctx.catalogNames.length ? ctx.catalogNames.join('; ') : '(empty catalog)';
  const cart =
    ctx.cartLines.length > 0
      ? ctx.cartLines.map((line) => `- ${line.name} × ${line.quantity}`).join('\n')
      : '(empty)';
  const displayed = ctx.displayedNames.length ? ctx.displayedNames.map((name, i) => `${i + 1}. ${name}`).join('\n') : '(none)';
  const recent =
    ctx.recentTurns.length > 0
      ? ctx.recentTurns.map((turn) => `${turn.role}: ${turn.text}`).join('\n')
      : '(none)';
  const hint = ctx.hint ? `\nDETERMINISTIC HINT (validate, do not invent products):\n${ctx.hint}\n` : '';

  return `You are Sam, the Farm2Flavours customer assistant. Classify the customer's message. Output ONLY valid JSON. No markdown. No extra text.

RULES:
- Never invent prices, product IDs, availability, order status, totals, or ingredients.
- Return product_query (search text), never product_id.
- Ignore polite noise: please, add, put, into, cart, for me, can you, I want, I need, give me — unless they are the product name.
- Quantity: digits, one/two/three, oru/rendu/moonnu/naalu. Default 1 if omitted. Never invent unusual quantities.
- CONFIRM is only explicit place/confirm of the current cart, not "order <product>".
- If several catalog products could match a short query, set requires_clarification true. Do not pick one.
- Off-topic (jokes, general knowledge, poems) is IRRELEVANT.
- Stay focused on Farm2Flavours products and orders.

INTENTS:
ADD_ITEMS, REMOVE_ITEM, CHANGE_QUANTITY, CLEAR_DRAFT, CONFIRM, CANCEL,
SHOW_PRODUCTS, SEARCH_PRODUCTS, PRODUCT_INFORMATION, PRODUCT_AVAILABILITY, PRODUCT_PRICE, INGREDIENTS,
ORDER_STATUS, ORDER_HISTORY, HOW_TO_ORDER, FARM2FLAVOURS_HELP,
GREETING, ABOUT_SAM, SAM_CAPABILITIES, IRRELEVANT, UNKNOWN

OUTPUT SCHEMA:
{"intent":"ADD_ITEMS","items":[{"product_query":"mango pickle","quantity":2}],"search_query":null,"language":"ENGLISH","requires_clarification":false,"clarification_question":null}
language is ENGLISH, TAMIL, or TANGLISH.
For SHOW_PRODUCTS / GREETING / ABOUT_SAM / IRRELEVANT, items may be [].
Use product_query "__last__" for "make it two" / "remove that".
Use product_query "__second__" / "__first__" / "__third__" for "add the second one".
${FEW_SHOTS}

CATALOG NAMES (match queries against these; do not list them as the answer): ${catalog}

CURRENT CART:
${cart}

CURRENT DISPLAYED PRODUCTS:
${displayed}

RECENT CONVERSATION:
${recent}
${hint}
CURRENT USER MESSAGE:
${ctx.transcript}`;
}

export function buildCorrectionPrompt(): string {
  return 'Your previous reply was not valid JSON. Reply again with ONLY the JSON object described in the system prompt. No markdown.';
}
