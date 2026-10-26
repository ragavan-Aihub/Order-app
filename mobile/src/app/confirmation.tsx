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
import { ProductImage } from '@/components/ProductImage';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { cancelMyOrder, getMyOrderById } from '@/services/orders';
import { canCancelOrder, isOpenOrderStatus, type OrderWithItems } from '@/types/order';
import {
  ORDER_AWAITING_SHOP_NOTE,
  formatOrderNumber,
  formatOrderStatus,
  formatPrice,
} from '@/utils/format';

const BAND_SUCCESS = '#E8F7F0';
const BAND_CANCELLED = '#FEF2F2';

const CONFETTI = [
  { left: '6%', top: 18, w: 7, h: 3, color: '#FDE68A', rotate: '24deg' },
  { left: '18%', top: 42, w: 6, h: 3, color: '#86EFAC', rotate: '-18deg' },
  { left: '72%', top: 14, w: 8, h: 3, color: '#FBCFE8', rotate: '12deg' },
  { left: '84%', top: 38, w: 6, h: 3, color: '#93C5FD', rotate: '-28deg' },
  { left: '58%', top: 8, w: 5, h: 3, color: '#FDBA74', rotate: '32deg' },
  { left: '38%', top: 28, w: 6, h: 3, color: '#C4B5FD', rotate: '-8deg' },
  { left: '12%', top: 8, w: 5, h: 2, color: '#FDA4AF', rotate: '16deg' },
  { left: '90%', top: 12, w: 5, h: 2, color: '#A7F3D0', rotate: '-22deg' },
] as const;

function first(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw !== 'undefined' ? raw : undefined;
}

function shortAddress(full: string) {
  const { address } = splitDeliveryAddress(full);
  return address.split(',')[0]?.trim() || address.trim();
}

