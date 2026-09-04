import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
        </View>
      </Pressable>
      <Pressable onPress={onAddToCart} style={styles.addButton} accessibilityRole="button">
        <Text style={styles.addLabel}>Add</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.border,
  },
  body: {
    padding: spacing.xs,
    gap: 2,
    minHeight: 52,
  },
  name: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  price: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  addButton: {
    marginHorizontal: spacing.xs,
    marginBottom: spacing.xs,
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '700',
  },
});
