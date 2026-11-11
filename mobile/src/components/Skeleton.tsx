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

const styles = StyleSheet.create({
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
});
