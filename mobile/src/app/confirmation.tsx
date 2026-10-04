import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatSavedAddressLabel, getAddressBook, splitDeliveryAddress } from '@/cart/address-book';
import { useCart } from '@/cart/CartContext';
import { goModifyOrder } from '@/cart/modify-flow';
import { OrderProgress } from '@/components/OrderProgress';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { cancelMyOrder, getMyOrderById } from '@/services/orders';
import { canCancelOrder, isOpenOrderStatus, type OrderWithItems } from '@/types/order';
import { formatOrderNumber, formatOrderStatus, formatPrice } from '@/utils/format';

const BAND_SUCCESS = '#E3F3EC';
const BAND_CANCELLED = '#FDECEC';

function first(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw !== 'undefined' ? raw : undefined;
}

function shortAddress(full: string) {
  const { address } = splitDeliveryAddress(full);
  return address.split(',')[0]?.trim() || address.trim();
}

export default function OrderStatusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { beginEditOrder, forgetOpenOrder } = useCart();
  const params = useLocalSearchParams<{
    id?: string;
    orderNumber?: string;
    number?: string;
    status?: string;
    total?: string;
    fresh?: string;
  }>();
  const id = first(params.id);
  const fresh = first(params.fresh);
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showAddress, setShowAddress] = useState(false);

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
        if (row) {
          setOrder(row);
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
      load(false).catch(() => undefined);
    }, [load]),
  );

  const status = order?.status ?? first(params.status) ?? 'new';
  const orderNumber = order?.order_number ?? first(params.orderNumber) ?? first(params.number);
  const total = order?.total_amount ?? (first(params.total) ? Number(first(params.total)) : null);
  const cancelled = status === 'cancelled';
  const canChange = Boolean(order && isOpenOrderStatus(order.status));
  const bandColor = cancelled ? BAND_CANCELLED : BAND_SUCCESS;

  const headline = cancelled
    ? 'Order cancelled'
    : status === 'delivered'
      ? 'Order delivered'
      : fresh === 'updated'
        ? 'Order updated successfully'
        : fresh === 'placed' && status === 'new'
          ? 'Thank you! Your order is placed.'
          : formatOrderStatus(status);

  const savedAddress = order?.customer_address_id
    ? getAddressBook().find((item) => item.id === order.customer_address_id)
    : undefined;
  const placeName = savedAddress ? formatSavedAddressLabel(savedAddress.label) : null;
  const streetLine = order ? shortAddress(order.delivery_address) : null;

  function confirmCancel() {
    if (!order) {
      return;
    }
    Alert.alert(
      'Cancel this order?',
      `Order #${formatOrderNumber(order.order_number)} will be cancelled. This cannot be undone.`,
      [
        { text: 'Keep order', style: 'cancel' },
        {
          text: 'Cancel order',
          style: 'destructive',
          onPress: () => {
            setCancelling(true);
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
              })
              .finally(() => setCancelling(false));
          },
        },
      ],
    );
  }

  function openMore() {
    if (!order || !canChange) {
      return;
    }
    Alert.alert(`Order #${formatOrderNumber(order.order_number)}`, undefined, [
      { text: 'Modify order', onPress: () => goModifyOrder(order, beginEditOrder) },
      ...(canCancelOrder(order.status)
        ? [{ text: 'Cancel order', style: 'destructive' as const, onPress: () => setTimeout(confirmCancel, 200) }]
        : []),
      { text: 'Close', style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Order status',
          headerStyle: { backgroundColor: bandColor },
          headerShadowVisible: false,
          headerRight: canChange
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
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
      >
        <View style={[styles.band, { backgroundColor: bandColor }]} pointerEvents="none" />
        <View style={styles.hero}>
          <View style={[styles.heroIcon, cancelled && styles.heroIconCancelled]}>
            <Ionicons
              name={cancelled ? 'close' : 'checkmark'}
              size={28}
              color={colors.primaryText}
            />
          </View>
          <Text style={styles.orderNumber}>
            Order #{orderNumber != null ? formatOrderNumber(orderNumber) : '—'}
          </Text>
          <Text style={[styles.headline, cancelled && styles.headlineCancelled]}>{headline}</Text>
          <View style={styles.heroDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{total != null ? formatPrice(total) : '—'}</Text>
          </View>
          <View style={styles.payRow}>
            <Ionicons name="cash-outline" size={14} color={colors.textMuted} />
            <Text style={styles.payNote}>Pay on delivery · Cash or UPI</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.deliverRow}>
            <View style={styles.deliverIcon}>
              <Ionicons name="location" size={18} color={colors.primary} />
            </View>
            <View style={styles.deliverCopy}>
              <Text style={styles.deliverText} numberOfLines={1}>
                <Text style={styles.deliverKicker}>Delivering to · </Text>
                {placeName ?? streetLine ?? '…'}
              </Text>
              {placeName && streetLine && !showAddress ? (
                <Text style={styles.deliverPreview} numberOfLines={1}>
                  {streetLine}
                </Text>
              ) : null}
            </View>
            {order ? (
              <Pressable
                onPress={() => setShowAddress((open) => !open)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ expanded: showAddress }}
              >
                <Text style={styles.link}>{showAddress ? 'Hide' : 'View address'}</Text>
              </Pressable>
            ) : null}
          </View>
          {order && showAddress ? (
            <View style={styles.addressFull}>
              <Text style={styles.addressText}>
                {splitDeliveryAddress(order.delivery_address).address}
                {order.pincode ? `, ${order.pincode}` : ''}
              </Text>
              <Text style={styles.addressMeta}>
                {order.customer_name} · {order.mobile}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order status</Text>
          {loading && !order ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <OrderProgress status={status} events={order?.status_events} placedAt={order?.created_at} />
          )}
          {cancelling ? (
            <View style={styles.cancellingRow}>
              <ActivityIndicator size="small" color={colors.danger} />
              <Text style={styles.cancellingText}>Cancelling your order…</Text>
            </View>
          ) : null}
        </View>

        {order ? (
          <Pressable
            onPress={() => router.push(`/order/${order.id}`)}
            style={({ pressed }) => [styles.detailsRow, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="receipt-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.detailsLabel}>
              View order details
              {order.order_items.length
                ? ` · ${order.order_items.length} ${order.order_items.length === 1 ? 'item' : 'items'}`
                : ''}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.sm }]}>
        <PrimaryButton label="Back to home" onPress={() => router.replace('/home')} />
        <Pressable
          onPress={() => router.replace('/orders')}
          style={styles.footerLink}
          hitSlop={6}
          accessibilityRole="button"
        >
          <Text style={styles.link}>View all orders</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  more: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 170,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 20,
    paddingBottom: spacing.md,
    alignItems: 'center',
    ...shadow.sm,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 5,
    borderColor: '#DCFCE7',
  },
  heroIconCancelled: {
    backgroundColor: colors.danger,
    borderColor: '#FEE2E2',
  },
  orderNumber: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.text,
  },
  headline: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
    textAlign: 'center',
  },
  headlineCancelled: {
    color: colors.danger,
  },
  heroDivider: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: spacing.md,
    marginBottom: 12,
  },
  totalRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  totalValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: colors.text,
  },
  payRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  payNote: {
    fontSize: 12.5,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  deliverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deliverIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliverCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  deliverText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  deliverKicker: {
    fontWeight: '500',
    color: colors.textMuted,
  },
  deliverPreview: {
    fontSize: 13,
    color: colors.textMuted,
  },
  link: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  addressFull: {
    marginLeft: 46,
    gap: 4,
  },
  addressText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  addressMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  loader: {
    marginVertical: spacing.md,
  },
  cancellingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cancellingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  detailsLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  pressed: {
    opacity: 0.85,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerLink: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
});
