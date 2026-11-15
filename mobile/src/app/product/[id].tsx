import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { useAddToCart } from '@/cart/useAddToCart';
import { CART_LIMIT_QTY, MAX_ITEM_QTY } from '@/cart/limits';
import { showAppDialog } from '@/components/AppDialogHost';
import { FavoriteHeart } from '@/components/FavoriteHeart';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ProductImage } from '@/components/ProductImage';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Skeleton } from '@/components/Skeleton';
import { ViewCartBar } from '@/components/ViewCartBar';
import { productNotifyCopy } from '@/copy/product-notify';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { useProductFavorites } from '@/hooks/useProductFavorites';
import { useProductNotifyInterests } from '@/hooks/useProductNotifyInterests';
import { fetchProductByIdLive, invalidateProductCatalogCache } from '@/services/products';
import type { Product } from '@/types/product';
import { formatPrice } from '@/utils/format';
import { hapticError, hapticSelect } from '@/utils/haptics';
import { maxLineQty, stockLimitOf, stockMessage, unitSizeOf } from '@/utils/stock';
import {
  catalogPriceLabel,
  cartLineTotal,
  formatPackWeight,
  formatVolume,
  formatWeight,
  sellingTypeOf,
  volumeOptionPrice,
  weightOptionPrice,
} from '@/utils/selling-units';

