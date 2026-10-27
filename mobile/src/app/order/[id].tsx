import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { goModifyOrder } from '@/cart/modify-flow';
import { OrderProgress, latestStatusTime } from '@/components/OrderProgress';
import { PaymentBadge } from '@/components/PaymentBadge';
import { ProductImage } from '@/components/ProductImage';
import { UpiPayBlock, UpiPayBlockLoading } from '@/components/UpiPayBlock';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { OrderItemsWithPlacedDiff } from '@/components/OrderItemsWithPlacedDiff';
import {
  pickCustomerAdminOrderDiff,
  type CustomerAdminOrderDiff,
} from '@/order-modifications/shop-modified';
import { refreshBusiness } from '@/services/business';
import { cancelMyOrder, getMyOrderById, getOrderModifications } from '@/services/orders';
import {
  canCancelOrder,
  canModifyOrder,
  isOpenOrderStatus,
  orderLockedMessage,
  orderShopModifiedMessage,
  type OrderWithItems,
} from '@/types/order';
import { formatOrderNumber, formatPrice, formatStepTime } from '@/utils/format';

function fullDeliveryAddress(order: OrderWithItems): string {
  const base = order.delivery_address.trim();
  if (order.pincode && !base.includes(order.pincode)) {
    return `${base}, ${order.pincode}`;
  }
  return base;
}

