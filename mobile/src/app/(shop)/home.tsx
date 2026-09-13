import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { getDeliveryDraft, loadDeliveryDraft } from '@/cart/delivery-draft';
import { ProductCard } from '@/components/ProductCard';
import { colors, radius, spacing } from '@/config/theme';
import { getBusiness } from '@/services/business';
import { getLastDeliveryDetails } from '@/services/orders';
import { getAvailableProducts } from '@/services/products';
import type { Business } from '@/types/business';
import type { Product } from '@/types/product';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem, increase, decrease, items } = useCart();
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [deliverTo, setDeliverTo] = useState('Add a delivery address in Account');

  useFocusEffect(
    useCallback(() => {
      loadDeliveryDraft()
        .then(async () => {
          const draft = getDeliveryDraft();
          const last = await getLastDeliveryDetails();
          const line = [draft?.address || last?.address, draft?.pincode || last?.pincode]
            .filter(Boolean)
            .join(', ');
          setDeliverTo(line || 'Add a delivery address in Account');
        })
        .catch(() => undefined);
    }, []),
  );

  useEffect(() => {
    let isMounted = true;
    Promise.all([getBusiness(), getAvailableProducts()])
      .then(([shop, catalog]) => {
        if (!isMounted) {
          return;
        }
        setBusiness(shop);
        setProducts(catalog);
      })
      .catch(() => {
        if (isMounted) {
          setBusiness(null);
          setProducts([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return products;
    }
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(term) || product.description.toLowerCase().includes(term),
    );
  }, [products, query]);

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
    <ScrollView
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: insets.top + spacing.sm, paddingBottom: spacing.xl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.deliverLabel}>Deliver to</Text>
      <Text style={styles.deliverValue} numberOfLines={1}>
        {deliverTo}
      </Text>
      <Text style={styles.shopName} numberOfLines={1}>
        {business?.business_name ?? 'Shop'}
      </Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search products"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
      />
      {business?.banner_url ? (
        <Image source={{ uri: business.banner_url }} style={styles.banner} contentFit="cover" />
      ) : null}
      {visibleProducts.length === 0 ? (
        <Text style={styles.empty}>No products match this search.</Text>
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
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  deliverLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  deliverValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  shopName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xs,
  },
  search: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.xs,
  },
  banner: {
    width: '100%',
    aspectRatio: 16 / 7,
    borderRadius: radius.md,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
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
