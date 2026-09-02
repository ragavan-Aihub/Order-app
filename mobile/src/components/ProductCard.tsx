import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, spacing } from '@/config/theme';
import type { Product } from '@/types/product';
import { formatPrice } from '@/utils/format';

type ProductCardProps = {
  product: Product;
  onPress: () => void;
  onAddToCart: () => void;
};

export function ProductCard({ product, onPress, onAddToCart }: ProductCardProps) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onPress} accessibilityRole="button">
        <Image
          source={product.image_url ? { uri: product.image_url } : undefined}
          style={styles.image}
          contentFit="cover"
        />
        <View style={styles.body}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {product.description}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.price}>{formatPrice(product.price)}</Text>
            <Text style={styles.available}>Available</Text>
          </View>
        </View>
      </Pressable>
      <View style={styles.action}>
        <PrimaryButton label="Add to Cart" onPress={onAddToCart} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    height: 180,
    backgroundColor: colors.border,
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  available: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
  action: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
