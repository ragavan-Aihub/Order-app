import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius, shadow, spacing } from '@/config/theme';

type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Pulsing placeholder block. Holds still when the user prefers reduced motion. */
export function Skeleton({ width = '100%', height = 14, borderRadius = 8, style }: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(withTiming(0.55, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: colors.placeholder }, animated, style]}
    />
  );
}

function SkeletonProductCard() {
  return (
    <View style={styles.cardWrap}>
      <View style={styles.card}>
        <View style={styles.cardImage}>
          <Skeleton height="100%" borderRadius={0} />
        </View>
        <View style={styles.cardBody}>
          <Skeleton width="85%" height={14} />
          <Skeleton width="55%" height={12} />
          <View style={styles.cardFooter}>
            <Skeleton width={54} height={18} />
            <Skeleton width={64} height={32} borderRadius={radius.pill} />
          </View>
        </View>
      </View>
    </View>
  );
}

/** Two-column placeholder grid matching the Home product grid. */
export function ProductGridSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.grid} accessibilityLabel="Loading products" accessibilityRole="progressbar">
      {Array.from({ length: rows * 2 }, (_, index) => (
        <SkeletonProductCard key={index} />
      ))}
    </View>
  );
}

/** First-load Home chrome: category pills, promo block, then product cards. */
export function HomeCatalogSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading products" accessibilityRole="progressbar">
      <View style={styles.chipRow}>
        <Skeleton width={52} height={32} borderRadius={radius.pill} />
        <Skeleton width={88} height={32} borderRadius={radius.pill} />
        <Skeleton width={72} height={32} borderRadius={radius.pill} />
        <Skeleton width={96} height={32} borderRadius={radius.pill} />
      </View>
      <View style={styles.banner}>
        <Skeleton height="100%" borderRadius={radius.md} />
      </View>
      <ProductGridSkeleton rows={rows} />
    </View>
  );
}

function SkeletonOrderCard() {
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderHeaderLeft}>
          <Skeleton width="55%" height={18} />
          <Skeleton width="40%" height={12} />
        </View>
        <Skeleton width={64} height={18} />
      </View>
      <View style={styles.orderThumbs}>
        <Skeleton width={52} height={52} borderRadius={10} style={styles.orderThumb} />
        <Skeleton width={52} height={52} borderRadius={10} style={styles.orderThumb} />
        <Skeleton width={52} height={52} borderRadius={10} style={styles.orderThumb} />
      </View>
    </View>
  );
}

/** Placeholder cards for the Your Orders list. */
export function OrdersListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.ordersList} accessibilityLabel="Loading orders" accessibilityRole="progressbar">
      <Skeleton width={160} height={24} style={styles.ordersTitle} />
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonOrderCard key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  banner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    aspectRatio: 16 / 7,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md - 4,
    paddingTop: spacing.xs,
  },
  cardWrap: {
    width: '50%',
    padding: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 5 / 4,
  },
  cardBody: {
    padding: spacing.sm,
    gap: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  ordersList: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  ordersTitle: {
    marginBottom: spacing.xs,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.sm,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  orderHeaderLeft: {
    flex: 1,
    gap: 8,
  },
  orderThumbs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  orderThumb: {
    overflow: 'hidden',
  },
});
