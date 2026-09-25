import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView, ScrollView, Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getSelectedAddress,
  hydrateAddressBook,
  loadAddressBook,
  subscribeAddressBook,
  type SavedAddress,
} from '@/cart/address-book';
import { useCart } from '@/cart/CartContext';
import { loadDeliveryDraft } from '@/cart/delivery-draft';
import {
  AddressPickerSheet,
  savedAddressLabel,
  savedAddressLine,
} from '@/components/AddressPickerSheet';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QuantityStepper } from '@/components/QuantityStepper';
import { colors, radius, spacing } from '@/config/theme';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { getLastDeliveryDetails } from '@/services/orders';
import { formatPrice } from '@/utils/format';

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, itemCount, totalAmount, increase, decrease, remove } = useCart();
  const { offline } = useNetworkStatus();
  const bottomPad = Math.max(insets.bottom, spacing.sm) + spacing.md;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<SavedAddress | null>(null);

  const loadAddress = useCallback(async () => {
    const [draft, lastOrder] = await Promise.all([loadDeliveryDraft(), getLastDeliveryDetails()]);
    await hydrateAddressBook([draft, lastOrder]);
    await loadAddressBook();
    setSelected(getSelectedAddress());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAddress().catch(() => undefined);
    }, [loadAddress]),
  );

  useEffect(() => {
    return subscribeAddressBook(() => {
      setSelected(getSelectedAddress());
    });
  }, []);

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        message="Browse the catalog and tap Add to build an order."
        actionLabel="Start shopping"
        onAction={() => router.replace('/home')}
      />
    );
  }

  const addressTitle = selected ? savedAddressLabel(selected.label) : 'Deliver to';
  const addressLine = selected ? savedAddressLine(selected) : 'Add a delivery address';

  return (
    <GestureHandlerRootView style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          style={styles.address}
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Change delivery address"
        >
          <View style={styles.addressTitleRow}>
            <Text style={styles.addressTitle}>{addressTitle}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.primaryDark} />
          </View>
          <Text style={styles.addressLine} numberOfLines={1}>
            {addressLine}
          </Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {offline ? <OfflineBanner /> : null}
        <Text style={styles.count}>
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </Text>
        {items.map((item) => {
          const subtotal = item.product.price * item.quantity;
          return (
            <Swipeable
              key={item.product.id}
              overshootRight={false}
              rightThreshold={40}
              onSwipeableRightOpen={() => remove(item.product.id)}
              renderRightActions={() => (
                <Pressable
                  onPress={() => remove(item.product.id)}
                  style={styles.deleteAction}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.product.name}`}
                >
                  <Ionicons name="trash-outline" size={22} color={colors.primaryText} />
                </Pressable>
              )}
            >
              <View
                style={styles.row}
                accessibilityHint="Swipe left to delete"
              >
                <Image
                  source={item.product.image_url ? { uri: item.product.image_url } : undefined}
                  style={styles.thumb}
                  contentFit="cover"
                />
                <View style={styles.details}>
                  <Text style={styles.name} numberOfLines={2}>
                    {item.product.name}
                  </Text>
                  <Text style={styles.unit}>{formatPrice(item.product.price)} each</Text>
                  <View style={styles.rowBottom}>
                    <QuantityStepper
                      compact
                      value={item.quantity}
                      onDecrease={() => decrease(item.product.id)}
                      onIncrease={() => increase(item.product.id)}
                    />
                    <Text style={styles.subtotal}>{formatPrice(subtotal)}</Text>
                  </View>
                </View>
              </View>
            </Swipeable>
          );
        })}
        <Pressable style={styles.addMore} onPress={() => router.push('/home')} accessibilityRole="button">
          <Text style={styles.addMoreLabel}>+ Add more</Text>
          <Text style={styles.addMoreHint}>Keep shopping</Text>
        </Pressable>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>To pay</Text>
          <Text style={styles.total}>{formatPrice(totalAmount)}</Text>
        </View>
        <PrimaryButton label="Continue to delivery" onPress={() => router.push('/checkout')} />
      </View>
      <AddressPickerSheet
        visible={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          loadAddress().catch(() => undefined);
        }}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  address: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: spacing.md,
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  addressLine: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  count: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  details: {
    flex: 1,
    gap: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  unit: {
    fontSize: 13,
    color: colors.textMuted,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtotal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  deleteAction: {
    width: 72,
    alignSelf: 'stretch',
    marginLeft: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  addMoreLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  addMoreHint: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '600',
  },
  total: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
});
