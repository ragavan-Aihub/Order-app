import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/ProductCard';
import { useCart } from '@/cart/CartContext';
import { colors, spacing } from '@/config/theme';
import { signOut } from '@/services/auth';
import { getBusiness } from '@/services/business';
import { getAvailableProducts } from '@/services/products';
import { getSignedInUser } from '@/services/supabase';
import type { Business } from '@/types/business';
import type { Product } from '@/types/product';

export default function ProductListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem, itemCount } = useCart();
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getSignedInUser().then((user) => {
        setSignedIn(Boolean(user));
      });
    }, []),
  );

  useEffect(() => {
    let isMounted = true;

    Promise.all([getBusiness(), getAvailableProducts()])
      .then(([shop, items]) => {
        if (!isMounted) {
          return;
        }
        setBusiness(shop);
        setProducts(items);
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
        styles.content,
        { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.brand}>
          {business?.logo_url ? (
            <Image source={{ uri: business.logo_url }} style={styles.logo} contentFit="cover" />
          ) : null}
          <Text style={styles.heading}>{business?.business_name ?? 'Products'}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() =>
              signedIn
                ? router.push('/orders')
                : router.push({ pathname: '/login', params: { next: 'orders' } })
            }
            accessibilityRole="button"
          >
            <Text style={styles.link}>Orders</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/cart')} accessibilityRole="button">
            <Text style={styles.link}>Cart{itemCount > 0 ? ` (${itemCount})` : ''}</Text>
          </Pressable>
        </View>
      </View>
      {signedIn ? (
        <Pressable
          onPress={async () => {
            await signOut();
            router.replace('/');
          }}
          accessibilityRole="button"
        >
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      ) : null}
      {products.length === 0 ? (
        <Text style={styles.empty}>No products are available right now.</Text>
      ) : (
        <View style={styles.grid}>
          {products.map((product) => (
            <View key={product.id} style={styles.gridItem}>
              <ProductCard
                product={product}
                onPress={() => router.push(`/product/${product.id}`)}
                onAddToCart={() => addItem(product, 1)}
              />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brand: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
  },
  heading: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  signOut: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  empty: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  gridItem: {
    width: '33.33%',
    padding: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
