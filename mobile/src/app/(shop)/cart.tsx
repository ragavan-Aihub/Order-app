import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView, ScrollView, Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getSelectedAddress,
  loadAddressBook,
  subscribeAddressBook,
  type SavedAddress,
} from '@/cart/address-book';
import { useCart } from '@/cart/CartContext';
import { alertModifyDiscarded, goModifyOrder } from '@/cart/modify-flow';
import { submitShopOrder } from '@/cart/submit-order';
import {
  AddressPickerSheet,
  savedAddressLabel,
  savedAddressLine,
} from '@/components/AddressPickerSheet';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QuantityStepper } from '@/components/QuantityStepper';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { checkOrderEditable } from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';
import type { OrderStatus } from '@/types/order';
import { formatOrderNumber, formatPrice } from '@/utils/format';

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, itemCount, totalAmount, increase, decrease, remove, clearCart, editingOrderId, beginEditOrder, hasOrderChanges, openOrder } =
    useCart();
  const { offline, requireConnection } = useNetworkStatus();
  const bottomPad = Math.max(insets.bottom, spacing.sm) + spacing.md;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<SavedAddress | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const discarding = useRef(false);

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
      if (items.length === 0) {
        router.replace('/home');
      }
    }, [items.length, loadAddress, router]),
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

  function confirmDiscardChanges() {
    Alert.alert('Discard changes?', 'Your order stays as it was saved.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard changes',
        style: 'destructive',
        onPress: () => {
          clearCart();
          router.replace('/home');
        },
      },
    ]);
  }

  const editingOpen = Boolean(openOrder && editingOrderId === openOrder.id);
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
      clearCart();
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {offline ? <OfflineBanner /> : null}
        {editingOpen && openOrder ? (
          <View style={styles.editBanner}>
            <Ionicons name="create-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.editTitle}>Editing order #{formatOrderNumber(openOrder.order_number)}</Text>
          </View>
        ) : null}
        <View style={styles.countRow}>
          <Text style={styles.count}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Text>
          {editingOpen ? (
            hasOrderChanges ? (
              <Pressable
                onPress={confirmDiscardChanges}
                style={({ pressed }) => [styles.dangerPill, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Discard changes"
              >
                <Ionicons name="arrow-undo-outline" size={16} color={colors.danger} />
                <Text style={styles.dangerPillLabel}>Discard changes</Text>
              </Pressable>
            ) : null
          ) : (
            <Pressable
              onPress={confirmClearCart}
              style={({ pressed }) => [styles.dangerPill, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Clear cart"
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={styles.dangerPillLabel}>Clear cart</Text>
            </Pressable>
          )}
        </View>
        {items.map((item) => {
          const subtotal = item.product.price * item.quantity;
          return (
            <Swipeable
              key={item.product.id}
              overshootRight={false}
              rightThreshold={40}
              onSwipeableRightOpen={() => remove(item.product.id)}
              renderRightActions={() => (
                <Pressable
                  onPress={() => remove(item.product.id)}
                  style={styles.deleteAction}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.product.name}`}
                >
                  <Ionicons name="trash-outline" size={22} color={colors.primaryText} />
                </Pressable>
              )}
            >
              <View
                style={styles.row}
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
                      onDecrease={() => decrease(item.product.id)}
                      onIncrease={() => increase(item.product.id)}
                    />
                  </View>
                </View>
              </View>
            </Swipeable>
          );
        })}
        <Pressable
          style={({ pressed }) => [styles.addMore, pressed && styles.pressed]}
          onPress={() => router.push('/home')}
          accessibilityRole="button"
        >
          <View style={styles.addMoreLeft}>
            <Ionicons name="add-circle" size={20} color={colors.primary} />
            <Text style={styles.addMoreLabel}>Add more items</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
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
        <View style={styles.totalRow}>
          <View>
            <Text style={styles.totalLabel}>To pay</Text>
            <Text style={styles.total}>{formatPrice(totalAmount)}</Text>
          </View>
          <Text style={styles.totalMeta}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Text>
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
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dangerPill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  dangerPillLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.danger,
  },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  editTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    ...shadow.sm,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  details: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
    gap: 4,
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
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    ...shadow.sm,
  },
  addMoreLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addMoreLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  bill: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadow.sm,
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
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  billTotalValue: {
    fontSize: 16,
    fontWeight: '800',
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
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  total: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  totalMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    paddingBottom: 4,
  },
  error: {
    fontSize: 14,
    color: colors.danger,
    fontWeight: '600',
  },
});
