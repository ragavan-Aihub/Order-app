import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useCart } from '@/cart/CartContext';
import { useShopCatalog } from '@/catalog/ShopCatalogContext';
import { getHomeCategoryId, setHomeCategoryId, subscribeHomeCategory } from '@/catalog/home-filter';
import { HomeHeader } from '@/components/HomeHeader';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProductCard } from '@/components/ProductCard';
import { ViewCartBar, VIEW_CART_BAR_SPACE } from '@/components/ViewCartBar';
import { colors, radius, spacing } from '@/config/theme';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { getBusiness } from '@/services/business';
import { getAvailableProducts } from '@/services/products';
import type { Product } from '@/types/product';

export default function HomeScreen() {
  const router = useRouter();
  const { addItem, increase, decrease, items, itemCount } = useCart();
  const { offline } = useNetworkStatus();
  const { categoriesEnabled, categories, refreshCatalog } = useShopCatalog();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState(getHomeCategoryId());
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCatalog = useCallback(async () => {
    const [catalog, shop] = await Promise.all([getAvailableProducts(), getBusiness()]);
    setProducts(catalog);
    setBannerUrl(shop?.banner_url ?? null);
    await refreshCatalog();
  }, [refreshCatalog]);

  useFocusEffect(
    useCallback(() => {
      setCategoryId(getHomeCategoryId());
      void loadCatalog()
        .catch(() => {
          setProducts([]);
        })
        .finally(() => setLoading(false));
    }, [loadCatalog]),
  );

  useEffect(() => subscribeHomeCategory(() => setCategoryId(getHomeCategoryId())), []);


  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      if (categoriesEnabled && categoryId && product.category_id !== categoryId) {
        return false;
      }
      if (!term) {
        return true;
      }
      return (
        product.name.toLowerCase().includes(term) || product.description.toLowerCase().includes(term)
      );
    });
  }, [categoriesEnabled, categoryId, products, query]);

  const quantityById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      map[item.product.id] = item.quantity;
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

  return (
    <View style={styles.screen}>
      <HomeHeader />
      {offline ? (
        <View style={styles.offlineWrap}>
          <OfflineBanner />
        </View>
      ) : null}
      <View style={styles.searchBar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
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
          styles.scroll,
          { paddingBottom: itemCount > 0 ? VIEW_CART_BAR_SPACE + spacing.md : spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {categoriesEnabled && categories.length > 0 ? (
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            <Pressable
              onPress={() => {
                setHomeCategoryId('');
                setCategoryId('');
              }}
              style={[styles.chip, !categoryId && styles.chipOn]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipLabel, !categoryId && styles.chipLabelOn]}>All</Text>
            </Pressable>
            {categories.map((item) => {
              const on = categoryId === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setHomeCategoryId(item.id);
                    setCategoryId(item.id);
                  }}
                  style={[styles.chip, on && styles.chipOn]}
                  accessibilityRole="button"
                >
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.chipPhoto} contentFit="cover" />
                  ) : null}
                  <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{item.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        {bannerUrl ? (
          <Image source={{ uri: bannerUrl }} style={styles.banner} contentFit="cover" />
        ) : null}
        {visibleProducts.length === 0 ? (
          <Text style={styles.empty}>
            {offline && products.length === 0
              ? 'Connect to the internet to load products.'
              : 'No products match this search.'}
          </Text>
        ) : (
          <View style={styles.grid}>
            {visibleProducts.map((product) => (
              <View key={product.id} style={styles.gridItem}>
                <ProductCard
                  product={product}
                  quantity={quantityById[product.id] ?? 0}
                  onPress={() => router.push(`/product/${product.id}`)}
                  onAddToCart={() => addItem(product, 1)}
                  onIncrease={() => increase(product.id)}
                  onDecrease={() => decrease(product.id)}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <ViewCartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  offlineWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
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
  chips: {
    gap: spacing.sm,
    paddingVertical: 4,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipOn: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipPhoto: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  chipLabelOn: {
    color: colors.primaryDark,
  },
  banner: {
    width: '100%',
    height: 120,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  empty: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  gridItem: {
    width: '50%',
    padding: 6,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
