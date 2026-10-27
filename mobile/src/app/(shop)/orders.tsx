import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTopInset } from '@/utils/safe-area';

import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PaymentBadge } from '@/components/PaymentBadge';
import { ProductImage } from '@/components/ProductImage';
import { buildOrderDiffTableRows, orderDiffHasChanges } from '@/order-modifications/diff';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { useNetworkStatus } from '@/network/NetworkProvider';
import {
  getLatestAdminModificationsByOrderId,
  getMyOrdersWithItems,
  getPlacedSnapshotsByOrderId,
} from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';
import { type OrderModification, type OrderWithItems } from '@/types/order';
import {
  displayPaymentStatus,
  formatOrderListHeadline,
  formatPlacedAtLine,
  formatPrice,
  orderStatusTone,
} from '@/utils/format';

/** Space above system nav + tab bar labels (screen is inside tab navigator). */
const TAB_BAR_CLEARANCE = 72;
const THUMB_VISIBLE = 4;

function OrderListStatusIcon({ status }: { status: string }) {
  const tone = orderStatusTone(status);
  if (status === 'delivered') {
    return <Ionicons name="checkmark-circle" size={22} color={tone.fg} />;
  }
  if (status === 'cancelled') {
    return <Ionicons name="close-circle" size={22} color={tone.fg} />;
  }
  if (status === 'out_for_delivery') {
    return <MaterialCommunityIcons name="moped" size={22} color={tone.fg} />;
  }
  if (status === 'confirmed') {
    return <Ionicons name="checkmark-circle-outline" size={22} color={tone.fg} />;
  }
  return <Ionicons name="time-outline" size={22} color={tone.fg} />;
}

export default function MyOrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [shopModifiedOrderIds, setShopModifiedOrderIds] = useState<Set<string>>(() => new Set());
  const { offline } = useNetworkStatus();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }
    try {
      const user = await getSignedInUser();
      setSignedIn(Boolean(user));
      if (!user) {
        setOrders([]);
        return;
      }
      const rows = await getMyOrdersWithItems();
      setOrders(rows);
      const orderIds = rows.map((row) => row.id);
      const [adminMods, placedByOrder] = await Promise.all([
        getLatestAdminModificationsByOrderId(orderIds),
        getPlacedSnapshotsByOrderId(orderIds),
      ]);
      const filteredMods = new Map<string, OrderModification>();
      for (const order of rows) {
        const mod = adminMods.get(order.id);
        const placed = placedByOrder.get(order.id) ?? [];
        if (!mod || mod.reason === 'reverted_to_placed') {
          continue;
        }
        if (!orderDiffHasChanges(buildOrderDiffTableRows(placed, mod.new_items))) {
          continue;
        }
        filteredMods.set(order.id, mod);
      }
      setShopModifiedOrderIds(new Set(filteredMods.keys()));
    } catch {
      setSignedIn(false);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  if (!signedIn) {
    return (
      <EmptyState
        title="Sign in to continue"
        message="Use your mobile number to see orders you have placed."
        actionLabel="Sign in"
        onAction={() => router.push({ pathname: '/login', params: { next: 'orders' } })}
      />
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topInset + spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.md) + TAB_BAR_CLEARANCE,
        },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
      }
    >
      {offline ? <OfflineBanner /> : null}
      <Text style={styles.screenTitle}>Your Orders</Text>
      {orders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="receipt-outline" size={28} color={colors.primary} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.message}>
            {offline
              ? 'Connect to the internet to load your orders.'
              : 'Shop from Home and your orders will show up here.'}
          </Text>
          {!offline ? (
            <Pressable
              onPress={() => router.push('/home')}
              style={styles.shopButton}
              accessibilityRole="button"
            >
              <Text style={styles.shopLabel}>Browse products</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        orders.map((order) => {
          const thumbs = order.order_items.slice(0, THUMB_VISIBLE);
          const extraThumbCount = Math.max(0, order.order_items.length - THUMB_VISIBLE);
          const paymentStatus = displayPaymentStatus({
            status: order.status,
            payment_method: order.payment_method,
            refund_status: order.refund_status,
          });
          const showPaymentBadge =
            paymentStatus === 'pending' ||
            paymentStatus === 'refund_pending' ||
            paymentStatus === 'refunded';

          return (
            <Pressable
              key={order.id}
              onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityRole="button"
            >
              <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                  <View style={styles.headlineRow}>
                    <Text style={styles.headline} numberOfLines={1}>
                      {formatOrderListHeadline(order.status)}
                    </Text>
                    <OrderListStatusIcon status={order.status} />
                  </View>
                  <Text style={styles.placedAt}>{formatPlacedAtLine(order.created_at)}</Text>
                </View>
                <View style={styles.headerRight}>
                  <Text style={styles.total}>{formatPrice(order.total_amount)}</Text>
                  <View style={styles.menuCircle}>
                    <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
                  </View>
                </View>
              </View>

              {shopModifiedOrderIds.has(order.id) ? (
                <Text style={styles.shopModified}>Shop modified this order</Text>
              ) : null}

              {thumbs.length > 0 ? (
                <View style={styles.thumbStrip}>
                  {thumbs.map((item) => (
                    <ProductImage
                      key={item.id}
                      uri={item.image_url}
                      compact
                      style={styles.thumbCell}
                      recyclingKey={item.id}
                      accessibilityLabel={item.product_name}
                    />
                  ))}
                  {extraThumbCount > 0 ? (
                    <View style={[styles.thumbCell, styles.thumbMore]}>
                      <Text style={styles.thumbMoreText}>+{extraThumbCount}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {showPaymentBadge ? (
                <View style={styles.paymentRow}>
                  <PaymentBadge
                    method={order.payment_method ?? 'pending'}
                    orderStatus={order.status}
                    refundStatus={order.refund_status}
                  />
                </View>
              ) : null}
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    flexGrow: 1,
    backgroundColor: colors.background,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  shopButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopLabel: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: '800',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.sm,
  },
  cardPressed: {
    opacity: 0.94,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  headline: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  placedAt: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    fontWeight: '500',
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  total: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  menuCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  shopModified: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.warning,
    marginTop: -4,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 2,
  },
  thumbCell: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  thumbMore: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F4F5',
  },
  thumbMoreText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
  },
});
