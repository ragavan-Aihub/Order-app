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
  compact?: boolean;
};

export function ProductCard({
  product,
  quantity,
  onPress,
  onAddToCart,
  onIncrease,
  onDecrease,
  compact = false,
}: ProductCardProps) {
  const comingSoon = product.available === false;

  const body = (
    <>
      <View>
        <Image
          source={product.image_url ? { uri: product.image_url } : undefined}
          style={[styles.image, compact && styles.imageCompact, comingSoon && styles.dimmed]}
          contentFit="cover"
        />
        {comingSoon ? (
          <View style={styles.soonWrap} pointerEvents="none">
            <Text style={[styles.soon, compact && styles.soonCompact]} numberOfLines={1}>
              Coming soon
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[styles.name, compact && styles.nameCompact, comingSoon && styles.dimmedText]}
        numberOfLines={2}
      >
        {product.name}
      </Text>
    </>
  );

  return (
    <View style={styles.card}>
      {comingSoon ? (
        <View>{body}</View>
      ) : (
        <Pressable onPress={onPress} accessibilityRole="button">
          {body}
        </Pressable>
      )}
      <View style={[styles.footer, compact && styles.footerCompact]}>
        <Text style={[styles.price, compact && styles.priceCompact]}>{formatPrice(product.price)}</Text>
        {comingSoon ? null : quantity > 0 ? (
          <QuantityStepper compact value={quantity} onDecrease={onDecrease} onIncrease={onIncrease} />
        ) : (
          <Pressable
            onPress={onAddToCart}
            style={[styles.addButton, compact && styles.addButtonCompact]}
            accessibilityRole="button"
          >
            <Text style={[styles.addLabel, compact && styles.addLabelCompact]}>Add</Text>
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
    height: 112,
    backgroundColor: colors.border,
  },
  imageCompact: {
    height: 78,
  },
  dimmed: {
    opacity: 0.4,
  },
  soonWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(24,24,27,0.28)',
  },
  soon: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  soonCompact: {
    fontSize: 10,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  nameCompact: {
    fontSize: 11,
    lineHeight: 14,
    minHeight: 28,
    paddingHorizontal: 6,
    paddingTop: 4,
  },
  dimmedText: {
    color: colors.textMuted,
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
  footerCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 4,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  price: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  priceCompact: {
    flex: 0,
    fontSize: 12,
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
  addButtonCompact: {
    minWidth: 0,
    minHeight: 28,
    paddingHorizontal: 0,
  },
  addLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  addLabelCompact: {
    fontSize: 12,
  },
});
