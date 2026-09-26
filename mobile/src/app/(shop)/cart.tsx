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
      if (items.length === 0) {
        router.replace('/home');
      }
    }, [items.length, loadAddress, router]),
  );

  useEffect(() => {
    return subscribeAddressBook(() => {
      setSelected(getSelectedAddress());
    });
  }, []);

  if (items.length === 0) {
    return <View style={styles.screen} />;
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
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={2}>
                      {item.product.name}
                    </Text>
                    <Text style={styles.subtotal}>{formatPrice(subtotal)}</Text>
                  </View>
                  <Text style={styles.unit}>{formatPrice(item.product.price)} each</Text>
                  <View style={styles.rowBottom}>
                    <QuantityStepper
                      compact
                      value={item.quantity}
                      onDecrease={() => decrease(item.product.id)}
                      onIncrease={() => increase(item.product.id)}
                    />
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  count: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.border,
  },
  details: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 20,
  },
  unit: {
    fontSize: 13,
    color: colors.textMuted,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtotal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
    textAlign: 'right',
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderStyle: 'dashed',
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  addMoreLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  addMoreHint: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  totalLabel: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '700',
  },
  total: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.3,
  },
});
