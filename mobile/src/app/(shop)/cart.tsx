import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ScrollView as NativeScrollView,
} from 'react-native';
import { GestureHandlerRootView, ScrollView, Swipeable } from 'react-native-gesture-handler';
import {
  getSelectedAddress,
  loadAddressBook,
  subscribeAddressBook,
  type SavedAddress,
} from '@/cart/address-book';
import { useCart, type CartItem } from '@/cart/CartContext';
import { alertModifyDiscarded, goModifyOrder } from '@/cart/modify-flow';
import { submitShopOrder } from '@/cart/submit-order';
import {
  AddressPickerSheet,
  savedAddressLabel,
  savedAddressLine,
} from '@/components/AddressPickerSheet';
import { ModifyOrderBar } from '@/components/ModifyOrderBar';
import { ProductImage } from '@/components/ProductImage';
import { showAppDialog } from '@/components/AppDialogHost';
import { MinOrderDialog } from '@/components/MinOrderDialog';
import { PlaceOrderConfirmSheet } from '@/components/PlaceOrderConfirmSheet';
import { OfflineBanner } from '@/components/OfflineBanner';
import { QuantityStepper } from '@/components/QuantityStepper';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { shopClosedMessage } from '@/components/ShopHomeNotice';
import { refreshBusiness } from '@/services/business';
import { belowMinOrder, minOrderAmountOf } from '@/utils/min-order';
import { hapticError } from '@/utils/haptics';
import { checkOrderEditable, getMyOrderById } from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';
import type { OrderStatus } from '@/types/order';
import { formatOrderNumber, formatPrice } from '@/utils/format';
import { cartLineKey, cartLineTotal, formatOrderItemUnit } from '@/utils/selling-units';
import {
  clearExpectingCartItems,
  shouldHoldEmptyCart,
} from '@/notifications/available-product-order';
import { useTopInset } from '@/utils/safe-area';

