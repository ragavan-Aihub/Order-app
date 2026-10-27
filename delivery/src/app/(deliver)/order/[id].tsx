import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { DeliverPaymentModal } from '@/components/DeliverPaymentModal';
import { DeliveryMapThumb } from '@/components/DeliveryMapThumb';
import { OrderItemThumb } from '@/components/OrderItemThumb';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { PaymentStatusChip } from '@/components/PaymentStatusChip';
import { SectionCard } from '@/components/SectionCard';
import { SwipeActionButton, type SwipeActionKind } from '@/components/SwipeActionButton';
import { colors, radius, spacing } from '@/config/theme';
import { getDeliveryOrder, updateDeliveryOrderStatus } from '@/services/orders';
import { NEXT_STATUSES, type OrderStatus, type OrderWithItems } from '@/types/order';
import { formatOrderNumber, formatPrice } from '@/utils/format';

function mapsUrl(address: string, pincode: string): string {
  const query = encodeURIComponent(`${address}${pincode ? ` ${pincode}` : ''}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function fullAddress(order: OrderWithItems): string {
  const base = order.delivery_address.trim();
  if (order.pincode && !base.includes(order.pincode)) {
    return `${base} - ${order.pincode}`;
  }
  return base;
}

function swipeLabelForNext(next: OrderStatus | null): string | null {
  if (next === 'confirmed') {
    return 'Swipe to confirm order';
  }
  if (next === 'out_for_delivery') {
    return 'Swipe to start delivery';
  }
  if (next === 'delivered') {
    return 'Swipe to mark delivered';
  }
  return null;
}

function swipeKindForNext(next: OrderStatus | null): SwipeActionKind {
  if (next === 'confirmed') {
    return 'confirm';
  }
  if (next === 'delivered') {
    return 'deliver';
  }
  return 'dispatch';
}

const ITEM_SCROLL_THRESHOLD = 5;

function primaryNextAction(status: OrderStatus): OrderStatus | null {
  const next = NEXT_STATUSES[status];
  if (next.includes('out_for_delivery') && status === 'confirmed') {
    return 'out_for_delivery';
  }
  if (next.includes('confirmed') && status === 'new') {
    return 'confirmed';
  }
  if (next.includes('delivered')) {
    return 'delivered';
  }
  if (next.includes('confirmed')) {
    return 'confirmed';
  }
  return next[0] ?? null;
}

export default function DeliveryOrderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Array.isArray(id) ? id[0] : id;
  const { profile } = useAuth();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliverModalOpen, setDeliverModalOpen] = useState(false);
  const [confirmedBanner, setConfirmedBanner] = useState(false);

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

  useEffect(() => {
    if (!confirmedBanner) {
      return;
    }
    const timer = setTimeout(() => setConfirmedBanner(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmedBanner]);

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
    if (next === 'confirmed') {
      setConfirmedBanner(true);
    }
    await load();
  }

  function onSwipeComplete(next: OrderStatus) {
    if (next === 'delivered') {
      setDeliverModalOpen(true);
      return;
    }
    void applyStatus(next);
  }

  async function copyAddress() {
    if (!order) {
      return;
    }
    await Clipboard.setStringAsync(fullAddress(order));
    Alert.alert('Copied', 'Address copied to clipboard.');
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
  const nextAction = primaryNextAction(normalizedStatus);
  const swipeLabel = swipeLabelForNext(nextAction);
  const itemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
  const lineCount = order.order_items.length;
  const addressText = fullAddress(order);
  const needsScroll = lineCount > ITEM_SCROLL_THRESHOLD || addressText.length > 120;
  const compact = !needsScroll;
  const footerPad = nextAction ? (compact ? 88 : 120) + insets.bottom : spacing.xl;

  const body = (
    <>
      <SectionCard title="Pricing & payment" compact={compact}>
        <Text style={[styles.totalAmount, compact && styles.totalAmountCompact]}>
          {formatPrice(order.total_amount)}
        </Text>
        <PaymentStatusChip
          paymentMethod={order.payment_method}
          orderStatus={order.status}
          compact={compact}
        />
      </SectionCard>

      <SectionCard title="Customer" compact={compact}>
        <Text style={[styles.customerName, compact && styles.customerNameCompact]}>{order.customer_name}</Text>
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              compact && styles.actionBtnCompact,
              styles.actionBtnSoft,
              pressed && styles.actionPressed,
            ]}
            onPress={() => void Linking.openURL(`tel:${order.mobile}`)}
            accessibilityRole="button"
          >
            <Ionicons name="call-outline" size={compact ? 16 : 18} color={colors.primaryDark} />
            <Text style={[styles.actionBtnLabel, compact && styles.actionBtnLabelCompact]}>Call</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              compact && styles.actionBtnCompact,
              styles.actionBtnSolid,
              pressed && styles.actionPressed,
            ]}
            onPress={() => void Linking.openURL(mapsUrl(order.delivery_address, order.pincode))}
            accessibilityRole="button"
          >
            <Ionicons name="location-outline" size={compact ? 16 : 18} color="#FFFFFF" />
            <Text style={[styles.actionBtnLabelSolid, compact && styles.actionBtnLabelCompact]}>Maps</Text>
          </Pressable>
        </View>
        <View style={[styles.addressBox, compact && styles.addressBoxCompact]}>
          <DeliveryMapThumb
            size={compact ? 80 : 92}
            onPress={() => void Linking.openURL(mapsUrl(order.delivery_address, order.pincode))}
          />
          <View style={styles.addressTextWrap}>
            <Text style={[styles.addressText, compact && styles.addressTextCompact]} selectable>
              {addressText}
            </Text>
            <Pressable onPress={() => void copyAddress()} style={styles.copyRow} accessibilityRole="button">
              <Ionicons name="copy-outline" size={15} color={colors.primary} />
              <Text style={styles.copyLabel}>Copy address</Text>
            </Pressable>
          </View>
        </View>
      </SectionCard>

      <SectionCard title={`Items (${itemCount})`} compact={compact}>
        {order.order_items.map((item, index) => (
          <View key={item.id} style={[styles.itemRow, compact && styles.itemRowCompact, index > 0 && styles.itemRowBorder]}>
            <OrderItemThumb
              name={item.product_name}
              imageUrl={item.image_url}
              quantity={item.quantity}
              size={compact ? 40 : 48}
            />
            <Text style={[styles.itemName, compact && styles.itemNameCompact]} numberOfLines={compact ? 2 : 3}>
              {item.product_name}
            </Text>
            <Text style={[styles.itemPrice, compact && styles.itemPriceCompact]}>{formatPrice(item.subtotal)}</Text>
          </View>
        ))}
      </SectionCard>
    </>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={[styles.topBar, compact && styles.topBarCompact]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" hitSlop={8}>
            <Ionicons name="chevron-back" size={compact ? 22 : 26} color={colors.text} />
          </Pressable>
          <Text style={[styles.topTitle, compact && styles.topTitleCompact]}>
            Order #{formatOrderNumber(order.order_number)}
          </Text>
          <OrderStatusBadge status={order.status} />
        </View>

        {confirmedBanner ? (
          <View style={styles.confirmedBanner} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <Text style={styles.confirmedBannerText}>Order is confirmed</Text>
          </View>
        ) : null}

        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={[styles.scroll, compact && styles.scrollCompact, { paddingBottom: footerPad }]}
          scrollEnabled={needsScroll}
          showsVerticalScrollIndicator={needsScroll}
          bounces={needsScroll}
        >
          {body}
        </ScrollView>

        {nextAction && swipeLabel ? (
          <View style={[styles.footer, compact && styles.footerCompact, { paddingBottom: Math.max(insets.bottom, 6) }]}>
            {!compact ? <Text style={styles.footerTitle}>Update status</Text> : null}
            <SwipeActionButton
              label={swipeLabel}
              actionKind={swipeKindForNext(nextAction)}
              loading={updating}
              disabled={updating}
              compact={compact}
              variant={nextAction === 'delivered' ? 'success' : 'primary'}
              onComplete={() => onSwipeComplete(nextAction)}
            />
          </View>
        ) : null}
      </View>

      {profile?.business_id && order ? (
        <DeliverPaymentModal
          visible={deliverModalOpen}
          businessId={profile.business_id}
          orderId={order.id}
          amount={order.total_amount}
          onClose={() => setDeliverModalOpen(false)}
          onDelivered={() => {
            setDeliverModalOpen(false);
            router.back();
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  topBarCompact: {
    paddingBottom: 4,
  },
  topTitleCompact: {
    fontSize: 16,
  },
  bodyScroll: {
    flex: 1,
  },
  scrollCompact: {
    flexGrow: 1,
  },
  backBtn: {
    padding: 4,
  },
  topTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  scroll: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  totalAmountCompact: {
    fontSize: 28,
    lineHeight: 32,
  },
  customerName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  customerNameCompact: {
    fontSize: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.sm,
  },
  actionBtnCompact: {
    paddingVertical: 8,
    gap: 6,
  },
  actionBtnLabelCompact: {
    fontSize: 14,
  },
  actionBtnSoft: {
    backgroundColor: colors.primarySoft,
  },
  actionBtnSolid: {
    backgroundColor: colors.primary,
  },
  actionPressed: {
    opacity: 0.88,
  },
  actionBtnLabel: {
    fontWeight: '700',
    color: colors.primaryDark,
    fontSize: 15,
  },
  actionBtnLabelSolid: {
    fontWeight: '700',
    color: '#FFFFFF',
    fontSize: 15,
  },
  addressBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    minHeight: 108,
  },
  addressBoxCompact: {
    minHeight: 96,
    padding: 8,
  },
  addressTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  addressText: {
    flex: 1,
    color: colors.text,
    lineHeight: 22,
    fontSize: 15,
  },
  addressTextCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  copyLabel: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  itemRowCompact: {
    paddingVertical: 4,
    gap: 8,
  },
  itemRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  itemNameCompact: {
    fontSize: 14,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  itemPriceCompact: {
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  footerCompact: {
    paddingTop: 6,
    gap: 4,
  },
  footerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  confirmedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: '#ECFDF5',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  confirmedBannerText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.success,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
});
