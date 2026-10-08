import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { PlaceOrderConfirmSheet } from '@/components/PlaceOrderConfirmSheet';
import { OfflineBanner } from '@/components/OfflineBanner';
import { QuantityStepper } from '@/components/QuantityStepper';
import { colors, radius, spacing } from '@/config/theme';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { checkOrderEditable } from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';
import type { OrderStatus } from '@/types/order';
import { formatOrderNumber, formatPrice } from '@/utils/format';
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
  const [selected, setSelected] = useState<SavedAddress | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [footerHeight, setFooterHeight] = useState(96);
  const discarding = useRef(false);
  const leaving = useRef(false);
  const swipeables = useRef(new Map<string, Swipeable>());
  const scrollRef = useRef<NativeScrollView>(null);
  const viewportHeight = useRef(0);
  const addMoreY = useRef<number | null>(null);
  const pendingAddFocus = useRef(false);

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
    await loadAddressBook();
    setSelected(getSelectedAddress());
  }, []);

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
      if (items.length === 0 && !leaving.current) {
        router.replace('/home');
      }
    }, [items.length, loadAddress, router]),
  );

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
      if (blockedByOpenOrder && openOrderReady && !leaving.current) {
        leaving.current = true;
        router.replace({ pathname: '/new-order', params: { next: 'cart' } });
      }
    }, [blockedByOpenOrder, openOrderReady, router]),
  );

  useFocusEffect(
    useCallback(() => {
      discarding.current = false;
      if (editingOrderId) {
        discardIfClosed(editingOrderId).catch(() => undefined);
      }
    }, [discardIfClosed, editingOrderId]),
  );

  useEffect(() => {
    return subscribeAddressBook(() => {
      setSelected(getSelectedAddress());
    });
  }, []);

  if (items.length === 0) {
    return <View style={styles.screen} />;
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
      remove(item.product.id);
      return;
    }
    Alert.alert(`Remove ${item.product.name}?`, 'It will be taken off this order when you tap Update order.', [
      { text: 'Keep', style: 'cancel', onPress: () => swipeables.current.get(item.product.id)?.close() },
      { text: 'Remove', style: 'destructive', onPress: () => remove(item.product.id) },
    ]);
  }

  function onDecrease(item: CartItem) {
    if (item.quantity <= 1) {
      confirmRemove(item);
      return;
    }
    decrease(item.product.id);
  }

  const addressTitle = selected ? savedAddressLabel(selected.label) : 'Choose address';
  const addressLine = selected ? savedAddressLine(selected) : 'Add a delivery address';
  const placeOrderLabel = submitting
    ? editingOpen
      ? 'Updating…'
      : 'Placing order…'
    : editingOpen
      ? 'Update order'
      : 'Place order';
  const placeOrderDisabled = submitting || Boolean(editingOpen && !hasOrderChanges);

  function onPlaceOrder() {
    if (placeOrderDisabled) {
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
      const result = await submitShopOrder(items, selected, updateId);
      if (!result.ok) {
        if (result.reason === 'locked' && updateId) {
          const check = await checkOrderEditable(updateId);
          discardModify(
            check.state === 'closed' ? check.status : null,
            check.state === 'closed' ? check.orderNumber : (openOrder?.order_number ?? null),
          );
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
          Alert.alert('Open order', result.message, [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Modify order',
              onPress: () => {
                setTimeout(() => goModifyOrder(result.openOrder!, beginEditOrder), 200);
              },
            },
          ]);
          return;
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
          const subtotal = item.product.price * item.quantity;
          const change = rowChange(item.product.id);
          const isLast = index === items.length - 1;
          return (
            <Swipeable
              key={item.product.id}
              ref={(swipeable) => {
                if (swipeable) {
                  swipeables.current.set(item.product.id, swipeable);
                } else {
                  swipeables.current.delete(item.product.id);
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
                style={[
                  styles.row,
                  change?.kind === 'new' && styles.rowNew,
                  isLast && styles.rowLast,
                ]}
                accessibilityHint="Swipe left to delete"
              >
                <Image
                  source={item.product.image_url ? { uri: item.product.image_url } : undefined}
                  style={styles.thumb}
                  contentFit="cover"
                />
                <View style={styles.detailsLeft}>
                  <Text style={styles.name} numberOfLines={2}>
                    {item.product.name}
                  </Text>
                  <Text style={styles.unit}>{formatPrice(item.product.price)} each</Text>
                  {change?.kind === 'new' ? (
                    <View style={[styles.tag, styles.tagNew]}>
                      <Text style={[styles.tagLabel, styles.tagNewLabel]}>New</Text>
                    </View>
                  ) : change?.kind === 'changed' ? (
                    <View style={[styles.tag, styles.tagChanged]}>
                      <Text style={[styles.tagLabel, styles.tagChangedLabel]}>Was {change.from}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.detailsRight}>
                  <QuantityStepper
                    compact
                    dense
                    value={item.quantity}
                    onDecrease={() => onDecrease(item)}
                    onIncrease={() => increase(item.product.id)}
                  />
                  <Text style={styles.subtotal}>{formatPrice(subtotal)}</Text>
                </View>
              </View>
            </Swipeable>
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
      <PlaceOrderConfirmSheet
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmPlaceOrder}
        totalAmount={totalAmount}
        itemCount={itemCount}
        addressTitle={
          selected ? `Deliver to ${savedAddressLabel(selected.label)}` : 'Delivery address'
        }
        addressLine={selected ? savedAddressLine(selected) : 'Add a delivery address'}
        mode={editingOpen ? 'update' : 'place'}
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
    backgroundColor: colors.surface,
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
    paddingTop: 4,
    gap: spacing.xs,
  },
  itemList: {
    backgroundColor: colors.surface,
    overflow: 'hidden',
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowNew: {
    backgroundColor: '#F7FDFB',
  },
  rowLast: {
    borderBottomWidth: 0,
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
    backgroundColor: '#F7FAF9',
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
    marginTop: 1,
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
    paddingHorizontal: spacing.xs,
    minHeight: 40,
    marginTop: 2,
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
