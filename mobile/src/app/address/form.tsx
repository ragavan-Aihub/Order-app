import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
  type AddressLabel,
  type SavedAddress,
} from '@/cart/address-book';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, radius, spacing } from '@/config/theme';
import { getCustomerProfile } from '@/services/orders';
import { isValidIndianMobile, isValidPincode } from '@/utils/validation';

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value ?? '';
}

export default function AddressFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    locality?: string;
    pincode?: string;
    lat?: string;
    lng?: string;
  }>();
  const editingId = firstParam(params.id);
  const [house, setHouse] = useState('');
  const [locality, setLocality] = useState(firstParam(params.locality));
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [altMobile, setAltMobile] = useState('');
  const [pincode, setPincode] = useState(firstParam(params.pincode));
  const [label, setLabel] = useState<AddressLabel>('home');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCustomerProfile()
      .then((profile) => {
        if (profile?.name) {
          setName((current) => current || profile.name || '');
        }
        if (profile?.mobile) {
          setMobile((current) => current || profile.mobile || '');
        }
      })
      .catch(() => undefined);

    if (!editingId) {
      loadAddressBook().then((list) => {
        if (list.length >= MAX_SAVED_ADDRESSES) {
          router.replace('/checkout');
        }
      });
      return;
    }
    loadAddressBook().then((list) => {
      const row = list.find((item) => item.id === editingId);
      if (!row) {
        return;
      }
      setHouse(row.house ?? '');
      setLocality(row.locality ?? row.address);
      setName(row.name);
      setMobile(row.mobile);
      setAltMobile(row.altMobile ?? '');
      setPincode(row.pincode);
      setLabel(row.label ?? 'home');
    });
  }, [editingId]);

  async function onSave() {
    setError(null);
    if (!house.trim()) {
      setError('Enter flat / house / building.');
      return;
    }
    if (!locality.trim()) {
      setError('Enter area / locality.');
      return;
    }
    if (!name.trim()) {
      setError('Enter your full name.');
      return;
    }
    if (!isValidIndianMobile(mobile)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (altMobile.trim() && !isValidIndianMobile(altMobile)) {
      setError('Enter a valid alternate mobile number, or leave it blank.');
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
        mobile: mobile.trim(),
        address: `${house.trim()}, ${locality.trim()}`,
        pincode: pincode.trim(),
        house: house.trim(),
        locality: locality.trim(),
        label,
        altMobile: altMobile.trim() || undefined,
        lat: params.lat ? Number(params.lat) : undefined,
        lng: params.lng ? Number(params.lng) : undefined,
      };
      await upsertAddress(payload);
      router.replace('/checkout');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this address.');
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
        <Field label="Flat / house / building name *">
          <TextInput value={house} onChangeText={setHouse} style={styles.input} placeholder="E-204, SSPDL Crescent" placeholderTextColor={colors.textMuted} />
        </Field>
        <Field label="Area / sector / locality *">
          <TextInput
            value={locality}
            onChangeText={setLocality}
            style={[styles.input, styles.multiline]}
            multiline
            placeholder="Street, area, city"
            placeholderTextColor={colors.textMuted}
          />
        </Field>
        <Field label="Pincode *">
          <TextInput
            value={pincode}
            onChangeText={setPincode}
            style={styles.input}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="6-digit pincode"
            placeholderTextColor={colors.textMuted}
          />
        </Field>
        <Field label="Full name *">
          <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={colors.textMuted} placeholder="Recipient name" />
        </Field>
        <Field label="10-digit mobile number *">
          <TextInput
            value={mobile}
            onChangeText={setMobile}
            style={styles.input}
            keyboardType="phone-pad"
            maxLength={10}
            placeholderTextColor={colors.textMuted}
            placeholder="Mobile number"
          />
        </Field>
        <Field label="Alternate phone (optional)">
          <TextInput
            value={altMobile}
            onChangeText={setAltMobile}
            style={styles.input}
            keyboardType="phone-pad"
            maxLength={10}
            placeholderTextColor={colors.textMuted}
            placeholder="Optional"
          />
        </Field>
        <Text style={styles.label}>Type of address</Text>
        <View style={styles.chips}>
          <Chip active={label === 'home'} title="Home" onPress={() => setLabel('home')} />
          <Chip active={label === 'work'} title="Work" onPress={() => setLabel('work')} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md }]}>
        <PrimaryButton label={saving ? 'Saving…' : 'Save address'} disabled={saving} onPress={onSave} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Chip({ active, title, onPress }: { active: boolean; title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]} accessibilityRole="button">
      <Text style={[styles.chipLabel, active && styles.chipLabelOn]}>{title}</Text>
    </Pressable>
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
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
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
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
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
