import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateSearchChrome() {
  LayoutAnimation.configureNext({
    duration: 220,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  });
}

import { useCart } from '@/cart/CartContext';
import { useAddToCart } from '@/cart/useAddToCart';
import { useShopCatalog } from '@/catalog/ShopCatalogContext';
import {
  assignHomeCategoryId,
  getHomeCategoryId,
  setHomeCategoryId,
  subscribeHomeCategory,
} from '@/catalog/home-filter';
import { HomeGreetingRow } from '@/components/HomeGreetingRow';
import { HomeHeader } from '@/components/HomeHeader';
import { ShopBannerCarousel } from '@/components/ShopBannerCarousel';
import { HomeCatalogSkeleton } from '@/components/Skeleton';
import { ShopHomeNotice, shopClosedMessage } from '@/components/ShopHomeNotice';
import { HomeFavouritesRow } from '@/components/HomeFavouritesRow';
import { HomeProductGridItem } from '@/components/HomeProductGridItem';
import { ModifyOrderBar } from '@/components/ModifyOrderBar';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useProductFavorites } from '@/hooks/useProductFavorites';
import { useProductNotifyInterests } from '@/hooks/useProductNotifyInterests';
import { ViewCartBar, viewCartScrollPadding } from '@/components/ViewCartBar';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { notifyHomeCatalogReady } from '@/notifications/notification-permission-offer';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { getBusiness, getShopBanners, peekCachedBusiness, refreshBusiness, type ShopBanner } from '@/services/business';
import type { Business } from '@/types/business';
import {
  fetchProductByIdLive,
  getAvailableProducts,
  getCachedProducts,
  invalidateProductCatalogCache,
  peekCachedProducts,
  refreshAvailableProducts,
} from '@/services/products';
import type { Product } from '@/types/product';
import { productMatchesSearch, sortProductsForDisplay, sortProductsForSearch } from '@/utils/product-list-sort';

