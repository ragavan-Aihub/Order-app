import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ProductImage } from '@/components/ProductImage';
import { QuantityStepper } from '@/components/QuantityStepper';
import { productNotifyCopy } from '@/copy/product-notify';
import { colors, radius, shadow, spacing } from '@/config/theme';
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
  notifyNotified?: boolean;
  notifyBusy?: boolean;
  onNotifyPress?: () => void;
};

/** Slightly wider than square — shorter image block (reference grid). */
const IMAGE_ASPECT = 5 / 4;

const NAME_FONT = 15;
const NAME_LINE = 21;

const BODY_PAD_H = spacing.sm;
/** Minimum gap between name block and bottom price row when names match height. */
const MIN_NAME_FOOTER_GAP = 4;

export function ProductCard({
  product,
  quantity,
  onPress,
  onAddToCart,
  onIncrease,
  onDecrease,
  compact = false,
  notifyNotified = false,
  notifyBusy = false,
  onNotifyPress,
}: ProductCardProps) {
  const comingSoon = product.available === false;

  const content = (
    <>
      <View style={styles.imageFrame}>
        <ProductImage
          uri={product.image_url}
          style={styles.image}
          dimmed={comingSoon}
          recyclingKey={product.id}
          accessibilityLabel={product.name}
        />
        {comingSoon ? (
          <View style={styles.soonWrap} pointerEvents="none">
            <Text style={[styles.soon, compact && styles.soonCompact]} numberOfLines={1}>
              Coming soon
            </Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.body, compact && styles.bodyCompact]}>
        <Text
          style={[styles.name, compact && styles.nameCompact, comingSoon && styles.dimmedText]}
          numberOfLines={2}
        >
          {product.name}
        </Text>
        <View style={styles.bodySpacer} />
        {comingSoon && onNotifyPress ? (
          <Text style={[styles.notifyHelper, compact && styles.notifyHelperCompact]} numberOfLines={3}>
            {productNotifyCopy.helper}
          </Text>
        ) : null}
        <View style={styles.footerRow}>
          <Text style={[styles.price, compact && styles.priceCompact]}>{formatPrice(product.price)}</Text>
          {comingSoon && onNotifyPress ? (
            <Pressable
              onPress={onNotifyPress}
              disabled={notifyBusy}
              style={[
                styles.notifyButton,
                notifyNotified && styles.notifyButtonOn,
                compact && styles.notifyButtonCompact,
              ]}
              accessibilityRole="button"
              accessibilityLabel={notifyNotified ? productNotifyCopy.notified : productNotifyCopy.notifyMe}
            >
              {notifyBusy ? (
                <ActivityIndicator size="small" color={notifyNotified ? colors.primaryDark : colors.primaryText} />
              ) : (
                <Text
                  style={[
                    styles.notifyLabel,
                    notifyNotified && styles.notifyLabelOn,
                    compact && styles.notifyLabelCompact,
                  ]}
                >
                  {notifyNotified ? productNotifyCopy.notified : productNotifyCopy.notifyMe}
                </Text>
              )}
            </Pressable>
          ) : comingSoon ? null : quantity > 0 ? (
            <QuantityStepper
              compact
              dense
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
              <Text style={styles.addLabel}>Add</Text>
            </Pressable>
          )}
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.card}>
      {comingSoon || !onPress ? (
        <View style={styles.cardFill}>{content}</View>
      ) : (
        <Pressable onPress={onPress} accessibilityRole="button" style={styles.cardFill}>
          {content}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow.sm,
  },
  cardFill: {
    flex: 1,
    flexDirection: 'column',
  },
  imageFrame: {
    aspectRatio: IMAGE_ASPECT,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#E4E4E7',
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
    textAlign: 'center',
  },
  soonCompact: {
    fontSize: 10,
  },
  body: {
    flex: 1,
    flexDirection: 'column',
    paddingHorizontal: BODY_PAD_H,
    paddingTop: MIN_NAME_FOOTER_GAP,
    paddingBottom: spacing.sm,
  },
  bodyCompact: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  name: {
    fontSize: NAME_FONT,
    lineHeight: NAME_LINE,
    fontWeight: '600',
    color: colors.text,
  },
  nameCompact: {
    fontSize: 13,
    lineHeight: 16,
  },
  dimmedText: {
    color: colors.textMuted,
  },
  bodySpacer: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: MIN_NAME_FOOTER_GAP,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    minHeight: 32,
  },
  price: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  priceCompact: {
    fontSize: 14,
  },
  addButton: {
    minWidth: 56,
    height: 30,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonCompact: {
    minWidth: 48,
    height: 30,
  },
  addLabel: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  notifyHelper: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 13,
    color: colors.textMuted,
  },
  notifyHelperCompact: {
    fontSize: 9,
    lineHeight: 12,
  },
  notifyButton: {
    minWidth: 72,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyButtonOn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  notifyButtonCompact: {
    minWidth: 64,
  },
  notifyLabel: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  notifyLabelOn: {
    color: colors.primaryDark,
  },
  notifyLabelCompact: {
    fontSize: 11,
  },
});
