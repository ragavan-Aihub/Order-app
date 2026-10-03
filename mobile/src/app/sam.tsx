import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MAX_SAVED_ADDRESSES,
  formatAddressForOrder,
  formatSavedAddressLabel,
  formatSavedAddressLine,
  getAddressBook,
  getSelectedAddress,
  loadAddressBook,
  selectAddress,
  subscribeAddressBook,
  type SavedAddress,
} from '@/cart/address-book';
import { useCart, type CartItem } from '@/cart/CartContext';
import { MAX_ITEM_QTY } from '@/cart/limits';
import { tryLockModify, unlockModify } from '@/cart/modify-flow';
import { loadOrderItemsForEdit } from '@/cart/modify-order';
import { submitShopOrder } from '@/cart/submit-order';
import { OrderProgress } from '@/components/OrderProgress';
import { SamOrderLine, SamProductRow } from '@/components/SamProductRow';
import { colors, radius, spacing } from '@/config/theme';
import {
  browseListMode,
  browseReply,
  filterCatalog,
  isAddThatOne,
  isFillerUtterance,
  isFullCatalogAsk,
  isHowToOrder,
  looksLikeAddOrder,
  matchesQuery,
  ORDER_HELP_REPLY,
  productsForSamQuery,
} from '@/sam/browse-catalog';
import {
  OPEN_ORDER_CHIPS,
  commandSuggestions,
  isCancelOrder,
  isModifyOrder,
  isNewAddress,
  isPlaceNewOrder,
  isPlaceOrConfirm,
  isWhatsInMyOrder,
  isWhereIsMyOrder,
  mentionsExistingOrder,
  utteranceKey,
} from '@/sam/commands';
import { NewOrderAddressPicker } from '@/sam/NewOrderAddressPicker';
import { SamVoiceOverlay } from '@/sam/SamVoiceOverlay';
import { sendSamTurn } from '@/sam/api';
import { speakSam } from '@/sam/speak';
import { getPendingNoteProductId, setPendingNoteProductId, setSamDraftItems } from '@/sam/session';
import type { DraftViewLine } from '@/sam/types';
import { useSamSpeech } from '@/sam/useSamSpeech';
import { cancelMyOrder, findOpenOrderForAddress, listMyOrderItems } from '@/services/orders';
import { getAvailableProducts } from '@/services/products';
import { getSignedInUser } from '@/services/supabase';
import type { Product } from '@/types/product';
import { isOpenOrderStatus, isUndeliveredOrder, type Order } from '@/types/order';
import { formatOrderNumber, formatOrderStatus, formatPrice } from '@/utils/format';
import {
  canModifyExistingOrder,
  findLatestOrderForAddress,
  lockedOrderMessage,
  newOrderEligibilityForAddresses,
  type AddressNewOrderRow,
} from '@/cart/open-cart-guard';

type ChatTurn = {
  id: string;
  role: 'user' | 'sam';
  text: string;
  products?: Product[];
  listMode?: 'single' | 'catalog';
  modifyOrderId?: string;
  cancelOrderId?: string;
  orderStatus?: string;
  choices?: { id: string; label: string; prompt: string }[];
};