/** Skip a full home network fan-out when the catalog was fetched recently. */
const HOME_CATALOG_FOCUS_TTL_MS = 45_000;
let lastHomeCatalogFetchAt = 0;

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
  const navigation = useNavigation();
  const { increase, decrease, items, itemCount, resumeEdit, takeResumeEdit } = useCart();
  const addToCart = useAddToCart();
  const { isNotified, busyId, onNotifyPress, refresh: refreshNotifyInterests } =
    useProductNotifyInterests();
  const { favoriteIds, isFavorite, favoriteBusyId, onFavoritePress } = useProductFavorites();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (resumeEdit) {
      takeResumeEdit();
      router.push('/cart');
    }
  }, [resumeEdit, router, takeResumeEdit]);
  const { offline } = useNetworkStatus();
  const { categoriesEnabled, categories } = useShopCatalog();
  const [products, setProducts] = useState<Product[]>(() => peekCachedProducts());
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState(getHomeCategoryId());
  const [banners, setBanners] = useState<ShopBanner[]>([]);
  const [shopNotice, setShopNotice] = useState<Business | null>(null);
  const [loading, setLoading] = useState(() => peekCachedProducts().length === 0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
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
    const wasFiltering = query.trim().length > 0;
    const willFilter = text.trim().length > 0;
    if (wasFiltering !== willFilter) {
      animateSearchChrome();
    }
    setQuery(text);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    const term = text.trim().toLowerCase();
    if (!term || !categoriesEnabled || !categoryId) {
      return;
    }
    const inCategory = products.some(
      (product) => product.category_id === categoryId && productMatchesSearch(product, term),
    );
    if (!inCategory && products.some((product) => productMatchesSearch(product, term))) {
      assignHomeCategoryId('');
      startTransition(() => setCategoryId(''));
      chipsRef.current?.scrollTo({ x: 0, animated: true });
    }
  };

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

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

  const closeSearch = useCallback(() => {
    animateSearchChrome();
    setSearchOpen(false);
    setSearchFocused(false);
    setQuery('');
    Keyboard.dismiss();
    searchInputRef.current?.blur();
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const openSearch = useCallback(() => {
    if (searchOpen) {
      setSearchFocused(true);
      return;
    }
    animateSearchChrome();
    setSearchFocused(true);
    setSearchOpen(true);
  }, [searchOpen]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', (event) => {
      if (!searchOpen) {
        return;
      }
      event.preventDefault();
      closeSearch();
    });
    return unsubscribe;
  }, [closeSearch, navigation, searchOpen]);

  useFocusEffect(
    useCallback(() => {
      if (!searchOpen) {
        return;
      }
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        closeSearch();
        return true;
      });
      return () => subscription.remove();
    }, [closeSearch, searchOpen]),
  );

  const loadCatalog = useCallback(async (force = false) => {
    if (!painted.current) {
      const cached = await getCachedProducts();
      if (cached.length) {
        setProducts(cached);
        setLoading(false);
        painted.current = true;
      }
      const peekShop = peekCachedBusiness();
      if (peekShop) {
        setShopNotice(peekShop);
      }
    }

    const now = Date.now();
    const freshEnough =
      !force && painted.current && now - lastHomeCatalogFetchAt < HOME_CATALOG_FOCUS_TTL_MS;

    if (freshEnough) {
      const catalog = await getAvailableProducts();
      setProducts(catalog);
      painted.current = true;
      void refreshAvailableProducts().then((fresh) => {
        setProducts(fresh);
        lastHomeCatalogFetchAt = Date.now();
      });
      return;
    }

    if (!force) {
      const [cachedCatalog, cachedShop] = await Promise.all([getAvailableProducts(), getBusiness()]);
      if (cachedCatalog.length) {
        setProducts(cachedCatalog);
        setLoading(false);
        painted.current = true;
      }
      if (cachedShop) {
        setShopNotice(cachedShop);
      }
    }

    const [catalog, shop, posters] = await Promise.all([
      refreshAvailableProducts(),
      refreshBusiness(),
      getShopBanners(),
    ]);
    setProducts(catalog);
    setBanners(posters);
    setShopNotice(shop);
    lastHomeCatalogFetchAt = Date.now();
    painted.current = true;
  }, []);

  const onPullRefresh = useCallback(() => {
    setRefreshing(true);
    void loadCatalog(true)
      .catch(() => undefined)
      .finally(() => {
        setRefreshing(false);
        setLoading(false);
      });
  }, [loadCatalog]);

  useFocusEffect(
    useCallback(() => {
      if (openingFromAvailablePush) {
        return;
      }
      setCategoryId(getHomeCategoryId());
      if (focusProductId) {
        return;
      }
      void loadCatalog(false)
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
          void refreshNotifyInterests(true);
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
    const filtered = sortedProducts.filter((product) => {
      if (categoriesEnabled && categoryId && product.category_id !== categoryId) {
        return false;
      }
      if (!term) {
        return true;
      }
      return productMatchesSearch(product, term);
    });
    return term ? sortProductsForSearch(filtered, term) : filtered;
  }, [categoriesEnabled, categoryId, sortedProducts, query]);

  const favouriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const searchFiltering = query.trim().length > 0;

  /** Home grid under favourites: skip favourited items so this section is the remaining catalog. */
  const exploreProducts = useMemo(() => {
    if (searchOpen || searchFiltering || categoryId || favouriteIdSet.size === 0) {
      return visibleProducts;
    }
    return visibleProducts.filter((product) => !favouriteIdSet.has(product.id));
  }, [categoryId, favouriteIdSet, searchFiltering, searchOpen, visibleProducts]);

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

  const tryScrollToHighlightedProduct = useCallback(
    (productId: string) => {
      if (
        didScrollToHighlight.current ||
        highlightProductId !== productId ||
        pendingFocusProductId.current !== productId
      ) {
        return;
      }
      const index = exploreProducts.findIndex((row) => row.id === productId);
      if (index < 0) {
        return;
      }
      didScrollToHighlight.current = true;
      pendingFocusProductId.current = null;
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index, animated: true, viewOffset: 100 });
      });
    },
    [exploreProducts, highlightProductId],
  );

  const favouriteProducts = useMemo(() => {
    if (searchFiltering || favoriteIds.length === 0) {
      return [];
    }
    const byId = new Map(products.map((product) => [product.id, product]));
    return favoriteIds.flatMap((id) => {
      const product = byId.get(id);
      return product ? [product] : [];
    });
  }, [favoriteIds, products, searchFiltering]);

  const listHeader = useMemo(() => {
    const notice = shopClosedMessage(shopNotice) ? <ShopHomeNotice shop={shopNotice} /> : null;
    const poster =
      searchOpen || searchFiltering || banners.length === 0 ? null : (
        <ShopBannerCarousel banners={banners} />
      );
    const favourites =
      !searchOpen && !searchFiltering && favouriteProducts.length > 0 ? (
        <HomeFavouritesRow
          products={favouriteProducts}
          quantityById={quantityById}
          isFavorite={isFavorite}
          onFavoritePress={(productId) => void onFavoritePress(productId)}
          favoriteBusyId={favoriteBusyId}
          onAddToCart={addToCart}
          onIncrease={increase}
          onDecrease={decrease}
          isNotified={isNotified}
          busyId={busyId}
          onNotifyPress={(productId, productName) => void onNotifyPress(productId, productName)}
        />
      ) : null;
    const exploreTitle =
      !searchOpen &&
      !searchFiltering &&
      favouriteProducts.length > 0 &&
      exploreProducts.length > 0 ? (
        <View style={styles.exploreTitleRow}>
          <Text style={styles.exploreTitle}>Explore All Products</Text>
        </View>
      ) : null;
    if (!notice && !poster && !favourites && !exploreTitle) {
      return null;
    }
    return (
      <View>
        {notice}
        {poster}
        {favourites}
        {exploreTitle}
      </View>
    );
  }, [
    addToCart,
    banners,
    busyId,
    decrease,
    exploreProducts.length,
    favouriteProducts,
    favoriteBusyId,
    increase,
    isFavorite,
    isNotified,
    onFavoritePress,
    onNotifyPress,
    quantityById,
    searchFiltering,
    searchOpen,
    shopNotice,
  ]);

  const listEmpty = useMemo(() => {
    if (openingFromAvailablePush) {
      return (
        <View style={styles.emptyLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    if (favouriteProducts.length > 0 && !query.trim() && !categoryId) {
      return null;
    }
    const filtered = Boolean(query.trim() || categoryId);
    return (
      <View style={styles.emptyWrap}>
        <Ionicons
          name={offline && products.length === 0 ? 'cloud-offline-outline' : 'search-outline'}
          size={52}
          color={colors.textMuted}
        />
        <Text style={styles.emptyTitle}>
          {offline && products.length === 0
            ? 'You are offline'
            : filtered
              ? 'No products found'
              : 'Nothing here yet'}
        </Text>
        <Text style={styles.empty}>
          {offline && products.length === 0
            ? 'Connect to the internet to load products.'
            : filtered
              ? 'Try a different word or clear the filter.'
              : 'New products will show up here soon.'}
        </Text>
        {filtered ? (
          <Pressable
            onPress={() => {
              setQuery('');
              assignHomeCategoryId('');
              startTransition(() => setCategoryId(''));
            }}
            style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.emptyButtonLabel}>Clear search</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }, [
    categoryId,
    favouriteProducts.length,
    offline,
    openingFromAvailablePush,
    products.length,
    query,
  ]);

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
        favorited={isFavorite(item.id)}
        favoriteBusy={favoriteBusyId === item.id}
        onFavoritePress={(productId) => void onFavoritePress(productId)}
        onLayout={
          highlightProductId === item.id ? () => tryScrollToHighlightedProduct(item.id) : undefined
        }
      />
    ),
    [
      addToCart,
      busyId,
      decrease,
      favoriteBusyId,
      highlightFromPush,
      highlightProductId,
      increase,
      isFavorite,
      isNotified,
      onFavoritePress,
      onNotifyPress,
      quantityById,
      tryScrollToHighlightedProduct,
    ],
  );

  const listContentPadding = useMemo(
    () => ({
      paddingBottom: keyboardOpen ? spacing.lg : viewCartScrollPadding(insets.bottom, itemCount > 0),
    }),
    [insets.bottom, itemCount, keyboardOpen],
  );

  if ((loading && !focusProductId) || pushCatalogLoading) {
    return (
      <View style={styles.screen}>
        <View style={styles.chrome}>
          <HomeHeader />
          <View style={[styles.searchBar, styles.searchBarTop]}>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={20} color={colors.textMuted} />
              <Text style={[styles.search, styles.searchPlaceholder]}>Search products</Text>
            </View>
          </View>
        </View>
        <HomeCatalogSkeleton />
      </View>
    );
  }

  return (
    <View style={[styles.screen, searchOpen && { paddingTop: insets.top }]}>
      <View style={styles.chrome}>
        {searchOpen ? null : <HomeHeader />}
        <ModifyOrderBar variant="shop" style={styles.modifyBar} />
        {offline ? (
          <View style={styles.offlineWrap}>
            <OfflineBanner />
          </View>
        ) : null}
        <View style={[styles.searchBar, styles.searchBarTop]}>
          {searchOpen ? (
            <Pressable
              onPress={closeSearch}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={20} color={colors.primary} />
            </Pressable>
          ) : null}
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={20} color={colors.textMuted} />
            <TextInput
              ref={searchInputRef}
              value={query}
              onChangeText={onSearchChange}
              onFocus={openSearch}
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
        {searchOpen ? null : <HomeGreetingRow />}
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
      </View>
      <FlatList
        ref={listRef}
        data={exploreProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        numColumns={2}
        columnWrapperStyle={exploreProducts.length > 0 ? styles.gridRow : undefined}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        style={[styles.productScroll, keyboardOpen && { marginBottom: keyboardHeight }]}
        contentContainerStyle={[styles.scroll, listContentPadding]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={colors.primary} />
        }
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
  chrome: {
    backgroundColor: colors.background,
    zIndex: 2,
    ...shadow.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 4,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarTop: {
    paddingTop: spacing.sm,
  },
  pressed: {
    opacity: 0.88,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primaryOutline,
    ...shadow.sm,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
  empty: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
  },
  searchPlaceholder: {
    paddingVertical: 14,
    color: colors.textMuted,
  },
  emptyWrap: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xs,
  },
  emptyButton: {
    marginTop: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonLabel: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: '700',
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
  exploreTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    paddingHorizontal: 4,
  },
  exploreTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