function DeliveryMapThumb() {
  return (
    <View style={styles.mapThumb}>
      <View style={styles.mapRoadH} />
      <View style={[styles.mapRoadH, styles.mapRoadHMid]} />
      <View style={styles.mapRoadV} />
      <View style={styles.mapPark} />
      <Ionicons name="location" size={20} color={colors.success} style={styles.mapPinIcon} />
    </View>
  );
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
  const canvasColor = cancelled ? colors.background : bandColor;
  const celebrate = !cancelled;

  const headline = cancelled
    ? 'Order cancelled'
    : status === 'delivered'
      ? 'Order delivered'
      : fresh === 'updated'
        ? 'Order updated successfully'
        : fresh === 'placed' && status === 'new'
          ? 'Order received'
          : formatOrderStatus(status);

  const showAwaitingShopNote = !cancelled && status === 'new';

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
    <View style={[styles.screen, { backgroundColor: canvasColor }]}>
      <Stack.Screen
        options={{
          title: 'Order status',
          headerStyle: { backgroundColor: canvasColor },
          headerShadowVisible: false,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={() => router.replace('/home')}
              hitSlop={10}
              style={styles.headerBack}
              accessibilityRole="button"
              accessibilityLabel="Back to home"
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          ),
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
        style={[styles.scroll, { backgroundColor: canvasColor }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
      >
        <View style={styles.heroWrap}>
          <View style={[styles.heroBadge, cancelled && styles.heroBadgeCancelled]}>
            <Ionicons
              name={cancelled ? 'close' : 'checkmark'}
              size={28}
              color={colors.primaryText}
            />
          </View>
          <View style={styles.hero}>
            <View
              style={[
                styles.heroHead,
                celebrate && styles.heroHeadCelebrate,
                cancelled && styles.heroHeadCancelled,
              ]}
            >
              {celebrate && status === 'new'
                ? CONFETTI.map((piece, index) => (
                    <View
                      key={index}
                      pointerEvents="none"
                      style={[
                        styles.confettiPiece,
                        {
                          left: piece.left,
                          top: piece.top,
                          width: piece.w,
                          height: piece.h,
                          backgroundColor: piece.color,
                          transform: [{ rotate: piece.rotate }],
                        },
                      ]}
                    />
                  ))
                : null}
              <Text style={[styles.orderNumber, celebrate && styles.orderNumberCelebrate]}>
                Order #{orderNumber != null ? formatOrderNumber(orderNumber) : '—'}
              </Text>
              <Text
                style={[
                  styles.headline,
                  celebrate && styles.headlineCelebrate,
                  cancelled && styles.headlineCancelled,
                ]}
              >
                {headline}
              </Text>
              {showAwaitingShopNote ? (
                <Text style={[styles.headlineNote, celebrate && styles.headlineNoteCelebrate]} numberOfLines={3}>
                  {ORDER_AWAITING_SHOP_NOTE}
                </Text>
              ) : null}
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.totalRow}>
              <View style={styles.totalLeft}>
                <Text style={styles.totalLabel}>Total</Text>
                <View style={styles.payRow}>
                  <Ionicons name="wallet-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.payNote}>Pay on delivery · Cash or UPI</Text>
                </View>
              </View>
              <Text style={styles.totalValue}>{total != null ? formatPrice(total) : '—'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.groupCard}>
          <View style={styles.groupSection}>
            <View style={styles.deliverRow}>
              <DeliveryMapThumb />
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
        </View>

        <View style={styles.groupCard}>
          <View style={styles.groupSection}>
            <Text style={styles.statusCardTitle}>Order status</Text>
            {loading && !order ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : (
              <OrderProgress
                visual="rich"
                compact
                status={status}
                events={order?.status_events}
                placedAt={order?.created_at}
              />
            )}
            {cancelling ? (
              <View style={styles.cancellingRow}>
                <ActivityIndicator size="small" color={colors.danger} />
                <Text style={styles.cancellingText}>Cancelling your order…</Text>
              </View>
            ) : null}
          </View>
          {order ? (
            <>
              <View style={styles.groupDivider} />
              <Pressable
                onPress={() => router.push(`/order/${order.id}`)}
                style={({ pressed }) => [styles.detailsRow, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name="document-text-outline" size={18} color={colors.primaryDark} />
                <Text style={styles.detailsLabel}>
                  View order details
                  {order.order_items.length
                    ? ` · ${order.order_items.length} ${order.order_items.length === 1 ? 'item' : 'items'}`
                    : ''}
                </Text>
                <View style={styles.detailsTrail}>
                  <View style={styles.detailsThumbs}>
                    {order.order_items.slice(0, 3).map((item, index) => (
                      <ProductImage
                        key={item.id}
                        uri={item.image_url}
                        compact
                        style={[styles.detailsThumb, index > 0 && styles.detailsThumbOverlap]}
                        recyclingKey={item.id}
                        accessibilityLabel={item.product_name}
                      />
                    ))}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              </Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.sm, backgroundColor: canvasColor },
        ]}
      >
        <PrimaryButton label="Back to home" onPress={() => router.replace('/home')} style={styles.footerButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  more: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWrap: {
    marginTop: spacing.xs,
    paddingTop: 24,
  },
  heroBadge: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    zIndex: 2,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: colors.surface,
    ...shadow.md,
  },
  heroBadgeCancelled: {
    backgroundColor: colors.danger,
  },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.sm,
  },
  heroHead: {
    paddingHorizontal: spacing.md,
    paddingTop: 30,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  heroHeadCelebrate: {
    backgroundColor: '#F3FBF8',
    alignItems: 'center',
  },
  heroHeadCancelled: {
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
  },
  confettiPiece: {
    position: 'absolute',
    opacity: 0.9,
    borderRadius: 1,
  },
  orderNumber: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: colors.text,
  },
  orderNumberCelebrate: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    letterSpacing: -0.35,
  },
  headline: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.success,
  },
  headlineCelebrate: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  headlineCancelled: {
    color: colors.danger,
  },
  headlineNote: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors.textMuted,
  },
  headlineNoteCelebrate: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: spacing.xs,
    maxWidth: 320,
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  totalLeft: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  payNote: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.sm,
  },
  groupSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6,
    backgroundColor: colors.surface,
  },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  deliverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mapThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: '#E4EBF0',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  mapRoadH: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 14,
    height: 3,
    backgroundColor: '#F8FAFC',
    opacity: 0.95,
  },
  mapRoadHMid: {
    top: 30,
    height: 2,
    opacity: 0.75,
  },
  mapRoadV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 18,
    width: 3,
    backgroundColor: '#F8FAFC',
    opacity: 0.85,
  },
  mapPark: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 14,
    height: 10,
    borderRadius: 2,
    backgroundColor: 'rgba(134, 239, 172, 0.45)',
  },
  mapPinIcon: {
    position: 'absolute',
    left: 14,
    top: 10,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
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
    marginLeft: 48 + spacing.sm,
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
  statusCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
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
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  detailsLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  detailsTrail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailsThumbs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsThumb: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  detailsThumbOverlap: {
    marginLeft: -6,
  },
  pressed: {
    opacity: 0.85,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 118, 110, 0.12)',
  },
  footerButton: {
    minHeight: 48,
  },
});
