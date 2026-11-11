import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ProductImage } from '@/components/ProductImage';
import { QuantityStepper } from '@/components/QuantityStepper';
import { productNotifyCopy } from '@/copy/product-notify';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { hapticTap } from '@/utils/haptics';
import type { Product } from '@/types/product';
import { catalogPriceAmountLabel, catalogUnitLabel, sellingTypeOf } from '@/utils/selling-units';
import { stockLeftLabel } from '@/utils/stock';

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
}: ProductCardProps) {
  const comingSoon = product.available === false;
  const needsOptions = sellingTypeOf(product) !== 'quantity';
  const unit = catalogUnitLabel(product);
  const price = catalogPriceAmountLabel(product);
  const stockLeft = comingSoon ? null : stockLeftLabel(product.stock_qty, product.selling_type);

  const header = (
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
        {unit ? (
          <Text style={[styles.unit, comingSoon && styles.dimmedText]} numberOfLines={1}>
            {unit}
          </Text>
        ) : null}
        {stockLeft ? (
          <Text style={styles.stockLeft} numberOfLines={1}>
            {stockLeft}
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
  ) : needsOptions ? (
    <Pressable
      onPress={() => {
        hapticTap();
        onAddToCart();
      }}
      style={({ pressed }) => [styles.optionsButton, pressed && styles.buttonPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Choose options for ${product.name}`}
    >
      <Text style={styles.optionsLabel}>Options</Text>
      <Ionicons name="chevron-forward" size={13} color={colors.primaryDark} />
    </Pressable>
  ) : (
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
        <Text
          style={[styles.price, compact && styles.priceCompact, comingSoon && styles.dimmedText]}
          numberOfLines={1}
        >
          {price}
        </Text>
        {actionControl}
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.textMuted,
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
    fontSize: 15,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  priceCompact: {
    fontSize: 14,
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
  optionsButton: {
    minWidth: 84,
    height: 40,
    paddingHorizontal: 10,
    flexDirection: 'row',
    gap: 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primaryOutline,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsLabel: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
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
