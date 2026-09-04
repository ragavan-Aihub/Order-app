import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QuantityStepper } from '@/components/QuantityStepper';
import { colors, spacing } from '@/config/theme';
import { formatPrice } from '@/utils/format';

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, totalAmount, increase, decrease, remove } = useCart();
  const bottomPad = Math.max(insets.bottom, spacing.sm) + spacing.md;

  if (items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.title}>Your cart is empty</Text>
        <Text style={styles.message}>Add a product from the catalog to start an order.</Text>
        <PrimaryButton label="Browse products" onPress={() => router.replace('/products')} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
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
                <Text style={styles.name}>{item.product.name}</Text>
                <Text style={styles.subtotal}>{formatPrice(subtotal)}</Text>
                <QuantityStepper
                  value={item.quantity}
                  onDecrease={() => decrease(item.product.id)}
                  onIncrease={() => increase(item.product.id)}
                />
                <Pressable onPress={() => remove(item.product.id)} accessibilityRole="button">
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <Text style={styles.total}>Total {formatPrice(totalAmount)}</Text>
        <PrimaryButton label="Continue" onPress={() => router.push('/checkout')} />
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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
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
    gap: spacing.xs,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  subtotal: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  remove: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.danger,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  total: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  emptyWrap: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
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
});
