import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatAddressForOrder, getSelectedAddress, loadAddressBook } from '@/cart/address-book';
import { colors, radius, spacing } from '@/config/theme';
import { sendSamTurn } from '@/sam/api';
import {
  clearSamSession,
  getPendingNoteProductId,
  getSamDraftItems,
  setPendingNoteProductId,
  setSamDraftItems,
} from '@/sam/session';
import { isHeySam, useSamSpeech } from '@/sam/useSamSpeech';
import { placeOrder } from '@/services/orders';
import { getAvailableProducts } from '@/services/products';
import { getSignedInUser } from '@/services/supabase';
import type { Product } from '@/types/product';
import { formatPrice } from '@/utils/format';

const COMMAND_WORDS = new Set([
  'add',
  'please',
  'i',
  'want',
  'need',
  'the',
  'a',
  'an',
  'to',
  'cart',
  'order',
  'one',
  'two',
  'three',
  'four',
  'five',
  'rendu',
  'oru',
  'moonu',
  'venum',
  'pannunga',
]);

function suggestionQuery(typed: string) {
  const parts = typed.trim().split(/\s+/).filter(Boolean);
  const rest = parts.filter((part) => {
    const lower = part.toLowerCase();
    return !COMMAND_WORDS.has(lower) && !/^\d+$/.test(part);
  });
  return (rest.join(' ') || parts[parts.length - 1] || '').trim().toLowerCase();
}

function applyProductName(typed: string, name: string) {
  const parts = typed.trim().split(/\s+/).filter(Boolean);
  const prefix: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (COMMAND_WORDS.has(lower) || /^\d+$/.test(part)) {
      prefix.push(part);
      continue;
    }
    break;
  }
  if (prefix.length === 0) {
    return `Add 1 ${name}`;
  }
  return `${prefix.join(' ')} ${name}`;
}

