import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { EmptyState } from '@/components/EmptyState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QuantityStepper } from '@/components/QuantityStepper';
import { colors, radius, spacing } from '@/config/theme';
import { formatPrice } from '@/utils/format';

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, itemCount, totalAmount, increase, decrease, remove } = useCart();
  const bottomPad = Math.max(insets.bottom, spacing.sm) + spacing.md;

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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.count}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
        {items.map((item) => {
          const subtotal = item.product.price * item.quantity;
          return (
            <View key={item.product.id} style={styles.row}>
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
                <Pressable onPress={() => remove(item.product.id)} accessibilityRole="button">
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            </View>
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
  remove: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
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
