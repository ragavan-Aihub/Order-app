import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { FavoriteHeart } from '@/components/FavoriteHeart';
import { ProductImage } from '@/components/ProductImage';
import { QuantityStepper } from '@/components/QuantityStepper';
import { productNotifyCopy } from '@/copy/product-notify';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { hapticTap } from '@/utils/haptics';
import type { Product } from '@/types/product';
import { catalogPriceAmountLabel, catalogUnitLabel, sellingTypeOf } from '@/utils/selling-units';
import { stockLimitOf } from '@/utils/stock';

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
  favorited?: boolean;
  favoriteBusy?: boolean;
  onFavoritePress?: () => void;
};

const IMAGE_ASPECT = 5 / 4;

export const ProductCard = memo(function ProductCard({
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
  favorited = false,
  favoriteBusy = false,
  onFavoritePress,
}: ProductCardProps) {
  // Stock 0 auto-marks Coming soon in the database; treat either as Coming soon in the UI.
  const comingSoon = product.available === false || stockLimitOf(product.stock_qty) === 0;
  const blocked = comingSoon;
  const needsOptions = sellingTypeOf(product) !== 'quantity';
  const unit = catalogUnitLabel(product);
  const price = catalogPriceAmountLabel(product);

  const header = (
    <>
      <View style={[styles.imageFrame, compact && styles.imageFrameCompact]}>
        <ProductImage
          uri={product.image_url}
          style={styles.image}
          dimmed={blocked}
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
        {onFavoritePress ? (
          <FavoriteHeart
            size={compact ? 'compact' : 'card'}
            on={favorited}
            busy={favoriteBusy}
            onPress={onFavoritePress}
          />
        ) : null}
      </View>
      <View style={[styles.body, compact && styles.bodyCompact]}>
        <Text
          style={[styles.name, compact && styles.nameCompact, blocked && styles.dimmedText]}
          numberOfLines={2}
        >
          {product.name}
        </Text>
        {unit ? (
          <Text style={[styles.unit, compact && styles.unitCompact, blocked && styles.dimmedText]} numberOfLines={1}>
            {unit}
          </Text>
        ) : null}
      </View>
    </>
  );

  const actionControl = comingSoon && onNotifyPress ? (
    <Pressable
      onPress={onNotifyPress}
      disabled={notifyBusy || notifyNotified}
      style={[
        styles.notifyButton,
        notifyNotified && styles.notifyButtonOn,
        notifyNotified && styles.notifyButtonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: notifyNotified }}
      accessibilityLabel={notifyNotified ? productNotifyCopy.notified : productNotifyCopy.notifyMe}
    >
      {notifyBusy ? (
        <ActivityIndicator size="small" color={notifyNotified ? colors.primaryDark : colors.primaryText} />
      ) : (
        <Text style={[styles.notifyLabel, notifyNotified && styles.notifyLabelOn]}>
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
  ) : needsOptions ? null : (
    <Pressable
      onPress={() => {
        hapticTap();
        onAddToCart();
      }}
      style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Add ${product.name}`}
    >
      <Ionicons name="add" size={16} color={colors.primaryText} />
      <Text style={styles.addLabel}>ADD</Text>
    </Pressable>
  );

  return (
    <View style={styles.card}>
      {comingSoon || !onPress ? (
        <View style={styles.cardFill}>{header}</View>
      ) : (
        <Pressable onPress={onPress} accessibilityRole="button" style={styles.cardFill}>
          {header}
        </Pressable>
      )}
      <View style={[styles.footer, compact && styles.footerCompact]}>
        {needsOptions && !comingSoon ? (
          <Pressable
            onPress={() => {
              hapticTap();
              onAddToCart();
            }}
            style={({ pressed }) => [styles.fromButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Choose size for ${product.name}, ${price}`}
          >
            <Text style={[styles.price, compact && styles.priceCompact]} numberOfLines={1}>
              {price}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primaryDark} />
          </Pressable>
        ) : (
          <>
            <Text
              style={[styles.price, compact && styles.priceCompact, blocked && styles.dimmedText]}
              numberOfLines={1}
            >
              {price}
            </Text>
            {actionControl}
          </>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardFill: {
    flexDirection: 'column',
  },
  imageFrame: {
    aspectRatio: IMAGE_ASPECT,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.placeholder,
  },
  imageFrameCompact: {
    aspectRatio: 1,
  },
  image: {
    width: '100%',
    height: '100%',
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
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    minHeight: 46,
  },
  bodyCompact: {
    paddingHorizontal: 8,
    minHeight: 40,
  },
  name: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    color: colors.text,
  },
  nameCompact: {
    fontSize: 13,
    lineHeight: 16,
  },
  unit: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
    color: colors.textMuted,
  },
  unitCompact: {
    fontSize: 10,
    lineHeight: 14,
  },
  stockLeft: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.warning,
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
    paddingTop: 6,
    paddingBottom: spacing.sm,
    minHeight: 48,
  },
  footerCompact: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  price: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  priceCompact: {
    fontSize: 15,
  },
  addButton: {
    minWidth: 72,
    height: 40,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fromButton: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  addLabel: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  notifyButton: {
    minWidth: 84,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyButtonOn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  notifyButtonDisabled: {
    opacity: 0.55,
  },
  notifyLabel: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  notifyLabelOn: {
    color: colors.primaryDark,
  },
});
