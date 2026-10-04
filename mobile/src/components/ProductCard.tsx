import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { QuantityStepper } from '@/components/QuantityStepper';
import { colors, radius, spacing } from '@/config/theme';
import type { Product } from '@/types/product';
import { formatPrice } from '@/utils/format';

type ProductCardProps = {
  product: Product;
  quantity: number;
  onPress?: () => void;
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
      <View style={[styles.imageFrame, compact && styles.imageFrameCompact]}>
        <Image
          source={product.image_url ? { uri: product.image_url } : undefined}
          style={[styles.image, comingSoon && styles.dimmed]}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          recyclingKey={product.id}
          accessibilityIgnoresInvertColors
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
      {comingSoon || !onPress ? (
        <View>{body}</View>
      ) : (
        <Pressable onPress={onPress} accessibilityRole="button">
          {body}
        </Pressable>
      )}
      <View style={[styles.footer, compact && styles.footerCompact]}>
        <Text style={[styles.price, compact && styles.priceCompact]}>{formatPrice(product.price)}</Text>
        {comingSoon ? null : quantity > 0 ? (
          <QuantityStepper
            compact
            stretch={compact}
            value={quantity}
            onDecrease={onDecrease}
            onIncrease={onIncrease}
          />
        ) : (
          <Pressable
            onPress={onAddToCart}
            style={[styles.addButton, compact && styles.addButtonCompact]}
            accessibilityRole="button"
            accessibilityLabel={`Add ${product.name}`}
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#1C1917',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  imageFrame: {
    aspectRatio: 4 / 3,
    overflow: 'hidden',
    backgroundColor: '#F1F5F4',
  },
  imageFrameCompact: {
    aspectRatio: 1,
    margin: 6,
    marginBottom: 0,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(24,24,27,0.06)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  dimmed: {
    opacity: 0.4,
  },
  soonWrap: {
    ...StyleSheet.absoluteFill,
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
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
    minHeight: 38,
    paddingHorizontal: 8,
    paddingTop: 6,
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
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 0,
    paddingBottom: 8,
  },
  price: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  priceCompact: {
    flex: 0,
    fontSize: 14.5,
    letterSpacing: 0.1,
  },
  addButton: {
    minWidth: 56,
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonCompact: {
    minWidth: 0,
    minHeight: 30,
    paddingHorizontal: 0,
  },
  addLabel: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  addLabelCompact: {
    fontSize: 13,
  },
});
