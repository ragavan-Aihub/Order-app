import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/cart/CartContext';
import { loadDeliveryDraft, saveDeliveryDraft } from '@/cart/delivery-draft';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, spacing } from '@/config/theme';
import { getCustomerProfile, getLastDeliveryDetails, placeOrder } from '@/services/orders';
import { getSupabaseClient } from '@/services/supabase';
import { formatPrice } from '@/utils/format';
import { isValidIndianMobile, isValidPincode } from '@/utils/validation';

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, totalAmount, clearCart } = useCart();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedDelivery() {
      const [draft, profile, lastOrder] = await Promise.all([
        loadDeliveryDraft(),
        getCustomerProfile(),
        getLastDeliveryDetails(),
      ]);
      if (cancelled) {
        return;
      }

      setName((current) => current || draft?.name || lastOrder?.name || profile?.name || '');
      setMobile((current) => current || draft?.mobile || lastOrder?.mobile || profile?.mobile || '');
      setAddress((current) => current || draft?.address || lastOrder?.address || '');
      setPincode((current) => current || draft?.pincode || lastOrder?.pincode || '');
    }

    loadSavedDelivery();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onPlaceOrder() {
    setError(null);

    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    if (!name.trim()) {
      setError('Enter the customer name.');
      return;
    }
    if (!isValidIndianMobile(mobile)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (!address.trim()) {
      setError('Enter the delivery address.');
      return;
    }
    if (!isValidPincode(pincode)) {
      setError('Enter a valid 6-digit pincode.');
      return;
    }

    const details = {
      name: name.trim(),
      mobile: mobile.trim(),
      address: address.trim(),
      pincode: pincode.trim(),
    };
    await saveDeliveryDraft(details);

    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

    if (!user) {
      router.push({ pathname: '/login', params: { next: 'checkout' } });
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
        },
      });
    } catch (placeError) {
      const message = placeError instanceof Error ? placeError.message : 'Could not place the order.';
      if (message.toLowerCase().includes('sign in')) {
        router.push({ pathname: '/login', params: { next: 'checkout' } });
        return;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.md) + 88 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Delivery details</Text>
        <Text style={styles.total}>Order total {formatPrice(totalAmount)}</Text>
        <Field label="Customer name">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </Field>
        <Field label="Mobile number">
          <TextInput
            value={mobile}
            onChangeText={setMobile}
            placeholder="10-digit mobile number"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </Field>
        <Field label="Delivery address">
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="House / street / area"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[styles.input, styles.multiline]}
          />
        </Field>
        <Field label="Pincode">
          <TextInput
            value={pincode}
            onChangeText={setPincode}
            placeholder="6-digit pincode"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            style={styles.input}
          />
        </Field>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md }]}>
        <PrimaryButton
          label={submitting ? 'Placing order…' : 'Place order'}
          disabled={submitting}
          onPress={onPlaceOrder}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  total: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
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
});
