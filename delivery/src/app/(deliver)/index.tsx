import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { PaymentStatusChip } from '@/components/PaymentStatusChip';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { listDeliveryOrders, listTodayDeliveredOrders } from '@/services/orders';
import type { Order } from '@/types/order';
import { formatOrderListDate, formatOrderNumber, formatPrice } from '@/utils/format';

type ListMode = 'pending' | 'delivered_today';

function mapsUrl(address: string, pincode: string): string {
  const query = encodeURIComponent(`${address}${pincode ? ` ${pincode}` : ''}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function listAddress(order: Order): string {
  const base = order.delivery_address.trim();
  if (order.pincode && !base.includes(order.pincode)) {
    return `${base}, ${order.pincode}`;
  }
  return base;
}

export default function DeliveryListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading: authLoading, profile, signOut } = useAuth();
  const [mode, setMode] = useState<ListMode>('pending');
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshPendingCount = useCallback(async () => {
    if (!profile?.business_id) {
      return;
    }
    try {
      const rows = await listDeliveryOrders(profile.business_id);
      setPendingCount(rows.length);
    } catch {
      /* keep last count */
    }
  }, [profile?.business_id]);

  const load = useCallback(async () => {
    if (!profile?.business_id) {
      return;
    }
    setError(null);
    try {
      const rows =
        mode === 'pending'
          ? await listDeliveryOrders(profile.business_id)
          : await listTodayDeliveredOrders(profile.business_id);
      setOrders(rows);
      if (mode === 'pending') {
        setPendingCount(rows.length);
      } else {
        void refreshPendingCount();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load orders.');
    }
  }, [mode, profile?.business_id, refreshPendingCount]);

  const initialLoad = useCallback(async () => {
    if (authLoading || !profile?.business_id) {
      return;
    }
    setLoading(true);
    await load();
    setLoading(false);
  }, [authLoading, load, profile?.business_id]);

  useFocusEffect(
    useCallback(() => {
      void initialLoad();
      void refreshPendingCount();
    }, [initialLoad, refreshPendingCount]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    void initialLoad();
  }, [mode, initialLoad]);

  const emptyTitle = mode === 'pending' ? 'No active deliveries' : 'Nothing delivered today yet';
  const pendingTabLabel =
    pendingCount > 0 ? `To deliver (${pendingCount})` : 'To deliver';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{"Today's deliveries"}</Text>
        <Pressable
          onPress={() => void signOut()}
          style={styles.signOutBtn}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.segmentRow}>
        <Pressable
          onPress={() => setMode('pending')}
          style={[styles.segment, mode === 'pending' && styles.segmentActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'pending' }}
        >
          <Text style={[styles.segmentLabel, mode === 'pending' && styles.segmentLabelActive]}>
            {pendingTabLabel}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('delivered_today')}
          style={[styles.segment, mode === 'delivered_today' && styles.segmentActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'delivered_today' }}
        >
          <Text style={[styles.segmentLabel, mode === 'delivered_today' && styles.segmentLabelActive]}>
            Delivered today
          </Text>
        </Pressable>
      </View>

      {loading || authLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void initialLoad()} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(deliver)/order/${item.id}`)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityRole="button"
            >
              <View style={styles.cardTop}>
                <Text style={styles.orderNumber}>Order #{formatOrderNumber(item.order_number)}</Text>
                {mode === 'pending' ? (
                  <OrderStatusBadge status={item.status} />
                ) : (
                  <PaymentStatusChip paymentMethod={item.payment_method} orderStatus={item.status} compact />
                )}
              </View>

              <Text style={styles.customer}>{item.customer_name}</Text>

              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={16} color={colors.textMuted} style={styles.addressIcon} />
                <Text style={styles.address}>{listAddress(item)}</Text>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaLeft}>
                  <Ionicons name="time-outline" size={15} color={colors.textMuted} />
                  <Text style={styles.meta}>
                    {mode === 'delivered_today'
                      ? formatOrderListDate(item.updated_at)
                      : formatOrderListDate(item.created_at)}
                  </Text>
                </View>
                <Text style={styles.total}>{formatPrice(item.total_amount)}</Text>
              </View>

              <View style={styles.cardActions}>
                <Pressable
                  onPress={() => void Linking.openURL(`tel:${item.mobile}`)}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${item.customer_name}`}
                >
                  <Ionicons name="call-outline" size={16} color={colors.primaryDark} />
                  <Text style={styles.actionLabel}>Call</Text>
                </Pressable>
                <Pressable
                  onPress={() => void Linking.openURL(mapsUrl(item.delivery_address, item.pincode))}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Open in maps"
                >
                  <Ionicons name="map-outline" size={16} color={colors.primaryDark} />
                  <Text style={styles.actionLabel}>Map</Text>
                </Pressable>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} style={styles.cardChevron} />
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  pageTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  signOut: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 15,
  },
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: 4,
    backgroundColor: '#E7E5E4',
    borderRadius: radius.md,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  segmentActive: {
    backgroundColor: colors.primaryDark,
    ...shadow.sm,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  segmentLabelActive: {
    color: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  cardPressed: {
    opacity: 0.94,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    flexShrink: 1,
  },
  customer: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: spacing.sm,
  },
  addressIcon: {
    marginTop: 2,
  },
  address: {
    flex: 1,
    color: colors.textMuted,
    lineHeight: 20,
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    paddingRight: spacing.sm,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  total: {
    fontWeight: '800',
    fontSize: 16,
    color: colors.text,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionBtnPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  cardChevron: {
    marginLeft: 'auto',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
  retry: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
});
