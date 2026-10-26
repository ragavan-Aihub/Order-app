import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { listDeliveryOrders } from '@/services/orders';
import { orderStatusLabel, type Order } from '@/types/order';
import { formatOrderListDate, formatOrderNumber, formatPrice } from '@/utils/format';

export default function DeliveryListScreen() {
  const router = useRouter();
  const { loading: authLoading, profile, signOut } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.business_id) {
      return;
    }
    setError(null);
    try {
      const rows = await listDeliveryOrders(profile.business_id);
      setOrders(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load orders.');
    }
  }, [profile?.business_id]);

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
    }, [initialLoad]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarHint}>Pending delivery · newest first</Text>
        <Pressable onPress={() => void signOut()} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.signOut}>Sign out</Text>
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
          <Text style={styles.emptyTitle}>No active deliveries</Text>
          <Text style={styles.emptyHint}>
            Placed, confirmed, and out-for-delivery orders appear here (same as admin Pending delivery).
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(deliver)/order/${item.id}`)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityRole="button"
            >
              <View style={styles.cardTop}>
                <Text style={styles.orderNumber}>#{formatOrderNumber(item.order_number)}</Text>
                <View
                  style={[
                    styles.badge,
                    item.status === 'out_for_delivery' ? styles.badgeActive : styles.badgeReady,
                  ]}
                >
                  <Text style={styles.badgeText}>{orderStatusLabel(item.status)}</Text>
                </View>
              </View>
              <Text style={styles.customer}>{item.customer_name}</Text>
              <Text style={styles.address} numberOfLines={2}>
                {item.delivery_address}
                {item.pincode ? ` · ${item.pincode}` : ''}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.meta}>{formatOrderListDate(item.created_at)}</Text>
                <Text style={styles.total}>{formatPrice(item.total_amount)}</Text>
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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toolbarHint: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
  },
  signOut: {
    color: colors.primary,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
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
    opacity: 0.92,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeReady: {
    backgroundColor: colors.primarySoft,
  },
  badgeActive: {
    backgroundColor: '#FFEDD5',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  customer: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  address: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  total: {
    fontWeight: '700',
    color: colors.text,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  emptyHint: {
    color: colors.textMuted,
    textAlign: 'center',
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