function OptionCard({
  label,
  price,
  on,
  onPress,
}: {
  label: string;
  price: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.optionCard, on && styles.optionCardOn, pressed && styles.optionCardPressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${label}, ${price}`}
    >
      {on ? (
        <View style={styles.optionCheck}>
          <Ionicons name="checkmark" size={12} color={colors.primaryText} />
        </View>
      ) : null}
      <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>{label}</Text>
      <Text style={[styles.optionPrice, on && styles.optionPriceOn]}>{price}</Text>
    </Pressable>
  );
}

export default function ProductDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { itemCount } = useCart();
  const addToCart = useAddToCart();
  const { id: idParam, fromAvailablePush: fromPushParam } = useLocalSearchParams<{
    id: string;
    fromAvailablePush?: string;
  }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const fromAvailablePush =
    (Array.isArray(fromPushParam) ? fromPushParam[0] : fromPushParam) === '1';
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [weightGramsSel, setWeightGramsSel] = useState<number | null>(null);
  const [volumeMlSel, setVolumeMlSel] = useState<number | null>(null);
  const [packOptionId, setPackOptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedIdRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (addedTimer.current) {
        clearTimeout(addedTimer.current);
      }
    },
    [],
  );

  const { isNotified, busyId, onNotifyPress, refresh: refreshNotifyInterests } = useProductNotifyInterests();
  const { isFavorite, onFavoritePress } = useProductFavorites();

  useFocusEffect(
    useCallback(() => {
      if (!id) {
        setLoading(false);
        return;
      }
      let active = true;
      const needsFullScreenLoader = loadedIdRef.current !== id || fromAvailablePush;
      if (needsFullScreenLoader) {
        setLoading(true);
      }
      void (async () => {
        if (fromAvailablePush) {
          invalidateProductCatalogCache();
        }
        await refreshNotifyInterests();
        try {
          const next = await fetchProductByIdLive(id);
          if (active) {
            setProduct(next);
            if (next) {
              loadedIdRef.current = id;
              const firstPack = (next.packs ?? []).find((pack) => pack.is_active);
              setPackOptionId(firstPack?.id ?? null);
              setWeightGramsSel(
                (next.weightOptions ?? []).find((option) => option.is_active)?.weight_grams ?? null,
              );
              setVolumeMlSel(
                (next.volumeOptions ?? []).find((option) => option.is_active)?.volume_ml ?? null,
              );
              setQuantity(1);
            }
          }
        } catch {
          if (active) {
            setProduct(null);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      })();
      return () => {
        active = false;
      };
    }, [fromAvailablePush, id, refreshNotifyInterests]),
  );

  if (loading) {
    return (
      <View style={styles.screen} accessibilityRole="progressbar" accessibilityLabel="Loading product">
        <Skeleton height={280} borderRadius={0} />
        <View style={styles.body}>
          <Skeleton width="70%" height={26} />
          <Skeleton width="35%" height={22} />
          <Skeleton width="100%" height={14} />
          <Skeleton width="80%" height={14} />
        </View>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={44} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Product not found</Text>
        <Text style={styles.empty}>It may have been removed. Go back and pick another item.</Text>
      </View>
    );
  }

  const comingSoon = product.available === false;
  const footerLoading = loading && fromAvailablePush;
  const type = sellingTypeOf(product);
  const isCountItem = type === 'quantity';
  const countUnit = product.selling_unit?.trim() || null;
  const description = product.description?.trim() || '';
  const selectedPack = (product.packs ?? []).find((pack) => pack.id === packOptionId);
  const weightOptions = (product.weightOptions ?? []).filter((option) => option.is_active);
  const volumeOptions = (product.volumeOptions ?? []).filter((option) => option.is_active);
  const packOptions = (product.packs ?? []).filter((pack) => pack.is_active);
  const pricePerKg = product.price_per_kg ?? product.price;
  const pricePerLiter = product.price_per_liter ?? product.price;
  const unavailableOptions =
    (type === 'kg' && weightOptions.length === 0) ||
    (type === 'liter' && volumeOptions.length === 0) ||
    (type === 'fixed_pack' && packOptions.length === 0);
  const lineTotal =
    type === 'kg'
      ? cartLineTotal({ product, quantity, weightGrams: weightGramsSel ?? 0 })
      : type === 'liter'
        ? cartLineTotal({ product, quantity, volumeMl: volumeMlSel ?? 0 })
        : type === 'fixed_pack'
          ? cartLineTotal({
              product,
              quantity,
              packOptionId: selectedPack?.id,
            })
          : product.price * quantity;

  function bumpQuantity(next: number) {
    const size = unitSizeOf(product, { weightGrams: weightGramsSel, volumeMl: volumeMlSel });
    const tracked = stockLimitOf(product.stock_qty) != null && size > 0;
    const cap = tracked ? maxLineQty(product.stock_qty, 0, 0, size) : MAX_ITEM_QTY;
    if (next < 1) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/home');
      }
      return;
    }
    if (next > quantity && next > cap) {
      hapticError();
      const stockCap = stockLimitOf(product.stock_qty);
      showAppDialog({
        title: stockCap != null && cap < MAX_ITEM_QTY ? 'Not available' : 'Order limit',
        message:
          stockCap != null && cap < MAX_ITEM_QTY
            ? stockMessage(stockCap, product.selling_type)
            : CART_LIMIT_QTY,
        icon: 'alert-circle',
        tone: 'warning',
      });
      return;
    }
    setQuantity(Math.min(next, cap));
  }

  function onAdd() {
    if (!product) {
      return;
    }
    let ok = false;
    if (type === 'kg') {
      if (!weightGramsSel) {
        hapticError();
        showAppDialog({
          title: 'Choose a weight.',
          icon: 'scale',
          tone: 'warning',
        });
        return;
      }
      ok = addToCart(product, quantity, { weightGrams: weightGramsSel });
    } else if (type === 'liter') {
      if (!volumeMlSel) {
        hapticError();
        showAppDialog({
          title: 'Choose a volume.',
          icon: 'water',
          tone: 'warning',
        });
        return;
      }
      ok = addToCart(product, quantity, { volumeMl: volumeMlSel });
    } else if (type === 'fixed_pack') {
      if (!selectedPack) {
        hapticError();
        showAppDialog({
          title: 'Choose a pack size.',
          icon: 'cube',
          tone: 'warning',
        });
        return;
      }
      ok = addToCart(product, quantity, {
        packOptionId: selectedPack.id,
        packWeightGrams: selectedPack.weight_grams,
      });
    } else {
      ok = addToCart(product, quantity);
    }
    if (ok) {
      setAdded(true);
      if (addedTimer.current) {
        clearTimeout(addedTimer.current);
      }
      addedTimer.current = setTimeout(() => setAdded(false), 1400);
    }
  }

  return (
    <View style={[styles.screen, isCountItem && styles.screenCount]}>
      <Stack.Screen
        options={{
          title: 'Product details',
          headerRight: () => (
            <FavoriteHeart size="header" on={isFavorite(product.id)} onPress={() => void onFavoritePress(product.id)} />
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.imageWrap, isCountItem && styles.imageWrapCount]}>
          <ProductImage
            uri={product.image_url}
            style={styles.image}
            dimmed={comingSoon}
            recyclingKey={product.id}
            accessibilityLabel={product.name}
          />
          {comingSoon ? (
            <View style={styles.soonBadge}>
              <Text style={styles.soonBadgeText}>Coming soon</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.sheet, isCountItem && styles.sheetCount]}>
          <Text style={styles.name}>{product.name}</Text>
          {comingSoon ? null : (
            <View style={styles.priceRow}>
              {isCountItem ? (
                <>
                  <Text style={styles.price}>{formatPrice(product.price)}</Text>
                  {countUnit ? <Text style={styles.priceUnit}> / {countUnit}</Text> : null}
                </>
              ) : (
                <Text style={styles.price}>{catalogPriceLabel(product)}</Text>
              )}
            </View>
          )}
          {description ? <Text style={styles.description}>{description}</Text> : null}

          {!comingSoon && isCountItem ? (
            <QuantityStepper
              boxed
              value={quantity}
              valueLabel={countUnit ? `${quantity} ${countUnit}` : String(quantity)}
              onDecrease={() => bumpQuantity(quantity - 1)}
              onIncrease={() => bumpQuantity(quantity + 1)}
            />
          ) : null}

          {!comingSoon && !isCountItem ? (
            <View style={styles.optionsBlock}>
              <View style={styles.sectionRow}>
                <Ionicons
                  name={type === 'kg' ? 'scale-outline' : type === 'liter' ? 'water-outline' : 'cube-outline'}
                  size={20}
                  color={colors.primaryDark}
                />
                <Text style={styles.sectionTitle}>
                  {type === 'kg' ? 'Choose weight' : type === 'liter' ? 'Choose volume' : 'Choose pack size'}
                </Text>
              </View>
              {unavailableOptions ? (
                <Text style={styles.optionsError}>No options available right now.</Text>
              ) : (
                <View style={styles.optionGrid}>
                  {type === 'kg'
                    ? weightOptions.map((option) => (
                        <OptionCard
                          key={option.id}
                          label={formatWeight(option.weight_grams)}
                          price={formatPrice(weightOptionPrice(pricePerKg, option.weight_grams))}
                          on={weightGramsSel === option.weight_grams}
                          onPress={() => {
                            hapticSelect();
                            setWeightGramsSel(option.weight_grams);
                          }}
                        />
                      ))
                    : type === 'liter'
                      ? volumeOptions.map((option) => (
                          <OptionCard
                            key={option.id}
                            label={formatVolume(option.volume_ml)}
                            price={formatPrice(volumeOptionPrice(pricePerLiter, option.volume_ml))}
                            on={volumeMlSel === option.volume_ml}
                            onPress={() => {
                              hapticSelect();
                              setVolumeMlSel(option.volume_ml);
                            }}
                          />
                        ))
                    : packOptions.map((pack) => (
                        <OptionCard
                          key={pack.id}
                          label={formatPackWeight(pack.weight_grams)}
                          price={formatPrice(pack.selling_price)}
                          on={packOptionId === pack.id}
                          onPress={() => {
                            hapticSelect();
                            setPackOptionId(pack.id);
                          }}
                        />
                      ))}
                </View>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
      {itemCount > 0 ? <ViewCartBar inline /> : null}
      {footerLoading ? (
        <View style={[styles.footer, styles.footerCentered, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : comingSoon ? (
        <View style={[styles.footer, styles.footerStack, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md }]}>
          <View style={styles.footerNotifyRow}>
            <Text style={styles.price}>{formatPrice(product.price)}</Text>
            <Pressable
              onPress={() => void onNotifyPress(product.id, product.name)}
              disabled={busyId === product.id || isNotified(product.id)}
              style={[
                styles.notifyButton,
                styles.notifyButtonInline,
                isNotified(product.id) && styles.notifyButtonOn,
                isNotified(product.id) && styles.notifyButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: isNotified(product.id) }}
            >
              {busyId === product.id ? (
                <ActivityIndicator color={colors.primaryDark} />
              ) : (
                <Text style={[styles.notifyButtonText, isNotified(product.id) && styles.notifyButtonTextOn]}>
                  {isNotified(product.id) ? productNotifyCopy.notified : productNotifyCopy.notifyMe}
                </Text>
              )}
            </Pressable>
          </View>
          {isNotified(product.id) ? (
            <Text style={styles.notifyHelper}>{productNotifyCopy.helper}</Text>
          ) : null}
        </View>
      ) : (
        <View
          style={[
            styles.footer,
            isCountItem && styles.footerCount,
            { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md },
          ]}
        >
          {isCountItem ? null : (
            <QuantityStepper
              value={quantity}
              onDecrease={() => bumpQuantity(quantity - 1)}
              onIncrease={() => bumpQuantity(quantity + 1)}
            />
          )}
          <View style={styles.footerAction}>
            <PrimaryButton
              label={added ? 'Added to cart' : `Add to Cart · ${formatPrice(lineTotal)}`}
              disabled={unavailableOptions}
              onPress={onAdd}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenCount: {
    backgroundColor: colors.surface,
  },
  content: {
    paddingBottom: spacing.lg,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1.15,
    maxHeight: 340,
    backgroundColor: colors.placeholder,
  },
  imageWrapCount: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    maxHeight: 360,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  soonBadge: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.xl,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(24,24,27,0.72)',
  },
  soonBadgeText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '800',
  },
  sheet: {
    marginTop: -radius.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.background,
    padding: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  sheetCount: {
    backgroundColor: colors.surface,
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    gap: spacing.md,
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  name: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: colors.text,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  stockLeft: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.warning,
  },
  unitPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  unitPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  optionsBlock: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  optionsError: {
    fontSize: 14,
    color: colors.danger,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  optionCard: {
    minWidth: 96,
    flexGrow: 1,
    flexBasis: '30%',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 4,
  },
  optionCardOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  optionCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  optionLabelOn: {
    color: colors.primaryDark,
  },
  optionPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  optionPriceOn: {
    color: colors.primaryDark,
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  priceUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    ...shadow.card,
    shadowOffset: { width: 0, height: -4 },
  },
  footerStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  footerCentered: {
    justifyContent: 'center',
    minHeight: 72,
  },
  footerCount: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
    paddingTop: spacing.sm,
  },
  footerAction: {
    flex: 1,
  },
  footerNotifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  notifyHelper: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  notifyButton: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  notifyButtonInline: {
    minHeight: 40,
    minWidth: 120,
  },
  notifyButtonOn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  notifyButtonDisabled: {
    opacity: 0.55,
  },
  notifyButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
  notifyButtonTextOn: {
    color: colors.primaryDark,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  empty: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
