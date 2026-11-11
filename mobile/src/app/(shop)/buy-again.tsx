import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { useAddToCart } from '@/cart/useAddToCart';
import { EmptyState } from '@/components/EmptyState';
import { HomeHeader } from '@/components/HomeHeader';
import { ModifyOrderBar } from '@/components/ModifyOrderBar';
import { OfflineBanner } from '@/components/OfflineBanner';
import { HomeProductGridItem } from '@/components/HomeProductGridItem';
import { useProductNotifyInterests } from '@/hooks/useProductNotifyInterests';
import { ViewCartBar, viewCartScrollPadding } from '@/components/ViewCartBar';
import { colors, radius, spacing } from '@/config/theme';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { getReorderOrders } from '@/services/orders';
import { getAvailableProducts } from '@/services/products';
import { getSignedInUser } from '@/services/supabase';
import type { Product } from '@/types/product';
import { productMatchesSearch, sortProductsForDisplay, sortProductsForSearch } from '@/utils/product-list-sort';

export default function BuyAgainScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { increase, decrease, items, itemCount } = useCart();
  const addToCart = useAddToCart();
  const { isNotified, busyId, onNotifyPress } = useProductNotifyInterests();
  const { offline } = useNetworkStatus();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }
    try {
      const user = await getSignedInUser();
      setSignedIn(Boolean(user));
      if (!user) {
        setProducts([]);
        return;
      }
      const [orders, catalog] = await Promise.all([getReorderOrders(), getAvailableProducts()]);
      const available = new Map(catalog.map((product) => [product.id, product]));
      const seen = new Set<string>();
      const next: Product[] = [];
      for (const order of orders) {
        for (const line of order.order_items) {
          if (!line.product_id || seen.has(line.product_id)) {
            continue;
          }
          const product = available.get(line.product_id);
          if (!product) {
            continue;
          }
          seen.add(product.id);
          next.push(product);
        }
      }
      setProducts(next);
    } catch {
      setSignedIn(false);
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = !term ? products : products.filter((product) => productMatchesSearch(product, term));
    return term ? sortProductsForSearch(list, term) : sortProductsForDisplay(list);
  }, [products, query]);

  const quantityById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      if (
        item.product.selling_type === 'kg' ||
        item.product.selling_type === 'liter' ||
        item.product.selling_type === 'fixed_pack'
      ) {
        continue;
      }
      map[item.product.id] = (map[item.product.id] ?? 0) + item.quantity;
    }
    return map;
  }, [items]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!signedIn) {
    return (
      <EmptyState
        title="Sign in to continue"
        message="Sign in with Google to see items from your recent orders."
        actionLabel="Sign in"
        onAction={() => router.push({ pathname: '/login', params: { next: 'buy-again' } })}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <HomeHeader />
      <ModifyOrderBar variant="shop" style={styles.modifyBar} />
      <View style={styles.searchBar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search bought items"
            placeholderTextColor={colors.textMuted}
            style={styles.search}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            selectTextOnFocus
            clearButtonMode="never"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery('')}
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={22} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: viewCartScrollPadding(insets.bottom, itemCount > 0) },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
      >
        {offline ? <OfflineBanner /> : null}
        {products.length === 0 ? (
          <Text style={styles.empty}>
            {offline
              ? 'Connect to the internet to load items from your recent orders.'
              : 'No items from previous orders yet. Shop from Home, then they will show up here.'}
          </Text>
        ) : visibleProducts.length === 0 ? (
          <Text style={styles.empty}>No bought items match this search.</Text>
        ) : (
          <View style={styles.grid}>
            {visibleProducts.map((product) => (
              <HomeProductGridItem
                key={product.id}
                product={product}
                quantity={quantityById[product.id] ?? 0}
                highlighted={false}
                highlightFromPush={false}
                notifyNotified={isNotified(product.id)}
                notifyBusy={busyId === product.id}
                onAddToCart={addToCart}
                onIncrease={increase}
                onDecrease={decrease}
                onNotifyPress={(productId, productName) => void onNotifyPress(productId, productName)}
              />
            ))}
          </View>
        )}
      </ScrollView>
      <ViewCartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  modifyBar: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  searchBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  search: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  clearButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  empty: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    marginHorizontal: -4,
  },
});
