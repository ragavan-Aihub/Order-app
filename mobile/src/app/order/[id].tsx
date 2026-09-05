import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/config/theme';
import { getMyOrderById } from '@/services/orders';
import type { OrderWithItems } from '@/types/order';
import { formatDateTime, formatOrderNumber, formatOrderStatus, formatPrice } from '@/utils/format';

export default function OrderDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    getMyOrderById(id)
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

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

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg },
      ]}
    >
      <Text style={styles.number}>{formatOrderNumber(order.order_number)}</Text>
      <Text style={styles.status}>{formatOrderStatus(order.status)}</Text>
      <Text style={styles.meta}>Placed {formatDateTime(order.created_at)}</Text>

      <Text style={styles.heading}>Delivery</Text>
      <Text style={styles.body}>{order.customer_name}</Text>
      <Text style={styles.body}>{order.mobile}</Text>
      <Text style={styles.body}>{order.delivery_address}</Text>
      <Text style={styles.body}>Pincode {order.pincode}</Text>

      <Text style={styles.heading}>Items</Text>
      {order.order_items.map((item) => (
        <View key={item.id} style={styles.itemRow}>
          <Text style={styles.body}>
            {item.product_name} × {item.quantity}
          </Text>
          <Text style={styles.body}>{formatPrice(item.subtotal)}</Text>
        </View>
      ))}
      <Text style={styles.total}>Total {formatPrice(order.total_amount)}</Text>
    </ScrollView>
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
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.background,
  },
  number: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  status: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  meta: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  heading: {
    marginTop: spacing.md,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  total: {
    marginTop: spacing.md,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
});
