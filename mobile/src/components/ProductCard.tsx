import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { QuantityStepper } from '@/components/QuantityStepper';
import { colors, radius, spacing } from '@/config/theme';
import type { Product } from '@/types/product';
import { formatPrice } from '@/utils/format';

type ProductCardProps = {
  product: Product;
  quantity: number;
  onPress: () => void;
  onAddToCart: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
};

export function ProductCard({
  product,
  quantity,
  onPress,
  onAddToCart,
  onIncrease,
  onDecrease,
}: ProductCardProps) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onPress} accessibilityRole="button">
        <Image
          source={product.image_url ? { uri: product.image_url } : undefined}
          style={styles.image}
          contentFit="cover"
        />
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
      </Pressable>
      <View style={styles.footer}>
        <Text style={styles.price}>{formatPrice(product.price)}</Text>
        {quantity > 0 ? (
          <QuantityStepper compact value={quantity} onDecrease={onDecrease} onIncrease={onIncrease} />
        ) : (
          <Pressable onPress={onAddToCart} style={styles.addButton} accessibilityRole="button">
            <Text style={styles.addLabel}>Add</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: '#1C1917',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.border,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    paddingTop: 4,
  },
  price: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  addButton: {
    minWidth: 56,
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});