const ASK_CHIPS = [
  {
    id: 'browse',
    label: 'Browse products',
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

function isConfirmCancelUtterance(text: string) {
  const t = utteranceKey(text);
  return (
    t === 'confirm' ||
    t === 'yes' ||
    t === 'ok' ||
    t === 'okay' ||
    t === 'seri' ||
    t === 'aama' ||
    t === 'aamaam' ||
    isCancelOrder(text)
  );
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
  const {
    items,
    itemCount,
    totalAmount,
    addItem,
    increase,
    decrease,
    remove,
    replaceItems,
    clearCart,
    editingOrderId,
    beginEditOrder,
    markOrderSaved,
    forgetOpenOrder,
    openOrder,
    hasOrderChanges,
  } = useCart();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyKind, setBusyKind] = useState<'think' | 'place' | 'modify' | 'save' | 'cancel' | null>(null);
  const [typed, setTyped] = useState('');
  const [browseQuery, setBrowseQuery] = useState('');
  const [ttsHold, setTtsHold] = useState(false);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [pickNewAddress, setPickNewAddress] = useState(false);
  const [addressRows, setAddressRows] = useState<AddressNewOrderRow[]>([]);
  const [addressRowsLoading, setAddressRowsLoading] = useState(false);
  const [trackableOrder, setTrackableOrder] = useState<Order | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const lastSuggestRef = useRef<Product[]>([]);
  const waitingForConfirmRef = useRef(false);
  const qtySpeakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qtySpeakPending = useRef<{ name: string; quantity: number; atMax?: boolean } | null>(null);
  const qtyLive = useRef<Record<string, number>>({});
  const lastUtterance = useRef({ key: '', at: 0 });
  const pendingCancelId = useRef<string | null>(null);
  const typingOpen = keyboardHeight > 0;
  const editingOpen = Boolean(openOrder && editingOrderId === openOrder.id);
  const conversationOn = turns.length > 0 || editingOpen || pickNewAddress || (items.length > 0 && !openOrder);
  const canShopNewOrder = editingOpen || Boolean(selectedAddress && !openOrder);

  const liveMatches = useMemo(() => {
    const term = typed.trim();
    if (term.length < 1) {
      return [];
    }
    return filterCatalog(catalog, term).slice(0, 8);
  }, [catalog, typed]);

  const typedCommands = useMemo(() => commandSuggestions(typed), [typed]);

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
    const next: Record<string, number> = {};
    for (const item of items) {
      next[item.product.id] = item.quantity;
    }
    qtyLive.current = next;
  }, [items]);

  useEffect(() => {
    return () => {
      if (qtySpeakTimer.current) {
        clearTimeout(qtySpeakTimer.current);
      }
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
    };
  }, []);

  const flashNotice = useCallback((text: string) => {
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(null), 1600);
  }, []);

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

  const pushTurn = useCallback(
    (
      role: ChatTurn['role'],
      text: string,
    extra?: Pick<ChatTurn, 'products' | 'listMode' | 'modifyOrderId' | 'cancelOrderId' | 'orderStatus' | 'choices'>,
    ) => {
    if (extra?.products?.length) {
      setBrowseQuery('');
    }
    setTurns((current) => {
      if (role === 'sam') {
        const lastSam = [...current].reverse().find((turn) => turn.role === 'sam');
        if (
          lastSam &&
          lastSam.text === text &&
          lastSam.modifyOrderId === extra?.modifyOrderId &&
          lastSam.cancelOrderId === extra?.cancelOrderId
        ) {
          return current;
        }
      }
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

  const speakQtyChange = useCallback(
    (name: string, quantity: number, atMax = false) => {
      qtySpeakPending.current = { name, quantity, atMax };
      if (qtySpeakTimer.current) {
        clearTimeout(qtySpeakTimer.current);
      }
      qtySpeakTimer.current = setTimeout(() => {
        const pending = qtySpeakPending.current;
        qtySpeakPending.current = null;
        if (!pending) {
          return;
        }
        const msg =
          pending.quantity < 1
            ? `Removed ${pending.name}.`
            : pending.atMax
              ? `${pending.name} is now ${pending.quantity}. That's the most you can add.`
              : `${pending.name} is now ${pending.quantity}.`;
        flashNotice(
          pending.quantity < 1
            ? 'Removed'
            : pending.atMax
              ? `Qty ${pending.quantity} • Max reached`
              : `Qty ${pending.quantity}`,
        );
        speakReply(msg, 'en');
      }, 600);
    },
    [flashNotice, speakReply],
  );

  const beginNewOrderPick = useCallback((_title?: string) => {
    Keyboard.dismiss();
    setTyped('');
    setPickNewAddress(true);
    speakReply('Where should we deliver your new order?', 'en');
  }, [speakReply]);

  const addFromCatalog = useCallback(
    (product: Product) => {
      if (product.available === false) {
        return;
      }
      if (!editingOpen && !canShopNewOrder) {
        beginNewOrderPick('Choose a delivery address for your new order.');
        return;
      }
      const added = addItem(product, 1);
      if (!added) {
        return;
      }
      setTyped('');
      setBrowseQuery('');
      Keyboard.dismiss();
      const quantity = (qtyLive.current[product.id] ?? 0) + 1;
      qtyLive.current[product.id] = quantity;
      flashNotice(`Added • Qty ${quantity}`);
      speakReply(`Added ${product.name}.`, 'en');
    },
    [addItem, beginNewOrderPick, canShopNewOrder, editingOpen, flashNotice, speakReply],
  );

  const refreshAddresses = useCallback(async () => {
    const list = await loadAddressBook();
    setAddresses(list);
    const selected = getSelectedAddress();
    setSelectedAddress(selected);
    if (!selected) {
      setTrackableOrder(null);
      return;
    }
    if (openOrder) {
      setTrackableOrder(openOrder);
      return;
    }
    const latest = await findLatestOrderForAddress({
      addressId: selected.id,
      address: formatAddressForOrder(selected),
      pincode: selected.pincode,
    });
    setTrackableOrder(latest && isUndeliveredOrder(latest.status) ? latest : null);
  }, [openOrder]);

  const cancelOpenOrder = useCallback(
    async (orderId: string) => {
      pendingCancelId.current = null;
      setBusy(true);
      setBusyKind('cancel');
      Speech.stop();
      try {
        const cancelled = await cancelMyOrder(orderId);
        clearCart();
        forgetOpenOrder(orderId);
        setTrackableOrder((current) => (current?.id === orderId ? null : current));
        setTurns((current) =>
          current.map((turn) =>
            turn.orderStatus && turn.orderStatus !== 'cancelled'
              ? {
                  ...turn,
                  orderStatus: 'cancelled',
                  text: `Order #${formatOrderNumber(cancelled.order_number)} is Cancelled.`,
                  cancelOrderId: undefined,
                  modifyOrderId: undefined,
                }
              : turn,
          ),
        );
        const msg = `Cancelled order #${formatOrderNumber(cancelled.order_number)}.`;
        pushTurn('sam', msg);
        speakReply(msg, 'en');
      } catch (cancelError) {
        const msg = cancelError instanceof Error ? cancelError.message : 'Could not cancel that order.';
        pushTurn('sam', msg);
        speakReply(msg, 'en');
      } finally {
        setBusy(false);
        setBusyKind(null);
      }
    },
    [clearCart, forgetOpenOrder, pushTurn, speakReply],
  );

  const loadExistingCart = useCallback(
    async (orderId: string) => {
      if (!orderId) {
        return false;
      }
      if (editingOrderId === orderId && items.length > 0) {
        return true;
      }
      if (!tryLockModify()) {
        const msg = 'Still loading that order. Try again in a moment.';
        pushTurn('sam', msg);
        speakReply(msg, 'en');
        return false;
      }
      setBusy(true);
      setBusyKind('modify');
      Speech.stop();
      setPickNewAddress(false);
      try {
        const next = await loadOrderItemsForEdit(orderId, undefined, catalog);
        if (next === null) {
          const msg = 'I could not load that order.';
          pushTurn('sam', msg);
          speakReply(msg, 'en');
          return false;
        }
        beginEditOrder(orderId, next);
        return true;
      } catch (modifyError) {
        const msg = modifyError instanceof Error ? modifyError.message : 'I could not load that order.';
        pushTurn('sam', msg);
        speakReply(msg, 'en');
        return false;
      } finally {
        unlockModify();
        setBusy(false);
        setBusyKind(null);
      }
    },
    [beginEditOrder, catalog, editingOrderId, items.length, pushTurn, speakReply],
  );

  const startModify = useCallback(
    async (orderId: string) => {
      const already = editingOrderId === orderId && items.length > 0;
      const loaded = await loadExistingCart(orderId);
      if (!loaded) {
        return;
      }
      const number = openOrder?.id === orderId ? formatOrderNumber(openOrder.order_number) : '';
      const msg = already
        ? 'That order is already loaded. Search to add items, then tap Update.'
        : number
          ? `Editing order #${number}. Search or say a product to add, then tap Update.`
          : 'That order is loaded. Search or say a product to add, then tap Update.';
      pushTurn('sam', msg);
      speakReply(msg, 'en');
    },
    [editingOrderId, items.length, loadExistingCart, openOrder, pushTurn, speakReply],
  );

  const requestCancelOrder = useCallback(
    async (orderId: string, orderNumber?: number) => {
      pendingCancelId.current = orderId;
      const number = orderNumber != null ? formatOrderNumber(orderNumber) : '';
      const msg = number
        ? `Cancel order #${number}? Say Confirm, or tap Cancel order.`
        : 'Cancel this order? Say Confirm, or tap Cancel order.';
      pushTurn('sam', msg);
      speakReply(msg, 'en');
      const keep = () => {
        if (pendingCancelId.current !== orderId) {
          return;
        }
        pendingCancelId.current = null;
        const kept = number
          ? `Okay, order #${number} is not cancelled. It stays as it is.`
          : 'Okay, your order is not cancelled. It stays as it is.';
        pushTurn('sam', kept);
        speakReply(kept, 'en');
      };
      Alert.alert(
        'Cancel order?',
        number ? `Cancel order #${number}? This cannot be undone.` : 'This cannot be undone.',
        [
          { text: 'Keep order', style: 'cancel', onPress: keep },
          {
            text: 'Cancel order',
            style: 'destructive',
            onPress: () => {
              void cancelOpenOrder(orderId);
            },
          },
        ],
        { cancelable: true, onDismiss: keep },
      );
    },
    [cancelOpenOrder, pushTurn, speakReply],
  );

  const resolveOpen = useCallback(async () => {
    if (openOrder) {
      return openOrder;
    }
    const selected = selectedAddress ?? getSelectedAddress();
    return findOpenOrderForAddress({
      addressId: selected?.id,
      address: selected ? formatAddressForOrder(selected) : undefined,
      pincode: selected?.pincode,
    });
  }, [openOrder, selectedAddress]);

  const offerPlaceNewChoice = useCallback(
    (_open: { order_number: number }) => {
      beginNewOrderPick('Choose a delivery address for your new order.');
    },
    [beginNewOrderPick],
  );

  const chooseNewOrderAddress = useCallback(
    async (address: SavedAddress) => {
      const blocking = await findOpenOrderForAddress({
        addressId: address.id,
        address: formatAddressForOrder(address),
        pincode: address.pincode,
      });
      if (blocking) {
        const rows = await newOrderEligibilityForAddresses(getAddressBook());
        setAddressRows(rows);
        speakReply(
          `You already have order ${formatOrderNumber(blocking.order_number)} going to ${formatSavedAddressLabel(address.label)}. You can modify it, or choose another address.`,
          'en',
        );
        return;
      }
      await selectAddress(address.id);
      setSelectedAddress(getSelectedAddress());
      setPickNewAddress(false);
      const msg = `Delivering your new order to ${formatSavedAddressLabel(address.label)}. Search to add items.`;
      pushTurn('sam', msg);
      speakReply(msg, 'en');
    },
    [pushTurn, speakReply],
  );

  const tellWhereIsOrder = useCallback(async () => {
    const selected = selectedAddress ?? getSelectedAddress();
    const order =
      (openOrder && isUndeliveredOrder(openOrder.status) ? openOrder : null) ??
      (trackableOrder && isUndeliveredOrder(trackableOrder.status) ? trackableOrder : null) ??
      (await findLatestOrderForAddress({
        addressId: selected?.id,
        address: selected ? formatAddressForOrder(selected) : undefined,
        pincode: selected?.pincode,
      }));
    if (!order || !isUndeliveredOrder(order.status)) {
      const msg = 'There is no order in progress for this address.';
      pushTurn('sam', msg);
      speakReply(msg, 'en');
      return;
    }
    const msg = `Order #${formatOrderNumber(order.order_number)} is ${formatOrderStatus(order.status)}.`;
    pushTurn('sam', msg, { orderStatus: order.status });
    speakReply(msg, 'en');
  }, [openOrder, pushTurn, selectedAddress, speakReply, trackableOrder]);

  const tellWhatsInOrder = useCallback(async () => {
    const selected = selectedAddress ?? getSelectedAddress();
    const order =
      (openOrder && isUndeliveredOrder(openOrder.status) ? openOrder : null) ??
      (trackableOrder && isUndeliveredOrder(trackableOrder.status) ? trackableOrder : null) ??
      (await findLatestOrderForAddress({
        addressId: selected?.id,
        address: selected ? formatAddressForOrder(selected) : undefined,
        pincode: selected?.pincode,
      }));
    if (!order || !isUndeliveredOrder(order.status)) {
      const msg = 'There is no order in progress for this address.';
      pushTurn('sam', msg);
      speakReply(msg, 'en');
      return;
    }
    const fromCart =
      items.length > 0 && editingOrderId === order.id
        ? items.map((item) => ({ product_name: item.product.name, quantity: item.quantity }))
        : [];
    const loaded = fromCart.length ? fromCart : await listMyOrderItems(order.id);
    if (!loaded) {
      const msg = 'I could not load the items for this order. Try again in a moment.';
      pushTurn('sam', msg);
      speakReply(msg, 'en');
      return;
    }
    const lines = loaded.filter((line) => line.product_name && line.quantity > 0);
    if (lines.length === 0) {
      const msg = `Order #${formatOrderNumber(order.order_number)} has no items yet.`;
      pushTurn('sam', msg);
      speakReply(msg, 'en');
      return;
    }
    const listed = lines.map((line) => `${line.product_name} ${line.quantity}`).join(', ');
    const msg = `Order #${formatOrderNumber(order.order_number)} has ${listed}.`;
    pushTurn('sam', msg);
    speakReply(msg, 'en');
  }, [editingOrderId, items, openOrder, pushTurn, selectedAddress, speakReply, trackableOrder]);

  const placeFromChat = useCallback(async () => {
    if (!editingOrderId) {
      const user = await getSignedInUser();
      if (!user) {
        const msg = 'Sign in to place your order.';
        pushTurn('sam', msg);
        speakReply(msg, 'en');
        router.push({ pathname: '/login', params: { next: 'sam' } });
        return;
      }
    }
    if (items.length === 0) {
      const msg = 'Add an item first, then tap Place order.';
      pushTurn('sam', msg);
      speakReply(msg, 'en');
      return;
    }
    if (editingOrderId && !hasOrderChanges) {
      const msg = 'No changes to save yet. Add or change an item first.';
      pushTurn('sam', msg);
      speakReply(msg, 'en');
      return;
    }
    const selected = selectedAddress ?? getSelectedAddress();
    if (!selected) {
      const msg = 'Add a delivery address, then tap Place order.';
      pushTurn('sam', msg);
      speakReply(msg, 'en');
      router.push({ pathname: '/address/form', params: { next: 'sam' } });
      return;
    }
    setBusy(true);
    setBusyKind(editingOrderId ? 'save' : 'place');
    try {
      Speech.stop();
      const result = await submitShopOrder(items, selected, editingOrderId);
      if (!result.ok) {
        if (result.reason === 'auth') {
          router.push({ pathname: '/login', params: { next: 'sam' } });
        }
        if (result.reason === 'open_order' && result.openOrder) {
          offerPlaceNewChoice(result.openOrder);
          return;
        }
        pushTurn('sam', result.message);
        speakReply(result.message, 'en');
        return;
      }
      const wasEditing = Boolean(editingOrderId);
      clearCart();
      setPickNewAddress(false);
      speakReply(
        wasEditing
          ? `Order ${result.order.order_number} updated.`
          : `Order ${result.order.order_number} placed.`,
        'en',
      );
      router.replace({
        pathname: '/confirmation',
        params: {
          id: result.order.id,
          orderNumber: String(result.order.order_number ?? ''),
          status: result.order.status,
          total: String(result.order.total_amount),
          fresh: wasEditing ? 'updated' : 'placed',
        },
      });
    } catch (placeError) {
      const msg = placeError instanceof Error ? placeError.message : 'Could not place the order.';
      pushTurn('sam', msg);
      speakReply(msg, 'en');
    } finally {
      setBusy(false);
      setBusyKind(null);
    }
  }, [
    beginEditOrder,
    clearCart,
    editingOrderId,
    hasOrderChanges,
    items,
    markOrderSaved,
    offerPlaceNewChoice,
    pushTurn,
    refreshAddresses,
    router,
    selectedAddress,
    speakReply,
  ]);

  const handleUtterance = useCallback(
    async (transcript: string) => {
      const text = transcript.trim();
      if (!text) {
        return;
      }
      const localCommand =
        isCancelOrder(text) ||
        isWhereIsMyOrder(text) ||
        isWhatsInMyOrder(text) ||
        isModifyOrder(text) ||
        isPlaceNewOrder(text) ||
        isNewAddress(text) ||
        isPlaceOrConfirm(text) ||
        isConfirmCancelUtterance(text);
      if (busy && (busyKind === 'place' || busyKind === 'save' || busyKind === 'cancel')) {
        return;
      }
      if (busy && !localCommand) {
        return;
      }
      if (busy && busyKind === 'think') {
        setBusy(false);
        setBusyKind(null);
      }
      const key = utteranceKey(text);
      const now = Date.now();
      if (key && lastUtterance.current.key === key && now - lastUtterance.current.at < 2500) {
        return;
      }
      lastUtterance.current = { key, at: now };
      pushTurn('user', text);
      if (pendingCancelId.current) {
        const pendingId = pendingCancelId.current;
        if (isConfirmCancelUtterance(text)) {
          pendingCancelId.current = null;
          await cancelOpenOrder(pendingId);
          return;
        }
        pendingCancelId.current = null;
        const key = utteranceKey(text);
        if (/^(no|nope|keep|keep (it|order|my order)|dont cancel|do not cancel|vendam|venam|illa)$/.test(key)) {
          const kept = 'Okay, your order is not cancelled. It stays as it is.';
          pushTurn('sam', kept);
          speakReply(kept, 'en');
          return;
        }
      }
      if (isFillerUtterance(text)) {
        const hint = 'Say a product name, or say Show products.';
        pushTurn('sam', hint);
        speakReply(hint, 'en');
        return;
      }
      if (isWhereIsMyOrder(text)) {
        await tellWhereIsOrder();
        return;
      }
      if (isWhatsInMyOrder(text)) {
        try {
          await tellWhatsInOrder();
        } catch {
          const msg = 'I could not load what is in this order. Try again.';
          pushTurn('sam', msg);
          speakReply(msg, 'en');
        }
        return;
      }
      if (isPlaceNewOrder(text) || isNewAddress(text)) {
        beginNewOrderPick('Where should we deliver your new order?');
        return;
      }
      if (isPlaceOrConfirm(text)) {
        await placeFromChat();
        return;
      }
      let allowShop = canShopNewOrder;
      if (isModifyOrder(text) || (mentionsExistingOrder(text) && looksLikeAddOrder(text))) {
        const selected = selectedAddress ?? getSelectedAddress();
        const details = {
          addressId: selected?.id,
          address: selected ? formatAddressForOrder(selected) : undefined,
          pincode: selected?.pincode,
        };
        const open = await findOpenOrderForAddress(details);
        if (canModifyExistingOrder(open) && open) {
          await startModify(open.id);
          allowShop = true;
          if (isModifyOrder(text) && !looksLikeAddOrder(text)) {
            return;
          }
        } else {
          const latest = await findLatestOrderForAddress(details);
          if (latest?.status === 'out_for_delivery') {
            const msg = lockedOrderMessage(latest);
            pushTurn('sam', msg);
            speakReply(msg, 'en');
            beginNewOrderPick('Choose a delivery address for your new order.');
            return;
          }
          if (isModifyOrder(text)) {
            const msg = 'There is no open order to change for this address.';
            pushTurn('sam', msg);
            speakReply(msg, 'en');
            return;
          }
        }
      }
      if (isCancelOrder(text)) {
        const open = await resolveOpen();
        if (!open) {
          const msg = 'There is no open order to cancel.';
          pushTurn('sam', msg);
          speakReply(msg, 'en');
          return;
        }
        await requestCancelOrder(open.id, open.order_number);
        return;
      }
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
      let shop = catalog;
      if (shop.length === 0) {
        try {
          shop = await getAvailableProducts();
          setCatalog(shop);
        } catch {
          shop = [];
        }
      }
      const matched = productsForSamQuery(text, shop);
      if (matched !== null) {
        const availableHits = matched.filter((product) => product.available !== false);
        const wantsAdd = looksLikeAddOrder(text);
        if (wantsAdd && !allowShop) {
          beginNewOrderPick('Choose a delivery address for your new order.');
          return;
        }
        if (wantsAdd && availableHits.length === 1 && !/\d/.test(text)) {
          addFromCatalog(availableHits[0]);
          return;
        }
        if (wantsAdd && availableHits.length === 0) {
          // Fall through to the shop API so quantity and catalog matching can still run.
        } else {
          const allCount = shop.filter((product) => product.available !== false).length;
          const showingAll = isFullCatalogAsk(text) || (matched.length === allCount && allCount > 0);
          const reply = browseReply(matched, showingAll);
          const listMode = browseListMode(matched, showingAll);
          pushTurn('sam', reply, matched.length ? { products: matched, listMode } : undefined);
          speakReply(reply, 'en');
          return;
        }
      }
      if (!allowShop && looksLikeAddOrder(text)) {
        beginNewOrderPick('Choose a delivery address for your new order.');
        return;
      }
      setBusy(true);
      setBusyKind('think');
      Speech.stop();
      try {
        const result = await sendSamTurn(text, draftFromCart(items), {
          recentTurns: turns.slice(-4).map((turn) => ({ role: turn.role, text: turn.text })),
          displayedNames: lastSuggestRef.current.map((product) => product.name),
          waitingForConfirm: waitingForConfirmRef.current,
        });
        waitingForConfirmRef.current = result.conversationState === 'WAITING_FOR_CONFIRMATION';
        setSamDraftItems(result.draft.items);
        setPendingNoteProductId(result.pendingNoteProductId);
        const fresh = catalog.length ? catalog : await getAvailableProducts();
        if (!catalog.length) {
          setCatalog(fresh);
        }
        const nextCart = cartFromDraft(result.draft.items, fresh);
        if (allowShop || editingOpen) {
          replaceItems(nextCart);
        }
        pushTurn('sam', result.reply);
        speakReply(result.reply, result.language);
      } catch (turnError) {
        const raw = turnError instanceof Error ? turnError.message : 'Something went wrong.';
        const message = /cleartext|UnknownServiceException/i.test(raw)
          ? 'Cannot reach the shop on this Wi-Fi yet. Keep the admin app running, or type Show products.'
          : raw;
        pushTurn('sam', message);
      } finally {
        setBusy(false);
        setBusyKind(null);
      }
    },
    [
      addFromCatalog,
      busy,
      busyKind,
      cancelOpenOrder,
      beginNewOrderPick,
      canShopNewOrder,
      catalog,
      items,
      turns,
      requestCancelOrder,
      offerPlaceNewChoice,
      placeFromChat,
      pushTurn,
      replaceItems,
      resolveOpen,
      selectedAddress,
      speakReply,
      startModify,
      tellWhatsInOrder,
      tellWhereIsOrder,
    ],
  );

  const {
    listening,
    denied,
    error,
    partial,
    volume,
    startListening,
    finishListening,
    cancelListening,
    stopAll: stop,
  } = useSamSpeech({
    paused: busy || ttsHold || pickNewAddress,
    onCommand: (text) => {
      handleUtterance(text).catch(() => undefined);
    },
  });

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

  useEffect(() => {
    if (!pickNewAddress) {
      return;
    }
    let active = true;
    setAddressRowsLoading(true);
    newOrderEligibilityForAddresses(addresses)
      .then((rows) => {
        if (active) {
          setAddressRows(rows);
        }
      })
      .catch(() => {
        if (active) {
          setAddressRows(addresses.map((address) => ({ address, blockingOrder: null })));
        }
      })
      .finally(() => {
        if (active) {
          setAddressRowsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [addresses, pickNewAddress]);

  useFocusEffect(
    useCallback(() => {
      setPendingNoteProductId(getPendingNoteProductId());
      refreshAddresses().catch(() => undefined);
      getAvailableProducts()
        .then(setCatalog)
        .catch(() => setCatalog([]));
      return () => {
        Speech.stop();
        stop();
      };
    }, [refreshAddresses, stop]),
  );

  useEffect(() => {
    return subscribeAddressBook(() => {
      setAddresses(getAddressBook());
      setSelectedAddress(getSelectedAddress());
    });
  }, []);

  useEffect(() => {
    if (listening) {
      Vibration.vibrate(40);
    }
  }, [listening]);

  useEffect(() => {
    if (!pickNewAddress && !listening) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (listening) {
        cancelListening();
      } else {
        setPickNewAddress(false);
      }
      return true;
    });
    return () => sub.remove();
  }, [cancelListening, listening, pickNewAddress]);

  function onClose() {
    if (pickNewAddress) {
      Speech.stop();
      setPickNewAddress(false);
      return;
    }
    Speech.stop();
    stop();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  }

  function toggleMic() {
    if (listening) {
      cancelListening();
      return;
    }
    if (busy) {
      return;
    }
    Speech.stop();
    setTtsHold(false);
    startListening().catch(() => undefined);
  }

  function pickAddress(id: string) {
    if (selectedAddress?.id === id) {
      return;
    }
    const from = selectedAddress;
    const previousOpen = openOrder;
    selectAddress(id)
      .then(async () => {
        const next = getSelectedAddress();
        setSelectedAddress(next);
        if (!previousOpen || !from || !next) {
          return;
        }
        const openAtNext = await findOpenOrderForAddress({
          addressId: next.id,
          address: formatAddressForOrder(next),
          pincode: next.pincode,
        });
        if (!openAtNext) {
          pushTurn(
            'sam',
            `Delivering a new order to ${formatSavedAddressLabel(next.label)}. Order #${formatOrderNumber(previousOpen.order_number)} stays at ${formatSavedAddressLabel(from.label)}.`,
          );
        }
      })
      .catch(() => undefined);
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

  const canUpdate = !editingOpen || hasOrderChanges;
  const orderCta = editingOpen ? 'Update' : 'Place order';
  const trackingOrder = turns.some((turn) => Boolean(turn.orderStatus));
  const headerTitle = trackingOrder ? 'Order Status' : '';
  const showStatusFollowups = trackingOrder && !busy && !catalogTurn;
  const activeTrack = openOrder ?? trackableOrder;
  const orderChips = activeTrack
    ? OPEN_ORDER_CHIPS.filter((chip) => {
        if (chip.id === 'modify') {
          return isOpenOrderStatus(activeTrack.status) && !editingOpen;
        }
        return chip.id !== 'cancel' || isOpenOrderStatus(activeTrack.status);
      })
    : ASK_CHIPS;

  const statusLabel = busy
    ? busyKind === 'place'
      ? 'Placing your order...'
      : busyKind === 'save'
        ? 'Saving your order...'
        : busyKind === 'modify'
          ? 'Loading your order...'
          : busyKind === 'cancel'
            ? 'Cancelling your order...'
            : 'Thinking...'
    : ttsHold
      ? 'Responding...'
      : null;

  if (pickNewAddress) {
    return (
      <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
        <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
          <Pressable
            onPress={onClose}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            New order
          </Text>
          <View style={styles.headerAction} />
        </View>
        <NewOrderAddressPicker
          rows={addressRows.length ? addressRows : addresses.map((address) => ({ address, blockingOrder: null }))}
          loading={addressRowsLoading}
          onSelect={(address) => {
            chooseNewOrderAddress(address).catch(() => undefined);
          }}
          onModify={(order) => {
            setPickNewAddress(false);
            startModify(order.id).catch(() => undefined);
          }}
          onViewOrder={(order) => router.push({ pathname: '/confirmation', params: { id: order.id } })}
          onAdd={() => router.push({ pathname: '/address/form', params: { next: 'sam' } })}
          onManage={() => router.push('/checkout')}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingBottom: keyboardHeight }]}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable
          onPress={onClose}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
        <View style={styles.headerAction} />
      </View>
      {editingOpen && openOrder ? (
        <View style={styles.editBanner} accessibilityRole="header">
          <View style={styles.editIconWrap}>
            <Ionicons name="create-outline" size={16} color={colors.primaryDark} />
          </View>
          <View style={styles.editCopy}>
            <Text style={styles.editTitle}>Editing order #{formatOrderNumber(openOrder.order_number)}</Text>
            <Text style={styles.editSub}>
              {formatOrderStatus(openOrder.status)} · Search to add items, then update
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.body}>
        {!conversationOn ? (
          <View style={[styles.landing, typingOpen && styles.landingCompact]}>
            {statusLabel ? <Text style={styles.status}>{statusLabel}</Text> : null}
            <Text style={styles.hello}>Hi there 👋</Text>
            {activeTrack ? (
              <Text style={styles.support}>
                Order #{formatOrderNumber(activeTrack.order_number)} is {formatOrderStatus(activeTrack.status)}
              </Text>
            ) : (
              <Text style={styles.question}>What are you looking for today?</Text>
            )}
            {typingOpen ? null : (
              <>
                {activeTrack ? null : <Text style={styles.support}>Speak or type — I'm here to help.</Text>}
                <View style={styles.chips}>
                  {(activeTrack ? orderChips : ASK_CHIPS).map((chip) => (
                    <Pressable
                      key={chip.id}
                      onPress={() => {
                        if (!('prompt' in chip) || !chip.prompt) {
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
                      {'icon' in chip && chip.icon ? (
                        <Ionicons name={chip.icon} size={15} color={colors.primaryDark} />
                      ) : null}
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
                  <View style={styles.samCard}>
                    <Text style={turn.orderStatus ? styles.samCardTitle : styles.bubbleText}>{turn.text}</Text>
                    {turn.orderStatus ? (
                      <View style={styles.progressCard}>
                        <OrderProgress status={turn.orderStatus} />
                      </View>
                    ) : null}
                    {turn.cancelOrderId ? (
                      <View style={styles.turnActions}>
                        <Pressable
                          onPress={() =>
                            requestCancelOrder(
                              turn.cancelOrderId as string,
                              openOrder && openOrder.id === turn.cancelOrderId
                                ? openOrder.order_number
                                : undefined,
                            ).catch(() => undefined)
                          }
                          disabled={busy}
                          style={({ pressed }) => [styles.turnActionGhost, pressed && styles.pressed]}
                          accessibilityRole="button"
                          accessibilityLabel="Cancel order"
                        >
                          <Text style={styles.turnActionGhostLabel}>Cancel order</Text>
                        </Pressable>
                      </View>
                    ) : null}
                    {turn.choices?.length ? (
                      <View style={styles.turnActions}>
                        {turn.choices.map((choice) => (
                          <Pressable
                            key={choice.id}
                            onPress={() => handleUtterance(choice.prompt).catch(() => undefined)}
                            disabled={busy}
                            style={({ pressed }) => [styles.turnAction, pressed && styles.pressed]}
                            accessibilityRole="button"
                            accessibilityLabel={choice.label}
                          >
                            <Text style={styles.turnActionLabel}>{choice.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
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
                </View>
              ),
            )}
            {busy ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.sm }} /> : null}
            {showStatusFollowups || (conversationOn && itemCount === 0 && !catalogTurn && !busy) ? (
              <View style={styles.hintBlock}>
                <Text style={styles.hintLabel}>Try saying</Text>
                <View style={styles.chips}>
                  {orderChips.filter((chip) => chip.prompt).map((chip) => (
                    <Pressable
                      key={chip.id}
                      onPress={() => handleUtterance(chip.prompt as string).catch(() => undefined)}
                      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                    >
                      {'icon' in chip && chip.icon ? (
                        <Ionicons name={chip.icon} size={15} color={colors.primaryDark} />
                      ) : null}
                      <Text style={styles.chipLabel}>{chip.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            {items.length > 0 && (editingOpen || !openOrder) ? (
              <View style={styles.orderBlock}>
                <View style={styles.orderHeadingRow}>
                  {editingOpen ? <Ionicons name="create" size={16} color={colors.primaryDark} /> : null}
                  <Text style={styles.orderHeading}>
                    {editingOpen
                      ? `Order #${formatOrderNumber(openOrder!.order_number)}`
                      : 'Your order'}
                  </Text>
                  {editingOpen ? (
                    <View style={styles.editPill}>
                      <Text style={styles.editPillLabel}>Editing</Text>
                    </View>
                  ) : null}
                </View>
                {items.map((item, index) => (
                  <View key={item.product.id} style={index > 0 ? styles.orderLineDivided : undefined}>
                    <SamOrderLine
                      product={item.product}
                      quantity={item.quantity}
                      onIncrease={() => {
                        const current = qtyLive.current[item.product.id] ?? item.quantity;
                        if (current >= MAX_ITEM_QTY) {
                          speakQtyChange(item.product.name, MAX_ITEM_QTY, true);
                          return;
                        }
                        const next = current + 1;
                        qtyLive.current[item.product.id] = next;
                        increase(item.product.id);
                        speakQtyChange(item.product.name, next, next >= MAX_ITEM_QTY);
                      }}
                      onDecrease={() => {
                        const current = qtyLive.current[item.product.id] ?? item.quantity;
                        const next = Math.max(0, current - 1);
                        qtyLive.current[item.product.id] = next;
                        decrease(item.product.id);
                        speakQtyChange(item.product.name, next);
                      }}
                      onRemove={() => {
                        qtyLive.current[item.product.id] = 0;
                        remove(item.product.id);
                        speakQtyChange(item.product.name, 0);
                      }}
                    />
                  </View>
                ))}
                <View style={styles.orderTotalRow}>
                  <Text style={styles.orderTotalLabel}>Total</Text>
                  <Text style={styles.orderTotalValue}>{formatPrice(totalAmount)}</Text>
                </View>
                <View style={styles.addressCard}>
                  <Text style={styles.addressKicker}>
                    {editingOrderId ? 'Saving to this address' : 'Deliver to'}
                  </Text>
                  {selectedAddress ? (
                    <Text style={styles.addressLine}>
                      {formatSavedAddressLabel(selectedAddress.label)} · {formatSavedAddressLine(selectedAddress)}
                    </Text>
                  ) : (
                    <Pressable onPress={() => router.push({ pathname: '/address/form', params: { next: 'sam' } })}>
                      <Text style={styles.addressLine}>Add a delivery address</Text>
                    </Pressable>
                  )}
                  {addresses.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.addrChips}>
                      {addresses.map((row) => (
                        <Pressable
                          key={row.id}
                          onPress={() => pickAddress(row.id)}
                          style={[styles.addrChip, selectedAddress?.id === row.id && styles.addrChipOn]}
                        >
                          <Text
                            style={[
                              styles.addrChipLabel,
                              selectedAddress?.id === row.id && styles.addrChipLabelOn,
                            ]}
                          >
                            {formatSavedAddressLabel(row.label)}
                          </Text>
                        </Pressable>
                      ))}
                      {addresses.length < MAX_SAVED_ADDRESSES ? (
                        <Pressable
                          onPress={() => router.push({ pathname: '/address/form', params: { next: 'sam' } })}
                          style={styles.addrChip}
                          accessibilityRole="button"
                          accessibilityLabel="Add address"
                        >
                          <Text style={styles.addrChipLabel}>+ Address</Text>
                        </Pressable>
                      ) : null}
                    </ScrollView>
                  ) : null}
                  <Text style={styles.placeHint}>
                    {editingOpen
                      ? canUpdate
                        ? 'Tap Update to save your changes.'
                        : 'Change an item to enable Update.'
                      : 'Tap Place order when you are ready.'}
                  </Text>
                </View>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>

      {denied || error ? (
        <Text style={styles.micHint}>{error || 'Microphone is off. You can type instead.'}</Text>
      ) : null}

      <View style={[styles.dock, { paddingBottom: dockPad }]}>
        {notice ? (
          <View style={styles.noticeWrap} pointerEvents="none">
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Ionicons name="checkmark-circle" size={16} color={colors.primaryText} />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          </View>
        ) : null}
        {itemCount > 0 && (editingOpen || !openOrder) ? (
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => placeFromChat().catch(() => undefined)}
              disabled={busy || !canUpdate}
              style={({ pressed }) => [
                styles.checkoutBar,
                pressed && canUpdate && styles.pressed,
                (busy || !canUpdate) && styles.sendOff,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || !canUpdate }}
              accessibilityLabel={orderCta}
            >
              {busyKind === 'place' || busyKind === 'save' ? (
                <ActivityIndicator color={colors.primaryText} size="small" />
              ) : (
                <Ionicons
                  name={editingOpen ? 'checkmark-circle' : 'bag-check'}
                  size={18}
                  color={colors.primaryText}
                />
              )}
              <Text style={styles.checkoutTitle}>
                {busyKind === 'place' ? 'Placing…' : busyKind === 'save' ? 'Saving…' : orderCta}
              </Text>
              <Text style={styles.checkoutTotal}>{formatPrice(totalAmount)}</Text>
            </Pressable>
          </View>
        ) : null}
        {typedCommands.length > 0 || (!catalogTurn && liveMatches.length > 0) ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={[styles.liveList, typingOpen && styles.liveListKeyboard]}
            nestedScrollEnabled
          >
            {typedCommands.length > 0 ? (
              <View style={styles.cmdRow}>
                {typedCommands.map((command) => (
                  <Pressable
                    key={command.id}
                    onPress={() => {
                      if (busy) {
                        return;
                      }
                      setTyped('');
                      Keyboard.dismiss();
                      handleUtterance(command.prompt).catch(() => undefined);
                    }}
                    style={({ pressed }) => [styles.cmdChip, pressed && styles.pressed]}
                  >
                    <Text style={styles.cmdChipLabel}>{command.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {!catalogTurn
              ? liveMatches.map((product) => (
                  <SamProductRow key={product.id} product={product} onAdd={() => addFromCatalog(product)} />
                ))
              : null}
          </ScrollView>
        ) : catalogTurn ? (
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
        ) : null}
        <View style={styles.composer}>
          <Pressable
            onPress={toggleMic}
            style={({ pressed }) => [styles.composerMic, listening && styles.composerMicLive, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Stop listening' : 'Listen'}
          >
            <Ionicons
              name={listening ? 'mic' : 'mic-outline'}
              size={22}
              color={listening ? colors.primary : colors.textMuted}
            />
          </Pressable>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder={
              listening
                ? 'Listening...'
                : editingOpen
                  ? 'Search to add to this order...'
                  : 'Search products or ask anything...'
            }
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
      {listening ? (
        <SamVoiceOverlay
          volume={volume}
          heard={partial}
          bottomInset={insets.bottom}
          onCancel={cancelListening}
          onDone={finishListening}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
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
    paddingBottom: 10,
    backgroundColor: colors.background,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: colors.text,
  },
  headerAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCopy: {
    flex: 1,
    minWidth: 0,
  },
  editTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  editSub: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
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
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primarySoft,
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
    maxWidth: '100%',
  },
  samCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#18181B',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    gap: 8,
  },
  samCardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: colors.text,
  },
  turnActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  turnAction: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  turnActionLabel: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '800',
  },
  turnActionGhost: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  turnActionGhostLabel: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  bubbleUser: {
    maxWidth: '82%',
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.primaryDark,
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
  orderHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  orderHeading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    flexShrink: 1,
  },
  editPill: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  editPillLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
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
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    shadowColor: '#0F766E',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  checkoutTitle: {
    flex: 1,
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  checkoutTotal: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '800',
  },
  micHint: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: spacing.lg,
  },
  addressCard: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  progressCard: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  addressKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  addressLine: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    fontWeight: '600',
  },
  addrChips: {
    gap: 8,
    paddingVertical: 4,
  },
  addrChip: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  addrChipOn: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  addrChipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  addrChipLabelOn: {
    color: colors.primaryDark,
  },
  placeHint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  cmdRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.sm,
  },
  cmdChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
  },
  cmdChipLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  hintBlock: {
    gap: 8,
    marginTop: spacing.sm,
  },
  hintLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  dock: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  noticeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    alignItems: 'center',
    paddingBottom: spacing.xs,
    zIndex: 10,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(24, 24, 27, 0.88)',
  },
  noticeText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    marginTop: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 6,
    paddingRight: 6,
    shadowColor: '#18181B',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  composerMic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerMicLive: {
    backgroundColor: colors.primarySoft,
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
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
