import { createClient } from '@supabase/supabase-js';

import { env } from '@/config/env';
import { addLine, setLine, viewDraft } from '@/lib/sam/apply-draft';
import { createAIService } from '@/lib/sam/ai-service';
import { isExplicitConfirm, isExplicitYes } from '@/lib/sam/confirm-phrases';
import { detectLanguage } from '@/lib/sam/language';
import { matchProduct } from '@/lib/sam/match-products';
import { replies } from '@/lib/sam/replies';
import type {
  CatalogProduct,
  ConversationState,
  DraftLine,
  SamTurnRequest,
  SamTurnResponse,
} from '@/lib/sam/types';

function catalogClient() {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function userClient(accessToken: string) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function logTurn(payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  console.info('[sam]', JSON.stringify(payload));
}

async function loadCatalog(businessId: string): Promise<CatalogProduct[]> {
  const supabase = catalogClient();
  const { data, error } = await supabase.rpc('get_available_products', { p_business_id: businessId });
  if (error || !data) {
    return [];
  }
  return (data as CatalogProduct[]).map((row) => ({
    ...row,
    ingredients: row.ingredients ?? null,
    available: row.available !== false,
    active: row.active !== false,
    price: Number(row.price),
  }));
}

export async function processSamTurn(
  body: SamTurnRequest,
  accessToken: string | null,
): Promise<SamTurnResponse> {
  const language = detectLanguage(body.transcript);
  const catalog = await loadCatalog(body.businessId);
  if (/^\s*(hey\s+sam|ஹே\s*சாம்)\s*[.!?]*\s*$/i.test(body.transcript.trim())) {
    const draft = viewDraft(catalog, body.draft ?? []);
    return {
      reply: replies.greet(language),
      language,
      intent: 'UNKNOWN',
      conversationState: 'LISTENING',
      draft,
      canPlace: false,
      pendingNoteProductId: body.pendingNoteProductId ?? null,
    };
  }
  const ai = createAIService();
  const parsed = await ai.parse(body.transcript, catalog);
  let draft: DraftLine[] = body.draft.filter((line) => line.quantity > 0);
  let pendingNoteProductId = body.pendingNoteProductId ?? null;
  let conversationState: ConversationState = 'PROCESSING';
  let canPlace = false;
  let reply = replies.unknown(language);
  const matchLog: SamTurnResponse['match'] = [];

  const supabaseUser = accessToken ? userClient(accessToken) : null;
  const {
    data: { user },
  } = supabaseUser ? await supabaseUser.auth.getUser() : { data: { user: null } };

  logTurn({
    transcript: body.transcript,
    language,
    intent: parsed.intent,
    parsedItems: parsed.items,
  });

  if (pendingNoteProductId && isExplicitYes(body.transcript) && user && supabaseUser) {
    try {
      await supabaseUser.from('product_info_requests').insert({
        business_id: body.businessId,
        user_id: user.id,
        product_id: pendingNoteProductId,
        transcript: body.transcript,
      });
    } catch {
      // Table may not be migrated yet.
    }
    pendingNoteProductId = null;
    conversationState = 'IDLE';
    reply = replies.noted(language);
    logTurn({ validation: 'noted_product_info' });
    return {
      reply,
      language,
      intent: 'NOTE_PRODUCT_INFO',
      conversationState,
      draft: viewDraft(catalog, draft),
      canPlace: false,
      pendingNoteProductId: null,
    };
  }

  if (isExplicitConfirm(body.transcript) && viewDraft(catalog, draft).items.length > 0) {
    const viewed = viewDraft(catalog, draft);
    const stillValid = viewed.items.every((line) => {
      const product = catalog.find((p) => p.id === line.productId);
      return product && product.available !== false;
    });
    if (!stillValid) {
      conversationState = 'ERROR';
      reply = replies.unavailable(language, 'That item');
    } else if (!user) {
      conversationState = 'WAITING_FOR_CONFIRMATION';
      reply = replies.needSignIn(language);
    } else {
      conversationState = 'CONFIRMED';
      canPlace = true;
      reply = replies.updated(language, viewed.items, viewed.total);
    }
    logTurn({ intent: 'CONFIRM', validation: stillValid, canPlace, signedIn: Boolean(user) });
    return {
      reply,
      language,
      intent: 'CONFIRM',
      conversationState,
      draft: viewed,
      canPlace,
      pendingNoteProductId: null,
      match: matchLog,
    };
  }

  if (parsed.intent === 'CONFIRM') {
    conversationState = 'WAITING_FOR_CONFIRMATION';
    reply = replies.notConfirm(language);
    return {
      reply,
      language,
      intent: 'CONFIRM',
      conversationState,
      draft: viewDraft(catalog, draft),
      canPlace: false,
      pendingNoteProductId,
    };
  }

  if (parsed.intent === 'CANCEL' || parsed.intent === 'CLEAR_DRAFT') {
    draft = [];
    conversationState = 'CANCELLED';
    reply = replies.cancelled(language);
    return {
      reply,
      language,
      intent: parsed.intent,
      conversationState,
      draft: viewDraft(catalog, draft),
      canPlace: false,
      pendingNoteProductId: null,
    };
  }

  if (parsed.intent === 'GENERAL_HELP') {
    const lower = body.transcript.toLowerCase();
    if (/cancel/.test(lower)) {
      reply = replies.cannotCancel(language);
    } else if (/address/.test(lower)) {
      reply = replies.changeAddress(language);
    } else {
      reply = replies.howToOrder(language);
    }
    conversationState = 'IDLE';
    return {
      reply,
      language,
      intent: parsed.intent,
      conversationState,
      draft: viewDraft(catalog, draft),
      canPlace: false,
      pendingNoteProductId,
    };
  }

  if (parsed.intent === 'ORDER_STATUS') {
    conversationState = 'IDLE';
    if (!user || !supabaseUser) {
      reply = replies.needSignIn(language);
    } else {
      const { data } = await supabaseUser
        .from('orders')
        .select('order_number, status, total_amount, created_at')
        .eq('user_id', user.id)
        .eq('business_id', body.businessId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) {
        reply = replies.noInfo(language);
      } else {
        reply = replies.lastOrder(
          language,
          `#${data.order_number ?? ''} · ${data.status} · ₹${data.total_amount}`,
        );
      }
    }
    return {
      reply,
      language,
      intent: parsed.intent,
      conversationState,
      draft: viewDraft(catalog, draft),
      canPlace: false,
      pendingNoteProductId,
    };
  }

  const infoIntents = parsed.intent === 'INGREDIENTS' || parsed.intent === 'PRODUCT_INFORMATION';
  if (infoIntents) {
    const viewed = viewDraft(catalog, draft);
    if (!parsed.items[0]?.product_name && viewed.items.length && /\btotal\b/i.test(body.transcript)) {
      conversationState = viewed.items.length ? 'DRAFT_READY' : 'IDLE';
      reply = viewed.items.length
        ? replies.updated(language, viewed.items, viewed.total)
        : replies.emptyDraft(language);
      return {
        reply,
        language,
        intent: parsed.intent,
        conversationState,
        draft: viewed,
        canPlace: false,
        pendingNoteProductId,
      };
    }
    const query = parsed.items[0]?.product_name ?? '';
    const match = matchProduct(catalog, query);
    matchLog.push({
      query,
      productIds:
        match.status === 'unique' || match.status === 'unavailable'
          ? [match.product.id]
          : match.status === 'ambiguous'
            ? match.products.map((p) => p.id)
            : [],
    });
    if (match.status === 'missing') {
      reply = replies.missing(language);
      conversationState = 'CLARIFICATION_REQUIRED';
    } else if (match.status === 'ambiguous') {
      reply = replies.ambiguous(language, match.products);
      conversationState = 'CLARIFICATION_REQUIRED';
    } else {
      const product = match.product;
      if (parsed.intent === 'INGREDIENTS') {
        const text = product.ingredients?.trim();
        if (!text) {
          pendingNoteProductId = product.id;
          reply = replies.noIngredients(language, product.name);
          conversationState = 'CLARIFICATION_REQUIRED';
        } else {
          reply = replies.ingredients(language, product.name, text);
          conversationState = 'IDLE';
        }
      } else {
        reply = replies.price(language, product.name, Number(product.price), product.available !== false);
        conversationState = 'IDLE';
      }
    }
    logTurn({ match: matchLog, validation: match.status });
    return {
      reply,
      language,
      intent: parsed.intent,
      conversationState,
      draft: viewDraft(catalog, draft),
      canPlace: false,
      pendingNoteProductId,
      match: matchLog,
    };
  }

  if (
    parsed.intent === 'ADD_ITEMS' ||
    parsed.intent === 'REMOVE_ITEM' ||
    parsed.intent === 'CHANGE_QUANTITY'
  ) {
    let lastId = draft[draft.length - 1]?.productId ?? null;
    for (const item of parsed.items) {
      const query = item.product_name === '__last__' && lastId
        ? catalog.find((p) => p.id === lastId)?.name ?? ''
        : item.product_name;
      const match = matchProduct(catalog, query);
      matchLog.push({
        query,
        productIds:
          match.status === 'unique' || match.status === 'unavailable'
            ? [match.product.id]
            : match.status === 'ambiguous'
              ? match.products.map((p) => p.id)
              : [],
      });
      if (match.status === 'missing') {
        reply = replies.missing(language);
        conversationState = 'CLARIFICATION_REQUIRED';
        logTurn({ match: matchLog, validation: 'missing' });
        return {
          reply,
          language,
          intent: parsed.intent,
          conversationState,
          draft: viewDraft(catalog, draft),
          canPlace: false,
          pendingNoteProductId,
          match: matchLog,
        };
      }
      if (match.status === 'ambiguous') {
        reply = replies.ambiguous(language, match.products);
        conversationState = 'CLARIFICATION_REQUIRED';
        logTurn({ match: matchLog, validation: 'ambiguous' });
        return {
          reply,
          language,
          intent: parsed.intent,
          conversationState,
          draft: viewDraft(catalog, draft),
          canPlace: false,
          pendingNoteProductId,
          match: matchLog,
        };
      }
      if (match.status === 'unavailable' && parsed.intent === 'ADD_ITEMS') {
        reply = replies.unavailable(language, match.product.name);
        conversationState = 'CLARIFICATION_REQUIRED';
        return {
          reply,
          language,
          intent: parsed.intent,
          conversationState,
          draft: viewDraft(catalog, draft),
          canPlace: false,
          pendingNoteProductId,
          match: matchLog,
        };
      }
      const product = match.product;
      lastId = product.id;
      if (parsed.intent === 'ADD_ITEMS') {
        draft = addLine(draft, product.id, Math.max(1, item.quantity || 1));
      } else if (parsed.intent === 'REMOVE_ITEM') {
        draft = setLine(draft, product.id, 0);
      } else {
        draft = setLine(draft, product.id, Math.max(1, item.quantity || 1));
      }
    }
    const viewed = viewDraft(catalog, draft);
    if (viewed.items.length === 0) {
      conversationState = 'IDLE';
      reply = replies.emptyDraft(language);
    } else if (parsed.intent === 'ADD_ITEMS' && viewed.items.length && parsed.items.length) {
      conversationState = 'DRAFT_READY';
      reply = replies.added(language, viewed.items, viewed.total, viewed.items.length > 1);
    } else {
      conversationState = 'WAITING_FOR_CONFIRMATION';
      reply = replies.updated(language, viewed.items, viewed.total);
    }
    logTurn({ match: matchLog, validation: 'ok', draft: viewed });
    return {
      reply,
      language,
      intent: parsed.intent,
      conversationState,
      draft: viewed,
      canPlace: false,
      pendingNoteProductId: null,
      match: matchLog,
    };
  }

  conversationState = 'IDLE';
  reply = replies.unknown(language);
  return {
    reply,
    language,
    intent: parsed.intent,
    conversationState,
    draft: viewDraft(catalog, draft),
    canPlace: false,
    pendingNoteProductId,
  };
}
