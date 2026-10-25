import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTopInset } from '@/utils/safe-area';

import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PaymentBadge } from '@/components/PaymentBadge';
import { StatusBadge } from '@/components/StatusBadge';
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
import { formatOrderListDate, formatOrderNumber, formatPrice, orderListRailColor } from '@/utils/format';

function itemSummary(order: OrderWithItems) {
  const names = order.order_items.map((item) => item.product_name).filter(Boolean);
  if (names.length === 0) {
    return 'Tap to view items';
  }
  const preview = names.slice(0, 2).join(', ');
  const extra = names.length - 2;
  return extra > 0 ? `${preview} +${extra}` : preview;
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
          paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md,
        },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
      }
    >
      {offline ? <OfflineBanner /> : null}
      <Text style={styles.screenTitle}>My orders</Text>
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
          const railColor = orderListRailColor(order);
          const qty = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
          return (
            <View key={order.id} style={styles.card}>
              <View style={[styles.rail, { backgroundColor: railColor }]} />
              <View style={styles.cardBody}>
                <Pressable
                  onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
                  accessibilityRole="button"
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.number} numberOfLines={2}>
                      # {formatOrderNumber(order.order_number)}
                      {shopModifiedOrderIds.has(order.id) ? (
                        <Text style={styles.shopModifiedInline}> (Shop modified)</Text>
                      ) : null}
                    </Text>
                    <Text style={styles.total}>{formatPrice(order.total_amount)}</Text>
                  </View>
                  <Text style={styles.items} numberOfLines={2}>
                    {qty > 0
                      ? `${qty} ${qty === 1 ? 'item' : 'items'} · ${itemSummary(order)}`
                      : itemSummary(order)}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>{formatOrderListDate(order.created_at)}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                  <View style={styles.badges}>
                    <StatusBadge status={order.status} />
                    <PaymentBadge
                      method={order.payment_method ?? 'pending'}
                      orderStatus={order.status}
                      refundStatus={order.refund_status}
                    />
                  </View>
                </Pressable>
              </View>
            </View>
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
    gap: spacing.md,
    flexGrow: 1,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.text,
    marginBottom: 2,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
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
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow.sm,
  },
  rail: {
    width: 5,
  },
  cardBody: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  number: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  shopModifiedInline: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.warning,
  },
  total: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  items: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
