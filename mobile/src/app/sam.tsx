import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart, type CartItem } from '@/cart/CartContext';
import { SamOrderLine, SamProductRow } from '@/components/SamProductRow';
import { colors, radius, spacing } from '@/config/theme';
import {
  browseListMode,
  browseReply,
  filterCatalog,
  isAddThatOne,
  isHowToOrder,
  matchesQuery,
  ORDER_HELP_REPLY,
  productsForSamQuery,
} from '@/sam/browse-catalog';
import { sendSamTurn } from '@/sam/api';
import { speakSam } from '@/sam/speak';
import { getPendingNoteProductId, setPendingNoteProductId, setSamDraftItems } from '@/sam/session';
import type { DraftViewLine } from '@/sam/types';
import { isHeySam, useSamSpeech } from '@/sam/useSamSpeech';
import { getAvailableProducts } from '@/services/products';
import type { Product } from '@/types/product';
import { formatPrice } from '@/utils/format';

type ChatTurn = {
  id: string;
  role: 'user' | 'sam';
  text: string;
  products?: Product[];
  listMode?: 'single' | 'catalog';
};

const ASK_CHIPS = [
  {
    id: 'have',
    label: 'What do you have?',
    icon: 'sparkles-outline' as const,
    prompt: 'What products do you have?',
  },
  {
    id: 'browse',
    label: 'Browse Products',
    icon: 'storefront-outline' as const,
    prompt: 'Show products',
  },
  { id: 'orders', label: 'My Orders', icon: 'receipt-outline' as const, prompt: null },
];

function readKeyboardOverlap(event?: KeyboardEvent) {
  const coords = event?.endCoordinates ?? Keyboard.metrics() ?? undefined;
  if (!coords) {
    return 0;
  }
  const screenH = Dimensions.get('screen').height;
  const byHeight = coords.height ?? 0;
  const byY = typeof coords.screenY === 'number' ? screenH - coords.screenY : 0;
  return Math.max(0, byHeight, byY);
}

function draftFromCart(items: CartItem[]): DraftViewLine[] {
  return items.map((item) => ({
    productId: item.product.id,
    name: item.product.name,
    quantity: item.quantity,
    unitPrice: item.product.price,
    lineTotal: item.product.price * item.quantity,
  }));
}

function cartFromDraft(lines: DraftViewLine[], catalog: Product[]): CartItem[] {
  return lines.flatMap((line) => {
    const product = catalog.find((row) => row.id === line.productId);
    if (!product || product.available === false) {
      return [];
    }
    return [{ product, quantity: line.quantity }];
  });
}

