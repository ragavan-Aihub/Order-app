import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, spacing } from '@/config/theme';
import { getMyOrders } from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';
import type { Order } from '@/types/order';
import { formatDateTime, formatOrderNumber, formatOrderStatus, formatPrice } from '@/utils/format';

export default function MyOrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);

      getSignedInUser().then(async (user) => {
        if (!active) {
          return;
        }
        setSignedIn(Boolean(user));
        if (!user) {
          setOrders([]);
          setLoading(false);
          return;
        }
        const rows = await getMyOrders();
        if (active) {
          setOrders(rows);
          setLoading(false);
        }
      });

      return () => {
        active = false;
      };
    }, []),
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
      <View style={[styles.centered, styles.padded]}>
        <Text style={styles.title}>My orders</Text>
        <Text style={styles.message}>Sign in with your mobile number to see your orders.</Text>
        <PrimaryButton
          label="Sign in"
          onPress={() => router.push({ pathname: '/login', params: { next: 'orders' } })}
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg },
      ]}
    >
      <Text style={styles.title}>My orders</Text>
      {orders.length === 0 ? (
        <Text style={styles.message}>You have not placed an order yet.</Text>
      ) : (
        orders.map((order) => (
          <Pressable
            key={order.id}
            onPress={() => router.push(`/order/${order.id}`)}
            style={styles.card}
            accessibilityRole="button"
          >
            <Text style={styles.number}>{formatOrderNumber(order.order_number)}</Text>
            <Text style={styles.meta}>{formatOrderStatus(order.status)}</Text>
            <Text style={styles.meta}>{formatDateTime(order.created_at)}</Text>
            <Text style={styles.total}>{formatPrice(order.total_amount)}</Text>
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
  padded: {
    padding: spacing.md,
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
    gap: 4,
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
