import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  formatAddressForOrder,
  getAddressBook,
  loadAddressBook,
  selectAddress,
  type SavedAddress,
} from '@/cart/address-book';
import { useCart } from '@/cart/CartContext';
import { cartItemFromAdd } from '@/cart/add-line';
import { goModifyOrder } from '@/cart/modify-flow';
import { clearNewOrderIntent, takeNewOrderIntent } from '@/cart/new-order-intent';
import { newOrderEligibilityForAddresses, type AddressNewOrderRow } from '@/cart/open-cart-guard';
import { colors, spacing } from '@/config/theme';
import { showAppDialog } from '@/components/AppDialogHost';
import { NewOrderAddressPicker } from '@/sam/NewOrderAddressPicker';
import { findOpenOrderForAddress } from '@/services/orders';

export default function NewOrderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { addItem, beginEditOrder } = useCart();
  const [rows, setRows] = useState<AddressNewOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const list = await loadAddressBook().catch(() => getAddressBook());
    const next = await newOrderEligibilityForAddresses(list).catch(() =>
      list.map((address) => ({ address, blockingOrder: null })),
    );
    setRows(next);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => setLoading(false));
    }, [refresh]),
  );

  useEffect(() => () => clearNewOrderIntent(), []);

  function leave() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  }

  async function choose(address: SavedAddress) {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const blocking = await findOpenOrderForAddress({
        addressId: address.id,
        address: formatAddressForOrder(address),
        pincode: address.pincode,
      });
      if (blocking) {
        await refresh();
        return;
      }
      await selectAddress(address.id);
      const pending = takeNewOrderIntent();
      if (pending) {
        addItem(pending.product, pending.quantity, pending.extras);
      }
      if (next === 'cart') {
        router.replace('/cart');
      } else {
        leave();
      }
    } catch (error) {
      showAppDialog({
        title: 'Could not switch address',
        message: error instanceof Error ? error.message : 'Please try again.',
        icon: 'location',
        tone: 'warning',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={leave} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          New order
        </Text>
        <View style={styles.back} />
      </View>
      <NewOrderAddressPicker
        rows={rows}
        loading={loading}
        onSelect={(address) => {
          choose(address).catch(() => undefined);
        }}
        onModify={(order) => {
          const pending = takeNewOrderIntent();
          const additions = pending
            ? [cartItemFromAdd(pending.product, pending.quantity, pending.extras)]
            : undefined;
          goModifyOrder(order, beginEditOrder, { skipConfirm: true, additions });
        }}
        onViewOrder={(order) => router.push({ pathname: '/confirmation', params: { id: order.id } })}
        onAdd={() => router.push({ pathname: '/address/form', params: { next: 'back' } })}
        onManage={() => router.push('/checkout')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: 10,
    backgroundColor: colors.background,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: colors.text,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
