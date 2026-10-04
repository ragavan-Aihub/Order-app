import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { goModifyOrder } from '@/cart/modify-flow';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PaymentBadge } from '@/components/PaymentBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, radius, spacing } from '@/config/theme';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { cancelMyOrder, getMyOrdersWithItems } from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';
import { canCancelOrder, canModifyOrder, isOpenOrderStatus, type OrderWithItems } from '@/types/order';
import { formatOrderListDate, formatOrderNumber, formatPrice, orderStatusTone } from '@/utils/format';

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
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const { beginEditOrder, forgetOpenOrder } = useCart();
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
      setOrders(await getMyOrdersWithItems());
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
          paddingTop: insets.top + spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md,
        },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
      }
    >
      {offline ? <OfflineBanner /> : null}
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
          const tone = orderStatusTone(order.status);
          const qty = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
          const open = isOpenOrderStatus(order.status);
          return (
            <View key={order.id} style={styles.card}>
              <View style={[styles.rail, { backgroundColor: tone.fg }]} />
              <View style={styles.cardBody}>
                <Pressable
                  onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
                  accessibilityRole="button"
                >
                <View style={styles.cardTop}>
                  <Text style={styles.number}>#{formatOrderNumber(order.order_number)}</Text>
                  <Text style={styles.total}>{formatPrice(order.total_amount)}</Text>
                </View>
                <Text style={styles.items} numberOfLines={2}>
                  {qty > 0 ? `${qty} ${qty === 1 ? 'item' : 'items'} · ${itemSummary(order)}` : itemSummary(order)}
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
                {open ? (
                  <View style={styles.openActions}>
                    {canModifyOrder(order) ? (
                      <Pressable
                        onPress={() => goModifyOrder(order, beginEditOrder)}
                        style={styles.actionBtn}
                      >
                        <Text style={styles.actionLabel}>Modify</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.limitNote}>
                        <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
                        <Text style={styles.limitText}>Modify limit reached</Text>
                      </View>
                    )}
                    {canCancelOrder(order.status) ? (
                      <Pressable
                        onPress={() => {
                          Alert.alert('Cancel order?', `Cancel order #${formatOrderNumber(order.order_number)}?`, [
                            { text: 'Keep', style: 'cancel' },
                            {
                              text: 'Cancel order',
                              style: 'destructive',
                              onPress: () => {
                                cancelMyOrder(order.id)
                                  .then(() => {
                                    forgetOpenOrder(order.id);
                                    return load(true);
                                  })
                                  .catch((error) => {
                                    Alert.alert(
                                      'Could not cancel',
                                      error instanceof Error ? error.message : 'Try again in a moment.',
                                    );
                                    return load(true);
                                  });
                              },
                            },
                          ]);
                        }}
                        style={styles.actionBtnGhost}
                      >
                        <Text style={styles.actionGhost}>Cancel</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
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
    gap: spacing.sm,
    flexGrow: 1,
    backgroundColor: colors.background,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
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
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
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
  openActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  actionLabel: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '800',
  },
  limitNote: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  limitText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtnGhost: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  actionGhost: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
});
