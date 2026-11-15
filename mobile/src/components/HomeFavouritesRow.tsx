import { Ionicons } from '@expo/vector-icons';
import { Fragment, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { HomeProductGridItem } from '@/components/HomeProductGridItem';
import { colors, spacing } from '@/config/theme';
import type { Product } from '@/types/product';

const GAP = spacing.sm;
const LIST_PAD = spacing.md * 2;

export function HomeFavouritesRow({
  products,
  quantityById,
  isFavorite,
  onFavoritePress,
  onAddToCart,
  onIncrease,
  onDecrease,
  isNotified,
  busyId,
  onNotifyPress,
}: {
  products: Product[];
  quantityById: Record<string, number>;
  isFavorite: (productId: string) => boolean;
  onFavoritePress: (productId: string) => void;
  onAddToCart: (product: Product, quantity?: number) => boolean;
  onIncrease: (productId: string) => void;
  onDecrease: (productId: string) => void;
  isNotified: (productId: string) => boolean;
  busyId: string | null;
  onNotifyPress: (productId: string, productName: string) => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const canSwipe = products.length > 2;
  const cardWidth = useMemo(() => {
    const rail = Math.max(280, windowWidth - LIST_PAD);
    return Math.round(rail * 0.42);
  }, [windowWidth]);
  const step = cardWidth + GAP;

  if (products.length === 0) {
    return null;
  }

  function tile(product: Product, rail: boolean) {
    return (
      <HomeProductGridItem
        product={product}
        quantity={quantityById[product.id] ?? 0}
        highlighted={false}
        highlightFromPush={false}
        notifyNotified={isNotified(product.id)}
        notifyBusy={busyId === product.id}
        onAddToCart={onAddToCart}
        onIncrease={onIncrease}
        onDecrease={onDecrease}
        onNotifyPress={onNotifyPress}
        favorited={isFavorite(product.id)}
        onFavoritePress={onFavoritePress}
        rail={rail}
      />
    );
  }

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / step);
    setIndex(Math.max(0, Math.min(products.length - 1, next)));
  }

  if (!canSwipe) {
    return (
      <View style={styles.wrap}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>My favourites</Text>
        </View>
        <View style={styles.singleRow}>
          {products.map((product) => (
            <Fragment key={product.id}>{tile(product, false)}</Fragment>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>My favourites</Text>
        <View style={styles.hint} accessibilityLabel="Swipe for more favourites">
          <Text style={styles.hintLabel}>Swipe</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primaryDark} />
        </View>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        decelerationRate="fast"
        snapToInterval={canSwipe ? step : undefined}
        snapToAlignment="start"
        disableIntervalMomentum={canSwipe}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, canSwipe && { paddingRight: cardWidth * 0.28 }]}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
      >
        {products.map((product) => (
          <View key={product.id} style={[styles.card, { width: cardWidth }]}>
            {tile(product, true)}
          </View>
        ))}
      </ScrollView>
      {canSwipe ? (
        <View style={styles.dots} pointerEvents="none">
          {products.map((product, dot) => (
            <View key={product.id} style={[styles.dot, dot === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    paddingHorizontal: 4,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: spacing.sm,
  },
  hintLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  singleRow: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  row: {
    gap: GAP,
  },
  card: {
    flexGrow: 0,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotOn: {
    width: 16,
    backgroundColor: colors.primary,
  },
});