export default function CartScreen() {
  const router = useRouter();
  const topInset = useTopInset();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const {
    items,
    itemCount,
    totalAmount,
    increase,
    decrease,
    remove,
    clearCart,
    editingOrderId,
    editingItemsRevision,
    syncEditingItemsRevision,
    refreshOpenOrder,
    beginEditOrder,
    hasOrderChanges,
    openOrder,
    rowChange,
    openOrderReady,
  } = useCart();
  const { offline, requireConnection } = useNetworkStatus();
  /** Tab scene ends above shop tab bar; keep checkout flush above nav icons. */
  const bottomPad = spacing.xs;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [minOrderOpen, setMinOrderOpen] = useState(false);
  const [addressBookTick, setAddressBookTick] = useState(0);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const bumpAddressBook = useCallback(() => setAddressBookTick((n) => n + 1), []);
  const selected = useMemo(() => getSelectedAddress(), [addressBookTick]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closedMessage, setClosedMessage] = useState<string | null>(null);
  const [minOrderAmount, setMinOrderAmount] = useState(0);
  const [footerHeight, setFooterHeight] = useState(96);
  const discarding = useRef(false);
  const leaving = useRef(false);
  const swipeables = useRef(new Map<string, Swipeable>());
  const scrollRef = useRef<NativeScrollView>(null);
  const viewportHeight = useRef(0);
  const addMoreY = useRef<number | null>(null);
  const pendingAddFocus = useRef(false);
  const promptedOpenOrderModify = useRef<string | null>(null);

  const scrollToAddMore = useCallback(() => {
    const y = addMoreY.current;
    if (!pendingAddFocus.current || y === null) {
      return;
    }
    pendingAddFocus.current = false;
    const target = Math.max(0, y - viewportHeight.current / 2);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: target, animated: true }));
  }, []);

  useEffect(() => {
    if (focus !== 'add') {
      return;
    }
    pendingAddFocus.current = true;
    router.setParams({ focus: undefined });
    // Not cleared when `focus` resets: the row needs a moment to lay out after the cart opens.
    setTimeout(scrollToAddMore, 350);
  }, [focus, router, scrollToAddMore]);

  const loadAddress = useCallback(async () => {
    await loadAddressBook().catch(() => undefined);
    bumpAddressBook();
  }, [bumpAddressBook]);

  const discardModify = useCallback(
    (status: OrderStatus | null, orderNumber: number | null) => {
      if (discarding.current) {
        return;
      }
      discarding.current = true;
      clearCart();
      router.replace('/home');
      alertModifyDiscarded(status, orderNumber);
    },
    [clearCart, router],
  );

  const discardIfClosed = useCallback(
    async (orderId: string) => {
      const check = await checkOrderEditable(orderId);
      if (check.state === 'closed') {
        discardModify(check.status, check.orderNumber);
      }
      return check.state;
    },
    [discardModify],
  );

  useFocusEffect(
    useCallback(() => {
      loadAddress().catch(() => undefined);
      void getSignedInUser().then((user) => setSignedIn(Boolean(user)));
      void refreshBusiness()
        .then((shop) => {
          setClosedMessage(shopClosedMessage(shop));
          setMinOrderAmount(minOrderAmountOf(shop?.min_order_amount));
        })
        .catch(() => {
          setClosedMessage(null);
          setMinOrderAmount(0);
        });
      if (items.length === 0 && !leaving.current && !shouldHoldEmptyCart()) {
        router.replace('/home');
      }
    }, [items.length, loadAddress, router]),
  );

  useEffect(() => {
    if (items.length > 0) {
      clearExpectingCartItems();
      return;
    }
    if (!shouldHoldEmptyCart()) {
      return;
    }
    const timer = setTimeout(() => {
      clearExpectingCartItems();
      if (!leaving.current) {
        router.replace('/home');
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [items.length, router]);

  useFocusEffect(
    useCallback(
      () => () => {
        leaving.current = false;
      },
      [],
    ),
  );

  const blockedByOpenOrder = Boolean(openOrder && !editingOrderId && items.length > 0);
  useFocusEffect(
    useCallback(() => {
      if (!blockedByOpenOrder || !openOrderReady || !openOrder || leaving.current) {
        promptedOpenOrderModify.current = null;
        return;
      }
      if (promptedOpenOrderModify.current === openOrder.id) {
        return;
      }
      promptedOpenOrderModify.current = openOrder.id;
      markExpectingCartItems();
      goModifyOrder(openOrder, beginEditOrder, { additions: items });
    }, [beginEditOrder, blockedByOpenOrder, items, openOrder, openOrderReady]),
  );

  useFocusEffect(
    useCallback(() => {
      discarding.current = false;
      if (!editingOrderId) {
        return;
      }
      void discardIfClosed(editingOrderId);
    }, [discardIfClosed, editingOrderId]),
  );

  useEffect(() => subscribeAddressBook(bumpAddressBook), [bumpAddressBook]);

  useEffect(() => {
    if (!selected) {
      setConfirmOpen(false);
    }
  }, [selected]);

  if (items.length === 0) {
    return (
      <View style={[styles.screen, styles.blocked]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (blockedByOpenOrder) {
    return (
      <View style={[styles.screen, styles.blocked]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const editingOpen = Boolean(openOrder && editingOrderId === openOrder.id);

  function exitModify() {
    leaving.current = true;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/orders');
    }
    clearCart();
  }

  function confirmRemove(item: CartItem) {
    if (!editingOpen) {
      remove(item.product.id, cartLineKey(item));
      return;
    }
    showAppDialog({
      title: `Remove ${item.product.name}?`,
      message: 'It will be taken off this order when you tap Update order.',
      icon: 'trash',
      tone: 'danger',
      onDismiss: () => swipeables.current.get(cartLineKey(item))?.close(),
      actions: [
        {
          label: 'Remove',
          variant: 'danger',
          onPress: () => remove(item.product.id, cartLineKey(item)),
        },
      ],
    });
  }

  function onDecrease(item: CartItem) {
    if (item.quantity <= 1) {
      confirmRemove(item);
      return;
    }
    decrease(item.product.id, cartLineKey(item));
  }

  const addressTitle = selected ? savedAddressLabel(selected.label) : 'Choose address';
  const addressLine = selected ? savedAddressLine(selected) : 'Add a delivery address';
  const shopClosed = Boolean(closedMessage) && !editingOpen;
  const underMinOrder = belowMinOrder(totalAmount, minOrderAmount);
  const placeOrderLabel = submitting
    ? editingOpen
      ? 'Updating…'
      : 'Placing order…'
    : editingOpen
      ? 'Update order'
      : shopClosed
        ? 'Shop closed'
        : signedIn === false
          ? 'Sign in to order'
          : !selected
            ? 'Add delivery address'
            : 'Place order';
  const placeOrderDisabled = submitting || shopClosed || Boolean(editingOpen && !hasOrderChanges);
  const checkoutHint = shopClosed
    ? closedMessage
    : signedIn === false
      ? 'Sign in to place your order.'
      : !selected
        ? 'Add a delivery address to continue.'
        : null;

  async function onPlaceOrder() {
    if (placeOrderDisabled) {
      return;
    }
    if (shopClosed && closedMessage) {
      setError(closedMessage);
      return;
    }
    if (underMinOrder) {
      hapticError();
      setMinOrderOpen(true);
      return;
    }
    const user = await getSignedInUser();
    if (!user) {
      router.push({ pathname: '/login', params: { next: 'cart' } });
      return;
    }
    if (!selected) {
      setPickerOpen(true);
      return;
    }
    setConfirmOpen(true);
  }

  function confirmPlaceOrder() {
    setConfirmOpen(false);
    void submitPlaceOrder();
  }

  async function submitPlaceOrder() {
    setError(null);
    if (!selected) {
      setPickerOpen(true);
      return;
    }
    let updateId = editingOpen ? editingOrderId : null;
    if (editingOrderId && !editingOpen) {
      setSubmitting(true);
      const state = await discardIfClosed(editingOrderId).finally(() => setSubmitting(false));
      if (state === 'closed') {
        return;
      }
      if (state === 'unknown') {
        setError('Could not reach the store. Check your connection and try again.');
        return;
      }
      updateId = editingOrderId;
    }
    if (!updateId) {
      const user = await getSignedInUser();
      if (!user) {
        router.push({ pathname: '/login', params: { next: 'cart' } });
        return;
      }
      if (!(await requireConnection())) {
        return;
      }
    }
    if (editingOpen && !hasOrderChanges) {
      setError('Change an item first to update this order.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitShopOrder(
        items,
        selected,
        updateId,
        'app',
        updateId ? editingItemsRevision : undefined,
      );
      if (!result.ok) {
        if (result.reason === 'locked' && updateId) {
          const check = await checkOrderEditable(updateId);
          discardModify(
            check.state === 'closed' ? check.status : null,
            check.state === 'closed' ? check.orderNumber : (openOrder?.order_number ?? null),
          );
          return;
        }
        if (result.reason === 'min_order') {
          hapticError();
          setMinOrderOpen(true);
          return;
        }
        if (result.reason === 'auth') {
          router.push({ pathname: '/login', params: { next: 'cart' } });
          return;
        }
        if (result.reason === 'network') {
          if (await requireConnection()) {
            setError('Could not reach the store. Check your connection and tap Place order again.');
          }
          return;
        }
        if (result.reason === 'address') {
          setPickerOpen(true);
          return;
        }
        if (result.reason === 'open_order') {
          setError(result.message);
          if (!result.openOrder) {
            return;
          }
          showAppDialog({
            title: 'Open order',
            message: result.message,
            icon: 'bag-handle',
            actions: [
              {
                label: 'Modify order',
                onPress: () => {
                  goModifyOrder(result.openOrder!, beginEditOrder, { skipConfirm: true });
                },
              },
            ],
          });
          return;
        }
        if (updateId && /ORDER_STALE|changed while you were editing/i.test(result.message)) {
          refreshOpenOrder();
          const fresh = await getMyOrderById(updateId);
          if (fresh?.items_revision != null) {
            syncEditingItemsRevision(fresh.items_revision);
          }
        }
        setError(result.message);
        return;
      }
      leaving.current = true;
      router.replace({
        pathname: '/confirmation',
        params: {
          id: result.order.id,
          orderNumber: result.order.order_number != null ? String(result.order.order_number) : '',
          status: result.order.status,
          total: String(result.order.total_amount),
          fresh: updateId ? 'updated' : 'placed',
        },
      });
      clearCart();
    } catch (placeError) {
      setError(placeError instanceof Error ? placeError.message : 'Could not place the order.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <GestureHandlerRootView style={styles.screen}>
      <View style={[styles.header, { paddingTop: topInset + spacing.xs }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          style={styles.address}
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Change delivery address"
        >
          <View style={styles.addressIconCircle}>
            <Ionicons name="location" size={16} color={colors.primaryDark} />
          </View>
          <View style={styles.addressCopy}>
            <View style={styles.addressTitleRow}>
              <Text style={styles.addressKicker} numberOfLines={1}>
                Deliver to{' '}
                {selected ? <Text style={styles.addressTitleStrong}>{addressTitle}</Text> : null}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </View>
            <Text style={styles.addressLine} numberOfLines={1}>
              {addressLine}
            </Text>
          </View>
        </Pressable>
      </View>
      {editingOpen ? (
        <View style={styles.modifyBarWrap}>
          <ModifyOrderBar variant="cart" onExit={exitModify} />
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: footerHeight + 4 }]}
        keyboardShouldPersistTaps="handled"
        onLayout={(event) => {
          viewportHeight.current = event.nativeEvent.layout.height;
        }}
      >
        {offline ? <OfflineBanner /> : null}
        <View style={styles.itemList}>
        {items.map((item, index) => {
          const subtotal = cartLineTotal(item);
          const change = rowChange(item.product.id);
          const isLast = index === items.length - 1;
          return (
            <View key={cartLineKey(item)}>
              <Swipeable
                ref={(swipeable) => {
                  const key = cartLineKey(item);
                  if (swipeable) {
                    swipeables.current.set(key, swipeable);
                  } else {
                    swipeables.current.delete(key);
                  }
                }}
                overshootRight={false}
                rightThreshold={40}
                onSwipeableRightOpen={() => confirmRemove(item)}
                renderRightActions={() => (
                  <Pressable
                    onPress={() => confirmRemove(item)}
                    style={styles.deleteAction}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${item.product.name}`}
                  >
                    <Ionicons name="trash-outline" size={22} color={colors.primaryText} />
                  </Pressable>
                )}
              >
                <View
                  style={[styles.row, change?.kind === 'new' && styles.rowNew]}
                  accessibilityHint="Swipe left to delete"
                >
                <ProductImage
                  uri={item.product.image_url}
                  style={styles.thumb}
                  compact
                  recyclingKey={item.product.id}
                  accessibilityLabel={item.product.name}
                />
                <Pressable
                  style={styles.detailsLeft}
                  onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.product.id } })}
                >
                  <Text style={styles.name} numberOfLines={2}>
                    {item.product.name}
                  </Text>
                  <Text style={styles.unit}>{formatOrderItemUnit({
                    product_name: item.product.name,
                    quantity: item.quantity,
                    selling_type: item.product.selling_type,
                    selling_unit: item.product.selling_unit,
                    pack_weight_grams: item.packWeightGrams,
                    weight_grams: item.weightGrams,
                    volume_ml: item.volumeMl,
                  })}</Text>
                  {change?.kind === 'new' ? (
                    <View style={[styles.tag, styles.tagNew]}>
                      <Text style={[styles.tagLabel, styles.tagNewLabel]}>New</Text>
                    </View>
                  ) : change?.kind === 'changed' ? (
                    <View style={[styles.tag, styles.tagChanged]}>
                      <Text style={[styles.tagLabel, styles.tagChangedLabel]}>Was {change.from}</Text>
                    </View>
                  ) : null}
                </Pressable>
                <View style={styles.detailsRight}>
                  <Text style={styles.subtotal}>{formatPrice(subtotal)}</Text>
                  <QuantityStepper
                    compact
                    dense
                    value={item.quantity}
                    onDecrease={() => onDecrease(item)}
                    onIncrease={() => increase(item.product.id, cartLineKey(item))}
                  />
                </View>
              </View>
              </Swipeable>
              {!isLast ? <View style={styles.rowDivider} /> : null}
            </View>
          );
        })}
        </View>
        <Pressable
          style={({ pressed }) => [styles.addMore, pressed && styles.pressed]}
          onPress={() => router.push('/home')}
          ref={(node) => {
            if (!node) {
              addMoreY.current = null;
            }
          }}
          onLayout={(event) => {
            addMoreY.current = event.nativeEvent.layout.y;
            scrollToAddMore();
          }}
          accessibilityRole="button"
        >
          <View style={styles.addMoreLeft}>
            <Ionicons name="add-circle" size={22} color={colors.primary} />
            <Text style={styles.addMoreLabel}>Add more items</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>

      </ScrollView>
      <View
        style={[styles.footer, { paddingBottom: bottomPad }]}
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
      >
        {error ? <Text style={[styles.error, styles.footerMessage]}>{error}</Text> : null}
        {checkoutHint && !error ? (
          <Text style={[styles.checkoutHint, styles.footerMessage]}>{checkoutHint}</Text>
        ) : null}
        {openOrder && !editingOpen ? (
          <Text style={[styles.error, styles.footerMessage]}>
            Order #{formatOrderNumber(openOrder.order_number)} is already open at this address. Pick another
            address to place a new order, or modify the open one.
          </Text>
        ) : null}
        <View style={styles.checkoutBar}>
          <View style={styles.checkoutLeft}>
            <Text style={styles.checkoutMeta}>
              Total · {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>
            <Text style={styles.checkoutTotal}>{formatPrice(totalAmount)}</Text>
          </View>
          <Pressable
            onPress={onPlaceOrder}
            disabled={placeOrderDisabled}
            style={({ pressed }) => [
              styles.placeOrderButton,
              placeOrderDisabled && styles.placeOrderDisabled,
              pressed && !placeOrderDisabled && styles.placeOrderPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={placeOrderLabel}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <>
                <Text style={styles.placeOrderLabel}>{placeOrderLabel}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.primaryText} />
              </>
            )}
          </Pressable>
        </View>
      </View>
      <AddressPickerSheet
        visible={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          loadAddress().catch(() => undefined);
        }}
      />
      {selected ? (
        <PlaceOrderConfirmSheet
          visible={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={confirmPlaceOrder}
          totalAmount={totalAmount}
          itemCount={itemCount}
          addressTitle={`Deliver to ${savedAddressLabel(selected.label)}`}
          addressLine={savedAddressLine(selected)}
          mode={editingOpen ? 'update' : 'place'}
        />
      ) : null}
      <MinOrderDialog
        visible={minOrderOpen}
        minAmount={minOrderAmount}
        onClose={() => setMinOrderOpen(false)}
        onAddItems={() => {
          setMinOrderOpen(false);
          router.push('/home');
        }}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  blocked: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  address: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: spacing.sm,
  },
  addressIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressCopy: {
    flex: 1,
    minWidth: 0,
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressKicker: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
  },
  addressTitleStrong: {
    fontWeight: '700',
    color: colors.text,
  },
  addressLine: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    marginTop: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  itemList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow.sm,
  },
  modifyBarWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 4,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  rowNew: {
    backgroundColor: '#F7FDFB',
  },
  rowDivider: {
    height: Platform.OS === 'android' ? 1 : StyleSheet.hairlineWidth,
    backgroundColor: '#D6D3D1',
    marginHorizontal: spacing.sm,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  tagLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  tagNew: {
    backgroundColor: '#DCFCE7',
  },
  tagNewLabel: {
    color: colors.success,
  },
  tagChanged: {
    backgroundColor: '#FEF3C7',
  },
  tagChangedLabel: {
    color: '#92400E',
  },
  thumb: {
    width: 68,
    height: 68,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  detailsLeft: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingRight: spacing.xs,
  },
  detailsRight: {
    width: 92,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 21,
  },
  unit: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  subtotal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
    textAlign: 'right',
  },
  deleteAction: {
    width: 68,
    alignSelf: 'stretch',
    marginLeft: spacing.xs,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(15, 118, 110, 0.35)',
  },
  addMoreLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addMoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  pressed: {
    opacity: 0.88,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primarySoft,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 118, 110, 0.2)',
  },
  footerMessage: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  checkoutHint: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  checkoutBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  checkoutLeft: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  checkoutMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  checkoutTotal: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.4,
  },
  placeOrderButton: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  placeOrderDisabled: {
    opacity: 0.5,
  },
  placeOrderPressed: {
    opacity: 0.92,
  },
  placeOrderLabel: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: '800',
  },
  error: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '600',
  },
});
