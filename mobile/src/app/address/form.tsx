import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MAX_SAVED_ADDRESSES,
  loadAddressBook,
  upsertAddress,
  type SavedAddress,
} from '@/cart/address-book';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, radius, spacing } from '@/config/theme';
import { getCustomerProfile } from '@/services/orders';
import { getSignedInUser } from '@/services/supabase';
import {
  ADDRESS_FIELD_COPY,
  ADDRESS_LABELS,
  lookupPincodeState,
  stateFromPincode,
  type AddressLabel,
} from '@/utils/address';
import { isValidIndianMobile, isValidPincode } from '@/utils/validation';

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value ?? '';
}

const LABEL_ICONS: Record<AddressLabel, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  work: 'briefcase-outline',
  other: 'location-outline',
};

export default function AddressFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    locality?: string;
    pincode?: string;
    lat?: string;
    lng?: string;
    next?: string;
  }>();
  const editingId = firstParam(params.id);
  const nextPath = firstParam(params.next) === 'cart' ? '/cart' : '/checkout';
  const [house, setHouse] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState(firstParam(params.locality));
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [altMobile, setAltMobile] = useState('');
  const [pincode, setPincode] = useState(firstParam(params.pincode));
  const [stateName, setStateName] = useState(stateFromPincode(firstParam(params.pincode)));
  const [label, setLabel] = useState<AddressLabel>('home');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSave =
    Boolean(house.trim()) &&
    Boolean(area.trim()) &&
    isValidPincode(pincode) &&
    Boolean(name.trim()) &&
    isValidIndianMobile(mobile);

  useEffect(() => {
    let cancelled = false;
    getSignedInUser().then((user) => {
      if (cancelled) {
        return;
      }
      if (!user) {
        router.replace({ pathname: '/login', params: { next: nextPath === '/cart' ? 'cart' : 'checkout' } });
      }
    });

    if (editingId) {
      loadAddressBook().then((list) => {
        const row = list.find((item) => item.id === editingId);
        if (!row) {
          return;
        }
        setHouse(row.house ?? '');
        setArea(row.address ?? '');
        setLandmark(row.locality ?? '');
        setName(row.name);
        setMobile(row.mobile.replace(/\D/g, '').slice(-10));
        setAltMobile(row.altMobile ?? '');
        setPincode(row.pincode);
        setStateName(stateFromPincode(row.pincode));
        setLabel(row.label === 'work' || row.label === 'other' ? row.label : 'home');
      });
      return () => {
        cancelled = true;
      };
    }

    loadAddressBook().then((list) => {
      if (list.length >= MAX_SAVED_ADDRESSES) {
        router.replace(nextPath);
      }
    });

    getCustomerProfile()
      .then((profile) => {
        if (!profile) {
          return;
        }
        const profileName = profile.name?.trim() || '';
        const generic = !profileName || profileName.toLowerCase() === 'customer';
        if (!generic) {
          setName((current) => current || profileName);
        }
        if (profile.mobile) {
          const digits = profile.mobile.replace(/\D/g, '').slice(-10);
          setMobile((current) => current || digits);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [editingId, nextPath, router]);

  const phoneDigits = useMemo(() => mobile.replace(/\D/g, '').slice(0, 10), [mobile]);

  useEffect(() => {
    const pin = pincode.trim();
    const local = stateFromPincode(pin);
    if (!isValidPincode(pin)) {
      setStateName('');
      return;
    }
    setStateName(local);
    let cancelled = false;
    lookupPincodeState(pin).then((remote) => {
      if (!cancelled && remote) {
        setStateName(remote);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pincode]);

  async function onSave() {
    setError(null);
    if (!house.trim()) {
      setError('Enter flat / house no. / building / block no.');
      return;
    }
    if (!area.trim()) {
      setError('Enter area / street / village.');
      return;
    }
    if (!name.trim()) {
      setError("Enter the receiver's name.");
      return;
    }
    if (!isValidIndianMobile(mobile)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (!isValidPincode(pincode)) {
      setError('Enter a valid 6-digit pincode.');
      return;
    }
    setSaving(true);
    try {
      const payload: Omit<SavedAddress, 'id'> & { id?: string } = {
        id: editingId || undefined,
        name: name.trim(),
        mobile: phoneDigits,
        address: area.trim(),
        pincode: pincode.trim(),
        house: house.trim(),
        locality: landmark.trim() || undefined,
        label,
        altMobile: altMobile.trim() || undefined,
        lat: params.lat ? Number(params.lat) : undefined,
        lng: params.lng ? Number(params.lng) : undefined,
      };
      await upsertAddress(payload);
      router.replace(nextPath);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Could not save this address.';
      if (message.toLowerCase().includes('sign in')) {
        router.replace({ pathname: '/login', params: { next: nextPath === '/cart' ? 'cart' : 'checkout' } });
        return;
      }
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.md) + 88 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.section}>Add address</Text>
        <TextInput
          value={house}
          onChangeText={setHouse}
          style={styles.input}
          placeholder={ADDRESS_FIELD_COPY.house}
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          value={area}
          onChangeText={setArea}
          style={styles.input}
          placeholder={ADDRESS_FIELD_COPY.area}
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          value={landmark}
          onChangeText={setLandmark}
          style={styles.input}
          placeholder={ADDRESS_FIELD_COPY.landmark}
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          value={pincode}
          onChangeText={setPincode}
          style={styles.input}
          keyboardType="number-pad"
          maxLength={6}
          placeholder={ADDRESS_FIELD_COPY.pincode}
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          value={stateName}
          editable={false}
          style={[styles.input, styles.readonly]}
          placeholder={ADDRESS_FIELD_COPY.state}
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.section}>{ADDRESS_FIELD_COPY.label}</Text>
        <View style={styles.chips}>
          {ADDRESS_LABELS.map((item) => (
            <Chip
              key={item.value}
              active={label === item.value}
              title={item.label}
              icon={LABEL_ICONS[item.value]}
              onPress={() => setLabel(item.value)}
            />
          ))}
        </View>

        <Text style={styles.section}>{ADDRESS_FIELD_COPY.receiver}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholder={ADDRESS_FIELD_COPY.receiverName}
          placeholderTextColor={colors.textMuted}
          autoComplete="name"
        />
        <View style={styles.phoneRow}>
          <Text style={styles.prefix}>+91</Text>
          <TextInput
            value={phoneDigits}
            onChangeText={setMobile}
            style={styles.phoneInput}
            keyboardType="phone-pad"
            maxLength={10}
            placeholder={ADDRESS_FIELD_COPY.receiverPhone}
            placeholderTextColor={colors.textMuted}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md }]}>
        <PrimaryButton
          label={saving ? 'Saving…' : 'Save Address'}
          disabled={saving || !canSave}
          onPress={onSave}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Chip({
  active,
  title,
  icon,
  onPress,
}: {
  active: boolean;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]} accessibilityRole="button">
      <Ionicons name={icon} size={16} color={active ? colors.primaryDark : colors.textMuted} />
      <Text style={[styles.chipLabel, active && styles.chipLabelOn]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  section: {
    marginTop: spacing.sm,
    marginBottom: 4,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  readonly: {
    backgroundColor: '#FAFAFA',
    color: colors.textMuted,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
  },
  prefix: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    paddingRight: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    marginRight: spacing.sm,
    paddingVertical: 14,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 14,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  chipLabelOn: {
    color: colors.primaryDark,
  },
  error: {
    fontSize: 15,
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
