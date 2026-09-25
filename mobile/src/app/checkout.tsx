import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MAX_SAVED_ADDRESSES,
  deleteAddress,
  formatAddressForOrder,
  getAddressBook,
  getSelectedAddress,
  hydrateAddressBook,
  loadAddressBook,
  selectAddress,
  subscribeAddressBook,
  type SavedAddress,
} from '@/cart/address-book';
import { useCart } from '@/cart/CartContext';
import { loadDeliveryDraft } from '@/cart/delivery-draft';
import { PrimaryButton } from '@/components/PrimaryButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { colors, radius, spacing } from '@/config/theme';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { isNetworkFailure } from '@/services/network';
import { getLastDeliveryDetails, placeOrder } from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';
import { composeAddressLine, stateFromPincode } from '@/utils/address';
import { formatPrice } from '@/utils/format';

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, totalAmount, clearCart } = useCart();
  const { offline, requireConnection } = useNetworkStatus();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selected = useMemo(
    () => addresses.find((item) => item.id === selectedId) ?? addresses[0] ?? null,
    [addresses, selectedId],
  );

  const reload = useCallback(async () => {
    const [draft, lastOrder] = await Promise.all([loadDeliveryDraft(), getLastDeliveryDetails()]);
    await hydrateAddressBook([draft, lastOrder]);
    const list = await loadAddressBook();
    setAddresses(list);
    setSelectedId(getSelectedAddress()?.id ?? list[0]?.id ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload().catch(() => undefined);
    }, [reload]),
  );

  useEffect(() => {
    return subscribeAddressBook(() => {
      const list = getAddressBook();
      setAddresses(list);
      setSelectedId(getSelectedAddress()?.id ?? list[0]?.id ?? null);
    });
  }, []);

  async function onDelete(id: string) {
    Alert.alert('Delete address', 'Remove this address from the list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteAddress(id);
          const list = await loadAddressBook();
          setAddresses(list);
          setSelectedId(getSelectedAddress()?.id ?? list[0]?.id ?? null);
        },
      },
    ]);
  }

  async function onSelect(id: string) {
    setError(null);
    setSelectedId(id);
    await selectAddress(id);
  }

  async function onPlaceOrder() {
    setError(null);
    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    if (!selected) {
      setError('Add a delivery address.');
      return;
    }
    const details = {
      name: selected.name,
      mobile: selected.mobile,
      address: formatAddressForOrder(selected),
      pincode: selected.pincode,
      addressId: selected.id,
    };
    const user = await getSignedInUser();
    if (!user) {
      router.push({ pathname: '/login', params: { next: 'checkout' } });
      return;
    }
    if (!(await requireConnection())) {
      return;
    }
    setSubmitting(true);
    try {
      const order = await placeOrder(details, items);
      clearCart();
      router.replace({
        pathname: '/confirmation',
        params: {
          id: order.id,
          orderNumber: order.order_number != null ? String(order.order_number) : '',
          status: order.status,
          payment: order.payment_method ?? 'pending',
        },
      });
    } catch (placeError) {
      const message = placeError instanceof Error ? placeError.message : 'Could not place the order.';
      if (message.toLowerCase().includes('sign in')) {
        router.push({ pathname: '/login', params: { next: 'checkout' } });
        return;
      }
      if (isNetworkFailure(placeError) || isNetworkFailure(message)) {
        await requireConnection();
        return;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.md) + 108 },
        ]}
      >
        {offline ? <OfflineBanner /> : null}
        {addresses.length < MAX_SAVED_ADDRESSES ? (
          <Pressable style={styles.addNew} onPress={() => router.push('/address/form')} accessibilityRole="button">
            <Text style={styles.addNewLabel}>+ Add new</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
        ) : (
          <Text style={styles.limit}>Maximum 3 addresses. Delete one to add another.</Text>
        )}
        <Text style={styles.kicker}>Saved addresses</Text>
        {addresses.length === 0 ? (
          <Text style={styles.muted}>No saved address yet. Add one to continue.</Text>
        ) : (
          addresses.map((item) => {
            const isSelected = item.id === selected?.id;
            const line = [
              composeAddressLine(item.house ?? '', item.address, item.locality ?? '', stateFromPincode(item.pincode)),
              item.pincode,
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item.id)}
                style={[styles.card, isSelected && styles.cardOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={
                      item.label === 'work'
                        ? 'briefcase-outline'
                        : item.label === 'other'
                          ? 'location-outline'
                          : 'home-outline'
                    }
                    size={22}
                    color={colors.primaryDark}
                  />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardLine} numberOfLines={2}>
                    {line}
                  </Text>
                  <View style={styles.phoneRow}>
                    <Ionicons name="call-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.phone}>{item.mobile}</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/address/form', params: { id: item.id } })}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Edit address"
                  >
                    <Ionicons name="create-outline" size={20} color={colors.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() => onDelete(item.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Delete address"
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </Pressable>
                </View>
              </Pressable>
            );
          })
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md }]}>
        <Text style={styles.total}>To pay {formatPrice(totalAmount)}</Text>
        <PrimaryButton
          label={submitting ? 'Placing order…' : 'Place order'}
          disabled={submitting || !selected}
          onPress={onPlaceOrder}
        />
      </View>
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
    gap: spacing.md,
  },
  addNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  addNewLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  muted: {
    fontSize: 15,
    color: colors.textMuted,
  },
  limit: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cardOn: {
    borderColor: colors.primary,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
  },
  cardLine: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  phone: {
    fontSize: 13,
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.md,
    paddingTop: 2,
  },
  error: {
    fontSize: 16,
    color: colors.danger,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  total: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
});
