import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { useAddToCart } from '@/cart/useAddToCart';
import { useShopCatalog } from '@/catalog/ShopCatalogContext';
import {
  assignHomeCategoryId,
  getHomeCategoryId,
  setHomeCategoryId,
  subscribeHomeCategory,
} from '@/catalog/home-filter';
import { HomeHeader } from '@/components/HomeHeader';
import { HomeProductGridItem } from '@/components/HomeProductGridItem';
import { ModifyOrderBar } from '@/components/ModifyOrderBar';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useProductNotifyInterests } from '@/hooks/useProductNotifyInterests';
import { ViewCartBar, viewCartScrollPadding } from '@/components/ViewCartBar';
import { env } from '@/config/env';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { notifyHomeCatalogReady } from '@/notifications/notification-permission-offer';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { refreshBusiness } from '@/services/business';
import {
  fetchProductByIdLive,
  getCachedProducts,
  invalidateProductCatalogCache,
  refreshAvailableProducts,
} from '@/services/products';
import type { Product } from '@/types/product';
import { sortProductsForDisplay } from '@/utils/product-list-sort';

function matchesSearch(product: Product, term: string) {
  return product.name.toLowerCase().includes(term) || product.description.toLowerCase().includes(term);
}

export default function HomeScreen() {
  const router = useRouter();
  const {
    focusProduct: focusProductParam,
    fromAvailablePush: fromPushParam,
    pushOpenKey: pushOpenKeyParam,
  } = useLocalSearchParams<{
    focusProduct?: string;
    fromAvailablePush?: string;
    pushOpenKey?: string;
  }>();
  const focusProductId = Array.isArray(focusProductParam) ? focusProductParam[0] : focusProductParam;
  const fromAvailablePush = Array.isArray(fromPushParam) ? fromPushParam[0] : fromPushParam;
  const pushOpenKey = Array.isArray(pushOpenKeyParam) ? pushOpenKeyParam[0] : pushOpenKeyParam;
  const insets = useSafeAreaInsets();
  const { increase, decrease, items, itemCount, resumeEdit, takeResumeEdit } = useCart();
  const addToCart = useAddToCart();
  const { isNotified, busyId, onNotifyPress, refresh: refreshNotifyInterests } =
    useProductNotifyInterests();

  useEffect(() => {
    if (resumeEdit) {
      takeResumeEdit();
      router.push('/cart');
    }
  }, [resumeEdit, router, takeResumeEdit]);
  const { offline } = useNetworkStatus();
  const { categoriesEnabled, categories } = useShopCatalog();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState(getHomeCategoryId());
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const painted = useRef(false);
  const listRef = useRef<FlatList<Product>>(null);
  const chipsRef = useRef<ScrollView>(null);
  const [highlightProductId, setHighlightProductId] = useState<string | null>(null);
  const [highlightFromPush, setHighlightFromPush] = useState(false);
  const [pushCatalogLoading, setPushCatalogLoading] = useState(false);
  const pendingFocusProductId = useRef<string | null>(null);
  const didScrollToHighlight = useRef(false);

  const openingFromAvailablePush = fromAvailablePush === '1' && Boolean(focusProductId);

  useLayoutEffect(() => {
    if (!openingFromAvailablePush || !focusProductId) {
      return;
    }
    setQuery('');
    setCategoryId('');
    setHomeCategoryId('');
  }, [focusProductId, openingFromAvailablePush, pushOpenKey]);

  const onSearchChange = (text: string) => {
    setQuery(text);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    const term = text.trim().toLowerCase();
    if (!term || !categoriesEnabled || !categoryId) {
      return;
    }
    const inCategory = products.some(
      (product) => product.category_id === categoryId && matchesSearch(product, term),
    );
    if (!inCategory && products.some((product) => matchesSearch(product, term))) {
      assignHomeCategoryId('');
      startTransition(() => setCategoryId(''));
      chipsRef.current?.scrollTo({ x: 0, animated: true });
    }
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const keyboardOpen = keyboardHeight > 0;
  const searching = searchFocused && keyboardOpen;

  const loadCatalog = useCallback(async () => {
    if (!painted.current) {
      const cached = await getCachedProducts();
      if (cached.length) {
        setProducts(cached);
        setLoading(false);
        painted.current = true;
      }
    }
    const [catalog, shop] = await Promise.all([refreshAvailableProducts(), refreshBusiness()]);
    setProducts(catalog);
    setBannerUrl(shop?.banner_url ?? null);
    painted.current = true;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (openingFromAvailablePush) {
        return;
      }
      setCategoryId(getHomeCategoryId());
      if (focusProductId) {
        return;
      }
      void loadCatalog()
        .catch(() => {
          if (!painted.current) {
            setProducts([]);
          }
        })
        .finally(() => setLoading(false));
    }, [focusProductId, loadCatalog, openingFromAvailablePush]),
  );

  const reportCatalogReadyForNotificationOffer = useCallback(() => {
    if (!loading && !pushCatalogLoading) {
      notifyHomeCatalogReady();
    }
  }, [loading, pushCatalogLoading]);

  useEffect(() => {
    reportCatalogReadyForNotificationOffer();
  }, [reportCatalogReadyForNotificationOffer]);

  useFocusEffect(
    useCallback(() => {
      reportCatalogReadyForNotificationOffer();
    }, [reportCatalogReadyForNotificationOffer]),
  );

  useEffect(() => {
    if (!focusProductId) {
      return;
    }
    let active = true;
    let clearHighlightTimer: ReturnType<typeof setTimeout> | undefined;
    pendingFocusProductId.current = focusProductId;
    didScrollToHighlight.current = false;

    const fromPush = fromAvailablePush === '1';
    if (fromPush) {
      setPushCatalogLoading(true);
    }
    setHighlightProductId(focusProductId);
    setHighlightFromPush(fromPush);
    const highlightMs = fromPush ? 10_000 : 4_000;
    clearHighlightTimer = setTimeout(() => {
      if (active) {
        setHighlightProductId((current) => (current === focusProductId ? null : current));
        setHighlightFromPush(false);
      }
    }, highlightMs);

    void (async () => {
      if (fromPush) {
        try {
          void refreshNotifyInterests();
          invalidateProductCatalogCache();
          const applyAvailableSoonAsInStock = (list: Product[]) =>
            sortProductsForDisplay(
              list.map((p) => (p.id === focusProductId ? { ...p, available: true } : p)),
            );

          setProducts((prev) => (prev.length > 0 ? applyAvailableSoonAsInStock(prev) : prev));

          const diskCatalog = await getCachedProducts();
          if (active && diskCatalog.length > 0) {
            setProducts(applyAvailableSoonAsInStock(diskCatalog));
            setLoading(false);
            setPushCatalogLoading(false);
          }

          const [live, catalog] = await Promise.all([
            fetchProductByIdLive(focusProductId),
            refreshAvailableProducts(),
          ]);
          if (!active) {
            return;
          }
          let next = catalog;
          if (live?.available === true) {
            const index = next.findIndex((p) => p.id === live.id);
            if (index >= 0) {
              const merged = next.slice();
              merged[index] = live;
              next = sortProductsForDisplay(merged);
            } else if (live.active !== false) {
              next = sortProductsForDisplay([...next, live]);
            }
          }
          setProducts(next);
          setLoading(false);
          painted.current = true;
        } finally {
          if (active) {
            setPushCatalogLoading(false);
          }
        }
        return;
      }

      const cached = await getCachedProducts();
      if (active && cached.length > 0) {
        setProducts(cached);
        setLoading(false);
        painted.current = true;
      }
      invalidateProductCatalogCache();
      const catalog = await refreshAvailableProducts();
      if (!active) {
        return;
      }
      setProducts(catalog);
      setLoading(false);
      painted.current = true;
    })();

    return () => {
      active = false;
      setPushCatalogLoading(false);
      if (clearHighlightTimer !== undefined) {
        clearTimeout(clearHighlightTimer);
      }
    };
  }, [focusProductId, fromAvailablePush, pushOpenKey, refreshNotifyInterests]);

  useEffect(() => {
    if (openingFromAvailablePush) {
      return;
    }
    return subscribeHomeCategory(() => {
      startTransition(() => setCategoryId(getHomeCategoryId()));
    });
  }, [openingFromAvailablePush]);

  const sortedProducts = useMemo(() => sortProductsForDisplay(products), [products]);

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return sortedProducts.filter((product) => {
      if (categoriesEnabled && categoryId && product.category_id !== categoryId) {
        return false;
      }
      if (!term) {
        return true;
      }
      return matchesSearch(product, term);
    });
  }, [categoriesEnabled, categoryId, sortedProducts, query]);

  const selectCategory = useCallback(
    (id: string) => {
      if (id === categoryId) {
        return;
      }
      assignHomeCategoryId(id);
      startTransition(() => {
        setCategoryId(id);
      });
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    },
    [categoryId],
  );

  const quantityById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      map[item.product.id] = item.quantity;
    }
    return map;
  }, [items]);

  const tryScrollToHighlightedProduct = useCallback(
    (productId: string) => {
      if (
        didScrollToHighlight.current ||
        highlightProductId !== productId ||
        pendingFocusProductId.current !== productId
      ) {
        return;
      }
      const index = visibleProducts.findIndex((row) => row.id === productId);
      if (index < 0) {
        return;
      }
      didScrollToHighlight.current = true;
      pendingFocusProductId.current = null;
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index, animated: true, viewOffset: 100 });
      });
    },
    [highlightProductId, visibleProducts],
  );

  const listHeader = useMemo(
    () =>
      bannerUrl ? (
        <Image source={{ uri: bannerUrl }} style={styles.banner} contentFit="cover" />
      ) : null,
    [bannerUrl],
  );

  const listEmpty = useMemo(() => {
    if (openingFromAvailablePush) {
      return (
        <View style={styles.emptyLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    return (
      <Text style={styles.empty}>
        {offline && products.length === 0
          ? 'Connect to the internet to load products.'
          : query.trim() || categoryId
            ? 'No products match this search.'
            : 'No products to show yet.'}
      </Text>
    );
  }, [categoryId, offline, openingFromAvailablePush, products.length, query]);

  const renderProduct = useCallback<ListRenderItem<Product>>(
    ({ item }) => (
      <HomeProductGridItem
        product={item}
        quantity={quantityById[item.id] ?? 0}
        highlighted={highlightProductId === item.id}
        highlightFromPush={highlightFromPush}
        notifyNotified={isNotified(item.id)}
        notifyBusy={busyId === item.id}
        onAddToCart={addToCart}
        onIncrease={increase}
        onDecrease={decrease}
        onNotifyPress={(productId, productName) => void onNotifyPress(productId, productName)}
        onLayout={
          highlightProductId === item.id ? () => tryScrollToHighlightedProduct(item.id) : undefined
        }
      />
    ),
    [
      addToCart,
      busyId,
      decrease,
      highlightFromPush,
      highlightProductId,
      increase,
      isNotified,
      onNotifyPress,
      quantityById,
      tryScrollToHighlightedProduct,
    ],
  );

  const listContentPadding = useMemo(
    () => ({
      paddingBottom: keyboardOpen
        ? keyboardHeight + spacing.md
        : viewCartScrollPadding(insets.bottom, itemCount > 0),
    }),
    [insets.bottom, itemCount, keyboardHeight, keyboardOpen],
  );

  if ((loading && !focusProductId) || pushCatalogLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <HomeHeader />
      <ModifyOrderBar variant="shop" style={styles.modifyBar} />
      {offline ? (
        <View style={styles.offlineWrap}>
          <OfflineBanner />
        </View>
      ) : null}
      {searching || !env.voiceOrdering ? null : (
        <Pressable
          style={({ pressed }) => [styles.samCta, pressed && styles.pressed]}
          onPress={() => router.push('/sam')}
          accessibilityRole="button"
          accessibilityLabel="Order by voice"
        >
          <View style={styles.samIcon}>
            <Ionicons name="mic" size={22} color={colors.primaryText} />
            <View style={styles.samSpark}>
              <Ionicons name="sparkles" size={10} color={colors.primary} />
            </View>
          </View>
          <View style={styles.samCopy}>
            <Text style={styles.samTitle}>Order by Voice</Text>
            <Text style={styles.samSubtitle}>Just say what you need</Text>
          </View>
          <View style={styles.samArrow}>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          </View>
        </Pressable>
      )}
      <View style={[styles.searchBar, (searching || !env.voiceOrdering) && styles.searchBarTop]}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={onSearchChange}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onSubmitEditing={() => Keyboard.dismiss()}
            placeholder="Search products"
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
      {categoriesEnabled && categories.length > 0 ? (
        <View style={styles.chipsBar}>
          <ScrollView
            ref={chipsRef}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.chipsScroller}
            contentContainerStyle={styles.chips}
          >
            <Pressable
              onPress={() => selectCategory('')}
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
                  onPress={() => selectCategory(item.id)}
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
        </View>
      ) : null}
      <FlatList
        ref={listRef}
        data={visibleProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        numColumns={2}
        columnWrapperStyle={visibleProducts.length > 0 ? styles.gridRow : undefined}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        style={styles.productScroll}
        contentContainerStyle={[styles.scroll, listContentPadding]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        onScrollToIndexFailed={(info) => {
          requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({
              index: info.index,
              animated: true,
              viewOffset: 100,
            });
          });
        }}
      />
      {keyboardOpen ? null : <ViewCartBar />}
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
  productScroll: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    gap: spacing.xs,
  },
  chipsBar: {
    backgroundColor: colors.background,
    paddingBottom: 4,
  },
  offlineWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  searchBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 4,
    backgroundColor: colors.background,
  },
  searchBarTop: {
    paddingTop: spacing.sm,
  },
  samCta: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 68,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.sm,
  },
  samIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  samSpark: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  samCopy: {
    flex: 1,
    minWidth: 0,
  },
  samTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: colors.text,
  },
  samSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  samArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceInset,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.12)',
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  search: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  clearButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
  chipsScroller: {
    flexGrow: 0,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: 4,
    alignItems: 'center',
  },
  chip: {
    height: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.14)',
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  chipOn: {
    backgroundColor: colors.primary,
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
    color: colors.primaryDark,
  },
  chipLabelOn: {
    color: colors.primaryText,
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
  emptyLoading: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: -4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