export default function SamScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [reply, setReply] = useState("Hi! I'm Sam. What can I help you with?");
  const [draftItems, setDraftItems] = useState(getSamDraftItems());
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const [showType, setShowType] = useState(false);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const pulse = useState(() => new Animated.Value(1))[0];

  const suggestions = useMemo(() => {
    const term = suggestionQuery(typed);
    if (term.length < 2) {
      return [];
    }
    return catalog
      .filter((product) => product.available !== false)
      .filter((product) => {
        const name = product.name.toLowerCase();
        return name.includes(term) || term.split(' ').every((word) => word.length < 2 || name.includes(word));
      })
      .slice(0, 6);
  }, [catalog, typed]);

  const speakReply = useCallback((text: string, lang: 'en' | 'ta' | 'mix') => {
    Speech.stop();
    Speech.speak(text, { language: lang === 'ta' ? 'ta-IN' : 'en-IN', rate: 0.95 });
  }, []);

  const handleUtterance = useCallback(
    async (transcript: string) => {
      const text = transcript.trim();
      if (!text || busy) {
        return;
      }
      if (isHeySam(text)) {
        const greeting = "Hi! What can I help you with?";
        setReply(greeting);
        speakReply(greeting, 'en');
        return;
      }
      setBusy(true);
      Speech.stop();
      try {
        const result = await sendSamTurn(text, getSamDraftItems());
        setSamDraftItems(result.draft.items);
        setPendingNoteProductId(result.pendingNoteProductId);
        setDraftItems(result.draft.items);
        setTotal(result.draft.total);
        setReply(result.reply);
        speakReply(result.reply, result.language);

        if (result.canPlace) {
          const user = await getSignedInUser();
          if (!user) {
            setReply('Please sign in with your mobile number to place the order.');
            router.push({ pathname: '/login', params: { next: 'sam' } });
            return;
          }
          await loadAddressBook();
          const address = getSelectedAddress();
          if (!address) {
            setReply('Add a delivery address, then say Confirm to place the order.');
            router.push('/checkout');
            return;
          }
          const catalog = await getAvailableProducts();
          const items = result.draft.items.map((line) => {
            const product = catalog.find((row) => row.id === line.productId);
            if (!product || product.available === false) {
              throw new Error('An item is no longer available.');
            }
            return { product, quantity: line.quantity };
          });
          const order = await placeOrder(
            {
              name: address.name,
              mobile: address.mobile,
              address: formatAddressForOrder(address),
              pincode: address.pincode,
              addressId: address.id,
            },
            items,
          );
          clearSamSession();
          setDraftItems([]);
          setTotal(0);
          router.replace({
            pathname: '/confirmation',
            params: {
              id: order.id,
              orderNumber: order.order_number != null ? String(order.order_number) : '',
              status: order.status,
              payment: order.payment_method ?? 'pending',
            },
          });
        }
      } catch (turnError) {
        const message = turnError instanceof Error ? turnError.message : 'Something went wrong.';
        setReply(message);
        setShowType(true);
      } finally {
        setBusy(false);
      }
    },
    [busy, router, speakReply],
  );

  const { listening, denied, error: speechError, stop } = useSamSpeech(!busy, handleUtterance);

  useEffect(() => {
    if (denied || speechError) {
      setShowType(true);
    }
  }, [denied, speechError]);

  useEffect(() => {
    if (!listening) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);

  useFocusEffect(
    useCallback(() => {
      setDraftItems(getSamDraftItems());
      setPendingNoteProductId(getPendingNoteProductId());
      getAvailableProducts()
        .then(setCatalog)
        .catch(() => setCatalog([]));
      return () => {
        Speech.stop();
        stop();
      };
    }, [stop]),
  );

  function onExit() {
    Speech.stop();
    stop();
    router.back();
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.top}>
        <Text style={styles.brand}>F2F</Text>
        <Pressable onPress={onExit} style={styles.exit} accessibilityRole="button" accessibilityLabel="Exit Sam">
          <Text style={styles.exitLabel}>Exit</Text>
        </Pressable>
      </View>

      <View style={styles.center}>
        <Text style={styles.name}>SAM</Text>
        <Animated.View style={[styles.pulse, { transform: [{ scale: pulse }] }]}>
          <Ionicons name={listening ? 'mic' : 'mic-outline'} size={36} color={colors.primaryDark} />
        </Animated.View>
        <Text style={styles.state}>
          {busy ? 'Thinking…' : listening ? 'Listening' : showType ? 'Type below' : 'Ready'}
        </Text>
        <Text style={styles.reply}>{reply}</Text>
        {draftItems.length > 0 ? (
          <View style={styles.draft}>
            {draftItems.map((item) => (
              <Text key={item.productId} style={styles.draftLine}>
                {item.quantity} × {item.name}
              </Text>
            ))}
            <Text style={styles.total}>Total {formatPrice(total)}</Text>
          </View>
        ) : null}
        {busy ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} /> : null}
      </View>

      {showType || denied || speechError ? (
        <View style={styles.fallback}>
          <Text style={styles.fallbackHint}>
            {speechError || (denied ? 'Microphone permission is off. You can type your request instead.' : 'Having trouble hearing you? You can type your request instead.')}
          </Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder="Type a product name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            editable={!busy}
            autoCorrect={false}
            autoCapitalize="none"
            onSubmitEditing={() => {
              const value = typed.trim();
              if (!value) {
                return;
              }
              setTyped('');
              handleUtterance(value).catch(() => undefined);
            }}
          />
          {suggestions.length > 0 ? (
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.suggestList}>
              {suggestions.map((product) => (
                <Pressable
                  key={product.id}
                  style={styles.suggestRow}
                  onPress={() => setTyped(applyProductName(typed, product.name))}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${product.name}`}
                >
                  <Text style={styles.suggestName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.suggestPrice}>{formatPrice(product.price)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : (
        <Pressable onPress={() => setShowType(true)} accessibilityRole="button">
          <Text style={styles.typeLink}>Type instead</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F4F5',
    paddingHorizontal: spacing.lg,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.primaryDark,
  },
  exit: {
    minHeight: 44,
    justifyContent: 'center',
  },
  exitLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 2,
  },
  pulse: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  state: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
    letterSpacing: 0.4,
  },
  reply: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  draft: {
    marginTop: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  draftLine: {
    fontSize: 15,
    color: colors.textMuted,
  },
  total: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  fallback: {
    gap: spacing.sm,
  },
  fallbackHint: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  suggestList: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  suggestRow: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  suggestPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  typeLink: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    paddingVertical: spacing.sm,
  },
});