export default function OrderDetailScreen() {
  const insets = useSafeAreaInsets();
  const { beginEditOrder, forgetOpenOrder } = useCart();
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminOrderDiff, setAdminOrderDiff] = useState<CustomerAdminOrderDiff | null>(null);
  const [upiQrUrl, setUpiQrUrl] = useState<string | null>(null);
  const [upiQrLoading, setUpiQrLoading] = useState(false);

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
          const needsUpi =
            row.status === 'out_for_delivery' &&
            row.payment_method !== 'cash' &&
            row.payment_method !== 'upi';
          if (needsUpi) {
            setUpiQrLoading(true);
            try {
              const shop = await refreshBusiness();
              const url = shop?.upi_qr_url?.trim();
              setUpiQrUrl(url || null);
            } catch {
              setUpiQrUrl(null);
            } finally {
              setUpiQrLoading(false);
            }
          } else {
            setUpiQrUrl(null);
          }
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

  const cancelledAt = order.status === 'cancelled' ? latestStatusTime(order.status_events, 'cancelled') : null;
  const current = order;
  const orderTitle = `Order #${formatOrderNumber(order.order_number)}`;

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
  const modifyBlockedMessage = shopModified
    ? orderShopModifiedMessage()
    : isOpenOrderStatus(order.status)
      ? orderLockedMessage(order.status)
      : null;

  const lineCount = order.order_items.length;
  const itemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <Stack.Screen
        options={{
          title: orderTitle,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTitleStyle: { fontSize: 20, fontWeight: '800', color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm,
            flexGrow: 1,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
      >
        {showModifyBlocked && modifyBlockedMessage ? (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
            <Text style={styles.infoBannerText}>{modifyBlockedMessage}</Text>
          </View>
        ) : null}

        {showOpenActions ? (
          <View style={styles.actions}>
            {showModify ? (
              <Pressable
                onPress={() => goModifyOrder(order, beginEditOrder)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.modifyBtn,
                  styles.actionFlex,
                  !showCancel && styles.actionSolo,
                  pressed && styles.modifyPressed,
                ]}
                accessibilityRole="button"
              >
                <Text style={styles.modifyLabel}>Modify order</Text>
              </Pressable>
            ) : null}
            {showCancel ? (
              <Pressable
                onPress={confirmCancel}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.cancelBtn,
                  styles.actionFlex,
                  !showModify && styles.actionSolo,
                  pressed && styles.cancelPressed,
                ]}
                accessibilityRole="button"
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} style={styles.cancelIcon} />
                <Text style={styles.cancelLabel}>Cancel order</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {order.status === 'cancelled' ? (
          <View style={styles.sectionCard}>
            <Text style={styles.blockTitle}>Cancelled</Text>
            <Text style={styles.bodyText}>{order.cancel_reason || 'This order was cancelled.'}</Text>
            {cancelledAt ? <Text style={styles.muted}>{formatStepTime(cancelledAt)}</Text> : null}
            <View style={styles.payRowBlock}>
              <PaymentBadge
                method={order.payment_method ?? 'pending'}
                orderStatus={order.status}
                refundStatus={order.refund_status}
              />
            </View>
          </View>
        ) : (
          <View style={[styles.sectionCard, styles.sectionCardTint]}>
            <View style={styles.blockTitleRow}>
              <Text style={[styles.blockTitle, styles.blockTitleInRow]}>Order progress</Text>
              <PaymentBadge
                method={order.payment_method ?? 'pending'}
                orderStatus={order.status}
                refundStatus={order.refund_status}
              />
            </View>
            <OrderProgress
              visual="rich"
              status={order.status}
              events={order.status_events}
              placedAt={order.created_at}
            />
          </View>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.blockTitle}>Deliver to</Text>
          <View style={styles.addressBlock}>
            <Text style={styles.deliveryName}>{order.customer_name}</Text>
            <Text style={styles.addressText}>{fullDeliveryAddress(order)}</Text>
          </View>
        </View>

        {order.status === 'out_for_delivery' &&
        order.payment_method !== 'cash' &&
        order.payment_method !== 'upi' ? (
          upiQrLoading ? (
            <UpiPayBlockLoading />
          ) : upiQrUrl ? (
            <UpiPayBlock qrUrl={upiQrUrl} amount={order.total_amount} />
          ) : null
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.blockTitle}>
            Items ({itemCount} {itemCount === 1 ? 'item' : 'items'})
          </Text>
          {adminOrderDiff ? (
            <OrderItemsWithPlacedDiff diff={adminOrderDiff} />
          ) : (
            <>
              <View style={styles.itemHeaderRow}>
                <Text style={[styles.itemHeaderCell, styles.itemHeaderName]}>Item</Text>
                <Text style={[styles.itemHeaderCell, styles.itemHeaderQty]}>Qty</Text>
                <Text style={[styles.itemHeaderCell, styles.itemHeaderPrice]}>Price</Text>
              </View>
              {order.order_items.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.itemRow, index === lineCount - 1 && styles.itemRowLast]}
                >
                  <ProductImage
                    uri={item.image_url}
                    compact
                    style={styles.itemThumb}
                    recyclingKey={item.id}
                    accessibilityLabel={item.product_name}
                  />
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.product_name}
                  </Text>
                  <View style={styles.qtyPill}>
                    <Text style={styles.qtyPillText}>{item.quantity}x</Text>
                  </View>
                  <Text style={styles.itemPriceCol}>{formatPrice(item.subtotal)}</Text>
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
      </View>
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
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: '#FFF7ED',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FDBA74',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.warning,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  actionFlex: {
    flex: 1,
    minWidth: 0,
  },
  actionSolo: {
    flex: 1,
  },
  actionBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modifyBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  cancelIcon: {
    marginTop: 1,
  },
  cancelPressed: {
    opacity: 0.88,
    backgroundColor: '#FEE2E2',
  },
  cancelLabel: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '700',
  },
  modifyPressed: {
    opacity: 0.88,
    backgroundColor: colors.primarySoft,
  },
  modifyLabel: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.sm,
  },
  sectionCardTint: {
    backgroundColor: colors.surfaceInset,
  },
  blockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  blockTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.primaryDark,
    marginBottom: 2,
  },
  blockTitleInRow: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
    fontWeight: '500',
  },
  addressBlock: {
    marginTop: 2,
    padding: spacing.sm,
    backgroundColor: '#EEEDED',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 6,
  },
  deliveryName: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: colors.text,
  },
  addressText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    fontWeight: '500',
  },
  muted: {
    fontSize: 12,
    color: colors.textMuted,
  },
  payRowBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    marginBottom: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
  itemHeaderName: {
    flex: 1,
    minWidth: 0,
  },
  itemHeaderQty: {
    width: 44,
    textAlign: 'center',
  },
  itemHeaderPrice: {
    width: 72,
    textAlign: 'right',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  itemName: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: colors.text,
  },
  qtyPill: {
    minWidth: 36,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#3F3F46',
    alignItems: 'center',
  },
  qtyPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FAFAFA',
    fontVariant: ['tabular-nums'],
  },
  itemPriceCol: {
    width: 72,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  totalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    marginHorizontal: -spacing.xs,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
});
