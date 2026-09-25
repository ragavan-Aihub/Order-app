import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PaymentBadge } from '@/components/PaymentBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, spacing } from '@/config/theme';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { getMyOrders } from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';
import type { Order } from '@/types/order';
import { formatDateTime, formatOrderNumber, formatPrice } from '@/utils/format';

export default function MyOrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
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
      const rows = await getMyOrders();
      setOrders(rows);
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
        title="My orders"
        message="Sign in with your mobile number to see your orders."
        actionLabel="Sign in"
        onAction={() => router.push({ pathname: '/login', params: { next: 'orders' } })}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>My orders</Text>
      {offline ? <OfflineBanner /> : null}
      {orders.length === 0 ? (
        <Text style={styles.message}>
          {offline
            ? 'Connect to the internet to load your orders.'
            : 'You have not placed an order yet. Shop from Home to get started.'}
        </Text>
      ) : (
        orders.map((order) => (
          <Pressable
            key={order.id}
            onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
            style={styles.card}
            accessibilityRole="button"
          >
            <View style={styles.cardTop}>
              <Text style={styles.number}>{formatOrderNumber(order.order_number)}</Text>
              <StatusBadge status={order.status} />
            </View>
            <View style={styles.payRow}>
              <Text style={styles.meta}>Payment</Text>
              <PaymentBadge
                method={order.payment_method ?? 'pending'}
                orderStatus={order.status}
                refundStatus={order.refund_status}
              />
            </View>
            <Text style={styles.meta}>{formatDateTime(order.created_at)}</Text>
            <View style={styles.cardBottom}>
              <Text style={styles.total}>{formatPrice(order.total_amount)}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardBottom: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  number: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 15,
    color: colors.textMuted,
  },
  total: {
    marginTop: spacing.xs,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
});
