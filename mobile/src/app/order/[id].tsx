import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { goModifyOrder } from '@/cart/modify-flow';
import { OrderProgress } from '@/components/OrderProgress';
import { PaymentBadge } from '@/components/PaymentBadge';
import { colors, radius, spacing } from '@/config/theme';
import { cancelMyOrder, getMyOrderById } from '@/services/orders';
import { isOpenOrderStatus, type OrderWithItems } from '@/types/order';
import { displayPaymentStatus, formatDateTime, formatOrderNumber, formatOrderStatus, formatPrice, orderStatusTone } from '@/utils/format';

export default function OrderDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { beginEditOrder, forgetOpenOrder } = useCart();
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      } catch {
        if (!isRefresh) {
          setOrder(null);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
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
  const current = order;

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

  function openMore() {
    Alert.alert(`Order #${formatOrderNumber(current.order_number)}`, undefined, [
      { text: 'Cancel order', style: 'destructive', onPress: () => setTimeout(confirmCancel, 200) },
      { text: 'Close', style: 'cancel' },
    ]);
  }

  return (
    <>
    <Stack.Screen
      options={{
        headerRight: isOpenOrderStatus(order.status)
          ? () => (
              <Pressable
                onPress={openMore}
                hitSlop={10}
                style={styles.more}
                accessibilityRole="button"
                accessibilityLabel="More order options"
              >
                <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
              </Pressable>
            )
          : undefined,
      }}
    />
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
      }
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroTitle}>
            <Text style={styles.kicker}>Order</Text>
            <Text style={styles.number}>#{formatOrderNumber(order.order_number)}</Text>
          </View>
          <View style={[styles.statusHero, { backgroundColor: statusTone.bg }]}>
            <Text style={[styles.statusHeroLabel, { color: statusTone.fg }]}>
              {formatOrderStatus(order.status)}
            </Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={15} color={colors.textMuted} />
          <Text style={styles.meta}>Placed {formatDateTime(order.created_at)}</Text>
        </View>
        {displayPaymentStatus(order) === 'not_applicable' ? null : (
          <View style={styles.metaRow}>
            <Ionicons name="card-outline" size={15} color={colors.textMuted} />
            <Text style={styles.meta}>Payment</Text>
            <PaymentBadge
              method={order.payment_method ?? 'pending'}
              orderStatus={order.status}
              refundStatus={order.refund_status}
            />
          </View>
        )}
      </View>

      {isOpenOrderStatus(order.status) ? (
        <View style={styles.actions}>
          <Pressable
            onPress={() => goModifyOrder(order.id, beginEditOrder, order)}
            style={styles.modifyBtn}
          >
            <Text style={styles.modifyLabel}>Modify order</Text>
          </Pressable>
        </View>
      ) : null}

      {order.status === 'cancelled' ? (
        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.heading}>Cancelled</Text>
          </View>
          <Text style={styles.body}>{order.cancel_reason || 'This order was cancelled.'}</Text>
          <View style={styles.payRow}>
            <PaymentBadge
              method={order.payment_method ?? 'pending'}
              orderStatus={order.status}
              refundStatus={order.refund_status}
            />
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <Ionicons name="navigate-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.heading}>Progress</Text>
          </View>
          <OrderProgress status={order.status} />
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Ionicons name="bicycle-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.heading}>Delivery</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={16} color={colors.textMuted} />
          <Text style={styles.body}>{order.customer_name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="call-outline" size={16} color={colors.textMuted} />
          <Text style={styles.body}>{order.mobile}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color={colors.textMuted} />
          <Text style={styles.body}>
            {order.delivery_address}
            {'\n'}Pincode {order.pincode}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Ionicons name="bag-handle-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.heading}>Items</Text>
        </View>
        {order.order_items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemCopy}>
              <Text style={styles.itemName}>{item.product_name}</Text>
              <Text style={styles.itemQty}>× {item.quantity}</Text>
            </View>
            <Text style={styles.itemPrice}>{formatPrice(item.subtotal)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPrice(order.total_amount)}</Text>
        </View>
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
    paddingTop: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  hero: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroTitle: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  number: {
    marginTop: 1,
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  statusHero: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  statusHeroLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heading: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  body: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
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
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.text,
  },
  itemQty: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  totalRow: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
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
    fontSize: 20,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  actions: {
    gap: 8,
  },
  modifyBtn: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modifyLabel: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '800',
  },
  more: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
