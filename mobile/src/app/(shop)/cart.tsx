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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QuantityStepper } from '@/components/QuantityStepper';
import { colors, radius, spacing } from '@/config/theme';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { checkOrderEditable } from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';
import type { OrderStatus } from '@/types/order';
import { formatOrderNumber, formatPrice } from '@/utils/format';

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const bottomPad = Math.max(insets.bottom, spacing.sm) + spacing.md;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<SavedAddress | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  function confirmClearCart() {
    Alert.alert(
      'Clear cart?',
      'This will remove all items from your cart. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear cart',
          style: 'destructive',
          onPress: () => {
            clearCart();
            router.replace('/home');
          },
        },
      ],
    );
  }

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

  async function onPlaceOrder() {
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
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          style={styles.address}
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Change delivery address"
        >
          <View style={styles.addressIcon}>
            <Ionicons name="location" size={18} color={colors.primary} />
          </View>
          <View style={styles.addressCopy}>
            <View style={styles.addressTitleRow}>
              <Text style={styles.addressKicker}>Deliver to</Text>
              <Text style={styles.addressTitle}>{addressTitle}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.primaryDark} />
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
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onLayout={(event) => {
          viewportHeight.current = event.nativeEvent.layout.height;
        }}
      >
        {offline ? <OfflineBanner /> : null}
        {editingOpen ? null : (
          <View style={styles.countRow}>
            <Text style={styles.count}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>
            <Pressable
              onPress={confirmClearCart}
              style={({ pressed }) => [styles.clearButton, pressed && styles.clearPressed]}
              accessibilityRole="button"
              accessibilityLabel="Clear cart"
              hitSlop={6}
            >
              <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
              <Text style={styles.clearLabel}>Clear cart</Text>
            </Pressable>
          </View>
        )}
        {items.map((item) => {
          const subtotal = item.product.price * item.quantity;
          const change = rowChange(item.product.id);
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
                style={[styles.row, change?.kind === 'new' && styles.rowNew]}
                accessibilityHint="Swipe left to delete"
              >
                <Image
                  source={item.product.image_url ? { uri: item.product.image_url } : undefined}
                  style={styles.thumb}
                  contentFit="cover"
                />
                <View style={styles.details}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={2}>
                      {item.product.name}
                    </Text>
                    <Text style={styles.subtotal}>{formatPrice(subtotal)}</Text>
                  </View>
                  <Text style={styles.unit}>{formatPrice(item.product.price)} each</Text>
                  <View style={styles.rowBottom}>
                    <QuantityStepper
                      compact
                      value={item.quantity}
                      onDecrease={() => onDecrease(item)}
                      onIncrease={() => increase(item.product.id)}
                    />
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
                </View>
              </View>
            </Swipeable>
          );
        })}
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

        <View style={styles.bill}>
          <Text style={styles.billHeading}>Bill summary</Text>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>
              Item total ({itemCount} {itemCount === 1 ? 'item' : 'items'})
            </Text>
            <Text style={styles.billValue}>{formatPrice(totalAmount)}</Text>
          </View>
          <View style={styles.billDivider} />
          <View style={styles.billRow}>
            <Text style={styles.billTotalLabel}>To pay</Text>
            <Text style={styles.billTotalValue}>{formatPrice(totalAmount)}</Text>
          </View>
        </View>

        <View style={styles.payNote}>
          <Ionicons name="cash-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.payNoteText}>Pay on delivery · Cash or UPI</Text>
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <View>
          <Text style={styles.totalLabel}>
            Total · {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Text>
          <Text style={styles.total}>{formatPrice(totalAmount)}</Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {openOrder && !editingOpen ? (
          <Text style={styles.error}>
            Order #{formatOrderNumber(openOrder.order_number)} is already open at this address. Pick another
            address to place a new order, or modify the open one.
          </Text>
        ) : null}
        <PrimaryButton
          label={
            submitting
              ? editingOpen
                ? 'Updating…'
                : 'Placing order…'
              : editingOpen
                ? 'Update order'
                : 'Place order'
          }
          disabled={submitting || Boolean(editingOpen && !hasOrderChanges)}
          onPress={() => onPlaceOrder().catch(() => undefined)}
        />
      </View>
      <AddressPickerSheet
        visible={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          loadAddress().catch(() => undefined);
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
  blocked: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  address: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  addressIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  addressTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  addressLine: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  count: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  clearButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  clearPressed: {
    backgroundColor: colors.border,
  },
  clearLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  modifyBarWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowNew: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
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
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  details: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 20,
  },
  unit: {
    fontSize: 13,
    color: colors.textMuted,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: 4,
  },
  subtotal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
    textAlign: 'right',
  },
  deleteAction: {
    width: 72,
    alignSelf: 'stretch',
    marginLeft: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDFA',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  addMoreLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addMoreLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  bill: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  billHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  billValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  billDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  billTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  billTotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  payNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  payNoteText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.88,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    shadowColor: '#18181B',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  total: {
    marginTop: 1,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  error: {
    fontSize: 14,
    color: colors.danger,
    fontWeight: '600',
  },
});
