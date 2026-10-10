import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { goModifyOrder } from '@/cart/modify-flow';
import { OrderProgress, latestStatusTime } from '@/components/OrderProgress';
import { PaymentBadge } from '@/components/PaymentBadge';
import { colors, radius, spacing } from '@/config/theme';
import { OrderItemsWithPlacedDiff } from '@/components/OrderItemsWithPlacedDiff';
import {
  pickCustomerAdminOrderDiff,
  type CustomerAdminOrderDiff,
} from '@/order-modifications/shop-modified';
import { cancelMyOrder, getMyOrderById, getOrderModifications } from '@/services/orders';
import {
  canCancelOrder,
  canModifyOrder,
  isOpenOrderStatus,
  orderLockedMessage,
  orderShopModifiedMessage,
  type OrderWithItems,
} from '@/types/order';
import {
  formatOrderNumber,
  formatOrderStatus,
  formatPaymentSummaryLine,
  formatPlacedAt,
  formatPrice,
  formatStepTime,
  orderStatusTone,
} from '@/utils/format';

export default function OrderDetailScreen() {
  const insets = useSafeAreaInsets();
  const { beginEditOrder, forgetOpenOrder } = useCart();
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminOrderDiff, setAdminOrderDiff] = useState<CustomerAdminOrderDiff | null>(null);

  const refreshAdminModNotice = useCallback(async (orderId: string, items: OrderWithItems['order_items']) => {
    try {
      const mods = await getOrderModifications(orderId);
      const diff = pickCustomerAdminOrderDiff(mods, items);
      setAdminOrderDiff(diff);
    } catch {
      setAdminOrderDiff(null);
    }
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!id) {
        setLoading(false);
        return;
      }
      if (isRefresh) {
        setRefreshing(true);
      }
      try {
        const row = await getMyOrderById(id);
        setOrder(row);
        if (row) {
          await refreshAdminModNotice(row.id, row.order_items);
        }
      } catch {
        if (!isRefresh) {
          setOrder(null);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, refreshAdminModNotice],
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Order not found.</Text>
      </View>
    );
  }

  const statusTone = orderStatusTone(order.status);
  const cancelledAt = order.status === 'cancelled' ? latestStatusTime(order.status_events, 'cancelled') : null;
  const current = order;
  const orderTitle = `Order #${formatOrderNumber(order.order_number)}`;
  const paymentLine = formatPaymentSummaryLine(order);
  const deliveryLines = [order.delivery_address, order.pincode ? `Pincode ${order.pincode}` : null]
    .filter(Boolean)
    .join('\n');

  function confirmCancel() {
    Alert.alert(
      'Cancel this order?',
      `Order #${formatOrderNumber(current.order_number)} will be cancelled. This cannot be undone.`,
      [
        { text: 'Keep order', style: 'cancel' },
        {
          text: 'Cancel order',
          style: 'destructive',
          onPress: () => {
            cancelMyOrder(current.id)
              .then(() => {
                forgetOpenOrder(current.id);
                return load(true);
              })
              .catch((error) => {
                Alert.alert('Could not cancel', error instanceof Error ? error.message : 'Try again in a moment.');
              });
          },
        },
      ],
    );
  }

  const shopModified = adminOrderDiff !== null;
  const showModify = isOpenOrderStatus(order.status) && canModifyOrder(order) && !shopModified;
  const showCancel = canCancelOrder(order.status);
  const showModifyBlocked =
    isOpenOrderStatus(order.status) && !showModify && (shopModified || !canModifyOrder(order));
  const showOpenActions = showModify || showModifyBlocked || showCancel;

  return (
    <>
      <Stack.Screen options={{ title: orderTitle }} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
      >
        <View style={styles.summary}>
          <Text style={[styles.summaryStatus, { color: statusTone.fg }]}>{formatOrderStatus(order.status)}</Text>
          <Text style={styles.summaryMeta}>{formatPlacedAt(order.created_at)}</Text>
          {paymentLine ? <Text style={styles.summaryMeta}>{paymentLine}</Text> : null}
        </View>

        {showOpenActions ? (
          <View style={styles.actions}>
            {showModify ? (
              <Pressable
                onPress={() => goModifyOrder(order, beginEditOrder)}
                style={({ pressed }) => [styles.actionBtn, styles.modifyBtn, pressed && styles.modifyPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.modifyLabel}>Modify order</Text>
              </Pressable>
            ) : shopModified ? (
              <Text style={styles.limitText}>{orderShopModifiedMessage()}</Text>
            ) : isOpenOrderStatus(order.status) ? (
              <Text style={styles.limitText}>{orderLockedMessage(order.status)}</Text>
            ) : null}
            {showCancel ? (
              <Pressable
                onPress={confirmCancel}
                style={({ pressed }) => [styles.actionBtn, styles.cancelBtn, pressed && styles.cancelPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.cancelLabel}>Cancel order</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {order.status === 'cancelled' ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Cancelled</Text>
            <Text style={styles.bodyText}>{order.cancel_reason || 'This order was cancelled.'}</Text>
            {cancelledAt ? <Text style={styles.muted}>{formatStepTime(cancelledAt)}</Text> : null}
            <View style={styles.payRow}>
              <PaymentBadge
                method={order.payment_method ?? 'pending'}
                orderStatus={order.status}
                refundStatus={order.refund_status}
              />
            </View>
          </View>
        ) : (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Order progress</Text>
            <OrderProgress status={order.status} events={order.status_events} placedAt={order.created_at} />
          </View>
        )}

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Delivery</Text>
          <Text style={styles.bodyText}>{order.customer_name}</Text>
          <Text style={styles.bodyText}>{order.mobile}</Text>
          <Text style={styles.bodyText}>{deliveryLines}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Items</Text>
          {adminOrderDiff ? (
            <OrderItemsWithPlacedDiff diff={adminOrderDiff} />
          ) : (
            <>
              {order.order_items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.product_name}
                    </Text>
                    <Text style={styles.itemQty}>× {item.quantity}</Text>
                  </View>
                  <Text style={styles.itemPrice}>{formatPrice(item.subtotal)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatPrice(order.total_amount)}</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  empty: {
    fontSize: 16,
    color: colors.textMuted,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    gap: spacing.xs,
    backgroundColor: colors.background,
  },
  summary: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  summaryStatus: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.3,
  },
  summaryMeta: {
    fontSize: 13,
    lineHeight: 17,
    color: colors.textMuted,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 2,
  },
  actionBtn: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modifyBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelPressed: {
    opacity: 0.88,
    backgroundColor: '#FEE2E2',
  },
  cancelLabel: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  modifyPressed: {
    opacity: 0.88,
    backgroundColor: colors.primarySoft,
  },
  modifyLabel: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '700',
  },
  limitText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    fontWeight: '500',
  },
  block: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 3,
  },
  blockTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 1,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
    fontWeight: '500',
  },
  muted: {
    fontSize: 12,
    color: colors.textMuted,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 1,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemName: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: colors.text,
  },
  itemQty: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  totalRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  totalValue: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.primaryDark,
  },
});
