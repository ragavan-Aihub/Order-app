import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { getDeliveryOrder, updateDeliveryOrderStatus } from '@/services/orders';
import { NEXT_STATUSES, orderStatusLabel, type OrderStatus, type OrderWithItems } from '@/types/order';
import { formatOrderNumber, formatPrice } from '@/utils/format';

function mapsUrl(address: string, pincode: string): string {
  const query = encodeURIComponent(`${address}${pincode ? ` ${pincode}` : ''}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export default function DeliveryOrderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Array.isArray(id) ? id[0] : id;
  const { profile } = useAuth();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.business_id || !orderId) {
      return;
    }
    setError(null);
    try {
      const row = await getDeliveryOrder(orderId, profile.business_id);
      setOrder(row);
      if (!row) {
        setError('Order not found.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load order.');
    }
  }, [orderId, profile?.business_id]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  async function applyStatus(next: OrderStatus) {
    if (!profile?.business_id || !order) {
      return;
    }
    setUpdating(true);
    const { error: updateError } = await updateDeliveryOrderStatus(order.id, profile.business_id, next);
    setUpdating(false);
    if (updateError) {
      Alert.alert('Could not update', updateError);
      return;
    }
    if (next === 'delivered') {
      router.back();
      return;
    }
    await load();
  }

  function confirmStatus(next: OrderStatus, label: string) {
    Alert.alert(label, `Mark this order as ${label.toLowerCase()}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: label, onPress: () => void applyStatus(next) },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Order not found.'}</Text>
      </View>
    );
  }

  const rawStatus = order.status as string;
  const normalizedStatus = (rawStatus === 'preparing' ? 'confirmed' : order.status) as OrderStatus;
  const nextStatuses = NEXT_STATUSES[normalizedStatus];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.orderNumber}>Order #{formatOrderNumber(order.order_number)}</Text>
        <Text style={styles.status}>{orderStatusLabel(order.status)}</Text>
        <Text style={styles.total}>{formatPrice(order.total_amount)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <Text style={styles.customerName}>{order.customer_name}</Text>
        <View style={styles.actions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => void Linking.openURL(`tel:${order.mobile}`)}
            accessibilityRole="button"
          >
            <Text style={styles.actionLabel}>Call</Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => void Linking.openURL(mapsUrl(order.delivery_address, order.pincode))}
            accessibilityRole="button"
          >
            <Text style={styles.actionLabel}>Maps</Text>
          </Pressable>
        </View>
        <Text style={styles.address}>{order.delivery_address}</Text>
        {order.pincode ? <Text style={styles.pincode}>PIN {order.pincode}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Items</Text>
        {order.order_items.map((item) => (
          <View key={item.id} style={styles.line}>
            <Text style={styles.lineName}>
              {item.quantity}× {item.product_name}
            </Text>
            <Text style={styles.linePrice}>{formatPrice(item.subtotal)}</Text>
          </View>
        ))}
      </View>

      {nextStatuses.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Update status</Text>
          {nextStatuses.includes('confirmed') ? (
            <PrimaryButton
              label="Confirm order"
              disabled={updating}
              onPress={() => confirmStatus('confirmed', 'Confirmed')}
            />
          ) : null}
          {nextStatuses.includes('out_for_delivery') ? (
            <PrimaryButton
              label="Start delivery"
              disabled={updating}
              onPress={() => confirmStatus('out_for_delivery', 'Out for delivery')}
            />
          ) : null}
          {nextStatuses.includes('delivered') ? (
            <PrimaryButton
              label="Mark delivered"
              disabled={updating}
              variant="success"
              onPress={() => confirmStatus('delivered', 'Delivered')}
            />
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'success';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        variant === 'success' && styles.primaryButtonSuccess,
        disabled && styles.primaryButtonDisabled,
        pressed && styles.primaryButtonPressed,
      ]}
      accessibilityRole="button"
    >
      {disabled ? (
        <ActivityIndicator color={colors.surface} />
      ) : (
        <Text style={styles.primaryButtonLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
    gap: spacing.xs,
  },
  orderNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  status: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  total: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionLabel: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  address: {
    color: colors.text,
    lineHeight: 22,
  },
  pincode: {
    color: colors.textMuted,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  lineName: {
    flex: 1,
    color: colors.text,
    paddingRight: spacing.sm,
  },
  linePrice: {
    fontWeight: '600',
    color: colors.text,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  primaryButtonSuccess: {
    backgroundColor: colors.success,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonLabel: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
});