export default function SamScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, itemCount, totalAmount, addItem, increase, decrease, remove, replaceItems } = useCart();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const [browseQuery, setBrowseQuery] = useState('');
  const [ttsHold, setTtsHold] = useState(false);
  const [micArmed, setMicArmed] = useState(false);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const lastSuggestRef = useRef<Product[]>([]);
  const typingOpen = keyboardHeight > 0;
  const conversationOn = turns.length > 0 || items.length > 0;

  const liveMatches = useMemo(() => {
    const term = typed.trim();
    if (term.length < 3) {
      return [];
    }
    return filterCatalog(catalog, term).slice(0, 8);
  }, [catalog, typed]);

  const catalogTurn = useMemo(
    () => [...turns].reverse().find((turn) => turn.listMode === 'catalog' && turn.products?.length),
    [turns],
  );

  const visibleCatalog = useMemo(() => {
    const source = catalogTurn?.products ?? [];
    const term = browseQuery.trim();
    if (!term) {
      return source;
    }
    return source.filter((product) => matchesQuery(product, term));
  }, [browseQuery, catalogTurn]);

  const latestProducts = useMemo(() => {
    const turn = [...turns].reverse().find((row) => row.products?.length);
    if (!turn?.products) {
      return liveMatches;
    }
    if (turn.listMode === 'catalog') {
      return visibleCatalog.length > 0 ? visibleCatalog : liveMatches;
    }
    return turn.products;
  }, [liveMatches, turns, visibleCatalog]);

  lastSuggestRef.current = latestProducts;

  useEffect(() => {
    setSamDraftItems(draftFromCart(items));
  }, [items]);

  const speakReply = useCallback((text: string, lang: 'en' | 'ta' | 'mix') => {
    Speech.stop();
    setTtsHold(true);
    const release = () => setTtsHold(false);
    const timer = setTimeout(release, 60000);
    speakSam(text, lang, {
      onDone: () => {
        clearTimeout(timer);
        release();
      },
      onStopped: () => {
        clearTimeout(timer);
        release();
      },
      onError: () => {
        clearTimeout(timer);
        release();
      },
    }).catch(() => {
      clearTimeout(timer);
      release();
    });
  }, []);

  const pushTurn = useCallback((role: ChatTurn['role'], text: string, extra?: Pick<ChatTurn, 'products' | 'listMode'>) => {
    if (extra?.products?.length) {
      setBrowseQuery('');
    }
    setTurns((current) => {
      const next = extra?.products?.length
        ? current.map((turn) =>
            turn.products ? { ...turn, products: undefined, listMode: undefined } : turn,
          )
        : current;
      return [
        ...next,
        { id: `${Date.now()}-${role}-${next.length}`, role, text, ...extra },
      ];
    });
  }, []);

  const addFromCatalog = useCallback(
    (product: Product) => {
      if (product.available === false) {
        return;
      }
      addItem(product, 1);
      const msg = `Added ${product.name}.`;
      pushTurn('sam', msg);
      speakReply(msg, 'en');
    },
    [addItem, pushTurn, speakReply],
  );

  const reviewAndContinue = useCallback(
    async (source?: CartItem[]) => {
      const current = source ?? items;
      const fresh = await getAvailableProducts();
      setCatalog(fresh);
      const next = current.flatMap((item) => {
        const live = fresh.find((product) => product.id === item.product.id);
        if (!live || live.available === false || live.active === false) {
          return [];
        }
        return [{ product: live, quantity: item.quantity }];
      });
      if (current.length > 0 && next.length === 0) {
        replaceItems([]);
        pushTurn('sam', 'Those items are no longer available.');
        return;
      }
      replaceItems(next);
      router.push('/checkout');
    },
    [items, pushTurn, replaceItems, router],
  );

  const handleUtterance = useCallback(
    async (transcript: string) => {
      const text = transcript.trim();
      if (!text || busy) {
        return;
      }
      setMicArmed(false);
      pushTurn('user', text);
      if (isHowToOrder(text)) {
        pushTurn('sam', ORDER_HELP_REPLY);
        speakReply(ORDER_HELP_REPLY, 'en');
        return;
      }
      if (isAddThatOne(text)) {
        const pick = lastSuggestRef.current.find((product) => product.available !== false);
        if (!pick) {
          pushTurn('sam', 'Show products first, then say Add that one.');
          speakReply('Show products first, then say Add that one.', 'en');
          return;
        }
        addFromCatalog(pick);
        return;
      }
      const matched = productsForSamQuery(text, catalog);
      if (matched !== null) {
        const allCount = catalog.filter((product) => product.available !== false).length;
        const showingAll = matched.length === allCount && allCount > 0;
        const reply = browseReply(matched, showingAll);
        const listMode = browseListMode(matched, showingAll);
        pushTurn('sam', reply, matched.length ? { products: matched, listMode } : undefined);
        speakReply(reply, 'en');
        return;
      }
      if (isHeySam(text)) {
        const greeting = "Hi! What can I help you with?";
        pushTurn('sam', greeting);
        speakReply(greeting, 'en');
        return;
      }
      setBusy(true);
      Speech.stop();
      try {
        const result = await sendSamTurn(text, draftFromCart(items));
        setSamDraftItems(result.draft.items);
        setPendingNoteProductId(result.pendingNoteProductId);
        const fresh = catalog.length ? catalog : await getAvailableProducts();
        if (!catalog.length) {
          setCatalog(fresh);
        }
        const nextCart = cartFromDraft(result.draft.items, fresh);
        replaceItems(nextCart);
        pushTurn('sam', result.reply);
        speakReply(result.reply, result.language);

        if (result.canPlace) {
          await reviewAndContinue(nextCart);
        }
      } catch (turnError) {
        const message = turnError instanceof Error ? turnError.message : 'Something went wrong.';
        pushTurn('sam', message);
      } finally {
        setBusy(false);
      }
    },
    [addFromCatalog, busy, catalog, items, pushTurn, replaceItems, reviewAndContinue, speakReply],
  );

  const { listening, denied, start, stop } = useSamSpeech(
    micArmed && !busy && !ttsHold,
    handleUtterance,
  );

  useEffect(() => {
    const onShow = (event: KeyboardEvent) => {
      const next = readKeyboardOverlap(event);
      if (next > 40) {
        setKeyboardHeight(next);
      }
    };
    const onHide = () => setKeyboardHeight(0);
    const subs = [
      Keyboard.addListener('keyboardWillShow', onShow),
      Keyboard.addListener('keyboardDidShow', onShow),
      Keyboard.addListener('keyboardDidChangeFrame', onShow),
      Keyboard.addListener('keyboardWillHide', onHide),
      Keyboard.addListener('keyboardDidHide', onHide),
    ];
    return () => {
      subs.forEach((sub) => sub.remove());
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [turns, busy]);

  useFocusEffect(
    useCallback(() => {
      setPendingNoteProductId(getPendingNoteProductId());
      setMicArmed(true);
      getAvailableProducts()
        .then(setCatalog)
        .catch(() => setCatalog([]));
      return () => {
        Speech.stop();
        stop();
        setMicArmed(false);
      };
    }, [stop]),
  );

  function onClose() {
    Speech.stop();
    stop();
    setMicArmed(false);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  }

  function toggleMic() {
    if (micArmed || listening) {
      setMicArmed(false);
      stop();
      return;
    }
    setMicArmed(true);
    start().catch(() => undefined);
  }

  function submitTyped() {
    const value = typed.trim();
    if (!value || busy) {
      return;
    }
    setTyped('');
    Keyboard.dismiss();
    handleUtterance(value).catch(() => undefined);
  }

  const dockPad = keyboardHeight > 0 ? spacing.sm : insets.bottom + spacing.sm;

  function syncKeyboard() {
    const next = readKeyboardOverlap();
    if (next > 40) {
      setKeyboardHeight(next);
    }
  }

  const statusLabel = busy
    ? 'Sam is thinking...'
    : listening
      ? 'Listening...'
      : ttsHold
        ? 'Responding...'
        : null;

  return (
    <View style={[styles.screen, { paddingBottom: keyboardHeight }]}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={onClose}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.body}>
        {!conversationOn ? (
          <View style={[styles.landing, typingOpen && styles.landingCompact]}>
            {statusLabel ? <Text style={styles.status}>{statusLabel}</Text> : null}
            <Text style={styles.hello}>Hi, I'm Sam 👋</Text>
            <Text style={styles.question}>What are you looking for today?</Text>
            {typingOpen ? null : (
              <>
                <Text style={styles.support}>Speak or type — I'm here to help.</Text>
                <View style={styles.chips}>
                  {ASK_CHIPS.map((chip) => (
                    <Pressable
                      key={chip.id}
                      onPress={() => {
                        if (!chip.prompt) {
                          router.push('/orders');
                          return;
                        }
                        handleUtterance(chip.prompt).catch(() => undefined);
                      }}
                      disabled={busy}
                      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={chip.label}
                    >
                      <Ionicons name={chip.icon} size={15} color={colors.primaryDark} />
                      <Text style={styles.chipLabel}>{chip.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.thread}
            contentContainerStyle={styles.threadContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {statusLabel ? <Text style={styles.status}>{statusLabel}</Text> : null}
            {turns.map((turn) =>
              turn.role === 'user' ? (
                <View key={turn.id} style={styles.userWrap}>
                  <View style={styles.bubbleUser}>
                    <Text style={styles.bubbleTextUser}>{turn.text}</Text>
                  </View>
                </View>
              ) : (
                <View key={turn.id} style={styles.samWrap}>
                  <Text style={styles.bubbleText}>{turn.text}</Text>
                  {turn.products?.length && turn.listMode !== 'catalog' ? (
                    <View style={styles.browse}>
                      {turn.products.map((product) => (
                        <SamProductRow
                          key={product.id}
                          product={product}
                          onAdd={() => addFromCatalog(product)}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              ),
            )}
            {busy ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.sm }} /> : null}
            {items.length > 0 ? (
              <View style={styles.orderBlock}>
                <Text style={styles.orderHeading}>Your order</Text>
                {items.map((item, index) => (
                  <View key={item.product.id} style={index > 0 ? styles.orderLineDivided : undefined}>
                    <SamOrderLine
                      product={item.product}
                      quantity={item.quantity}
                      onIncrease={() => increase(item.product.id)}
                      onDecrease={() => decrease(item.product.id)}
                      onRemove={() => remove(item.product.id)}
                    />
                  </View>
                ))}
                <View style={styles.orderTotalRow}>
                  <Text style={styles.orderTotalLabel}>Total</Text>
                  <Text style={styles.orderTotalValue}>{formatPrice(totalAmount)}</Text>
                </View>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>

      {denied ? (
        <Text style={styles.micHint}>Microphone is off. You can type instead.</Text>
      ) : null}

      <View style={[styles.dock, { paddingBottom: dockPad }]}>
        <View style={styles.actionRow}>
          {itemCount > 0 ? (
            <Pressable
              onPress={() => reviewAndContinue().catch(() => undefined)}
              style={({ pressed }) => [styles.checkoutBar, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Checkout, ${itemCount} items, ${formatPrice(totalAmount)}`}
            >
              <Ionicons name="bag-handle" size={16} color={colors.primaryText} />
              <Text style={styles.checkoutTitle}>Checkout</Text>
              <Text style={styles.checkoutMeta} numberOfLines={1}>
                {itemCount} · {formatPrice(totalAmount)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primaryText} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={toggleMic}
            style={({ pressed }) => [
              styles.voicePrimary,
              itemCount > 0 && styles.voiceBeside,
              listening && styles.voicePrimaryLive,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Stop listening' : 'Start listening'}
          >
            <Ionicons
              name={listening ? 'mic' : 'mic-outline'}
              size={18}
              color={listening ? colors.primaryDark : colors.primaryText}
            />
            <Text style={[styles.voicePrimaryLabel, listening && styles.voicePrimaryLabelLive]}>
              {listening ? 'Listening' : 'Speak'}
            </Text>
          </Pressable>
        </View>
        {catalogTurn ? (
          <>
            <TextInput
              value={browseQuery}
              onChangeText={setBrowseQuery}
              placeholder="Search products..."
              placeholderTextColor={colors.textMuted}
              style={styles.browseSearch}
              autoCorrect={false}
              autoCapitalize="none"
              onFocus={() => {
                syncKeyboard();
                setTimeout(syncKeyboard, 80);
                setTimeout(syncKeyboard, 300);
              }}
            />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={[styles.liveList, typingOpen && styles.liveListKeyboard]}
            >
              {visibleCatalog.length === 0 ? (
                <Text style={styles.emptyBrowse}>No matching products right now.</Text>
              ) : (
                visibleCatalog.map((product) => (
                  <SamProductRow
                    key={product.id}
                    product={product}
                    onAdd={() => addFromCatalog(product)}
                  />
                ))
              )}
            </ScrollView>
          </>
        ) : liveMatches.length > 0 ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={[styles.liveList, typingOpen && styles.liveListKeyboard]}
            nestedScrollEnabled
          >
            {liveMatches.map((product) => (
              <SamProductRow key={product.id} product={product} onAdd={() => addFromCatalog(product)} />
            ))}
          </ScrollView>
        ) : null}
        <View style={styles.composer}>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder="Ask Sam anything..."
            placeholderTextColor={colors.textMuted}
            style={styles.composerInput}
            editable={!busy}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="send"
            onSubmitEditing={submitTyped}
            onFocus={() => {
              syncKeyboard();
              setTimeout(syncKeyboard, 80);
              setTimeout(syncKeyboard, 300);
            }}
          />
          <Pressable
            onPress={submitTyped}
            disabled={busy || !typed.trim()}
            style={({ pressed }) => [styles.send, pressed && styles.pressed, (busy || !typed.trim()) && styles.sendOff]}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <Ionicons name="arrow-up" size={18} color={colors.primaryText} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const CREAM = '#F6F1EA';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: CREAM,
  },
  body: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landing: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    paddingBottom: spacing.xl,
  },
  landingCompact: {
    justifyContent: 'flex-end',
    paddingBottom: spacing.sm,
  },
  status: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  hello: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: colors.text,
  },
  question: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  support: {
    marginTop: 6,
    marginBottom: spacing.lg,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    maxWidth: 320,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#18181B',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  chipLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  thread: {
    flex: 1,
    minHeight: 0,
  },
  threadContent: {
    paddingBottom: spacing.md,
    gap: 14,
  },
  userWrap: {
    alignItems: 'flex-end',
  },
  samWrap: {
    alignSelf: 'stretch',
    gap: 4,
    maxWidth: '100%',
  },
  bubbleUser: {
    maxWidth: '82%',
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.primary,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  bubbleTextUser: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.primaryText,
  },
  browse: {
    gap: 8,
    marginTop: spacing.sm,
  },
  catalogList: {
    maxHeight: 220,
  },
  browseSearch: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.sm,
    fontSize: 15,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  emptyBrowse: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  orderBlock: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#18181B',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  orderHeading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  orderLineDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  orderTotalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  orderTotalValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: colors.text,
  },
  liveList: {
    maxHeight: 168,
    marginBottom: spacing.sm,
  },
  liveListKeyboard: {
    maxHeight: 120,
  },
  checkoutBar: {
    flex: 1,
    minHeight: 44,
    minWidth: 0,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 6,
  },
  checkoutTitle: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '800',
  },
  checkoutMeta: {
    flexShrink: 1,
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.92,
  },
  micHint: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: spacing.lg,
  },
  dock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: CREAM,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E6DFD4',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    minHeight: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.md,
    paddingRight: 5,
  },
  composerInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  voicePrimary: {
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    alignSelf: 'center',
  },
  voiceBeside: {
    alignSelf: 'auto',
    flexShrink: 0,
  },
  voicePrimaryLive: {
    backgroundColor: colors.primarySoft,
  },
  voicePrimaryLabel: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '800',
  },
  voicePrimaryLabelLive: {
    color: colors.primaryDark,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.85,
  },
});
