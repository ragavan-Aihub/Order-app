import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { useShopCatalog } from '@/catalog/ShopCatalogContext';
import { setHomeCategoryId } from '@/catalog/home-filter';
import { HomeHeader } from '@/components/HomeHeader';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ViewCartBar, viewCartScrollPadding } from '@/components/ViewCartBar';
import { colors, radius, spacing } from '@/config/theme';
import { useNetworkStatus } from '@/network/NetworkProvider';

export default function CategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categories, refreshCatalog } = useShopCatalog();
  const { itemCount } = useCart();
  const { offline } = useNetworkStatus();

  useFocusEffect(
    useCallback(() => {
      void refreshCatalog();
    }, [refreshCatalog]),
  );

  function openCategory(id: string) {
    setHomeCategoryId(id);
    router.push('/home');
  }

  return (
    <View style={styles.screen}>
      <HomeHeader />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: viewCartScrollPadding(insets.bottom, itemCount > 0) },
        ]}
      >
        {offline ? <OfflineBanner /> : null}
        {categories.length === 0 ? (
          <Text style={styles.empty}>No categories yet. Browse all products on Home.</Text>
        ) : (
          <View style={styles.grid}>
            {categories.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => openCategory(item.id)}
                style={styles.card}
                accessibilityRole="button"
              >
                <View style={styles.tile}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.photo} contentFit="cover" />
                  ) : (
                    <View style={styles.photoFallback}>
                      <Text style={styles.photoLetter}>{item.name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={styles.cardName} numberOfLines={2}>
                    {item.name}
                  </Text>
                </View>
              </Pressable>
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
  content: {
    padding: spacing.md,
    gap: spacing.sm,
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
  card: {
    width: '50%',
    padding: 6,
  },
  tile: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 108,
    backgroundColor: colors.border,
  },
  photoFallback: {
    width: '100%',
    height: 108,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLetter: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
});
