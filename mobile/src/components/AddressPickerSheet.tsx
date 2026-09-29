import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MAX_SAVED_ADDRESSES,
  formatSavedAddressLabel,
  formatSavedAddressLine,
  getSelectedAddress,
  getAddressBook,
  loadAddressBook,
  selectAddress,
  subscribeAddressBook,
  type SavedAddress,
} from '@/cart/address-book';
import { colors, radius, spacing } from '@/config/theme';
import { getSignedInUser } from '@/services/supabase';
import type { AddressLabel } from '@/utils/address';

const LABEL_ICONS: Record<AddressLabel, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  work: 'briefcase-outline',
  other: 'location-outline',
};

export function savedAddressLabel(label?: AddressLabel) {
  return formatSavedAddressLabel(label);
}

export function savedAddressLine(item: SavedAddress) {
  return formatSavedAddressLine(item);
}

export function AddressPickerSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const list = await loadAddressBook();
    setAddresses(list);
    setSelectedId(getSelectedAddress()?.id ?? list[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }
    reload().catch(() => undefined);
    return subscribeAddressBook(() => {
      const list = getAddressBook();
      setAddresses(list);
      setSelectedId(getSelectedAddress()?.id ?? list[0]?.id ?? null);
    });
  }, [reload, visible]);

  async function onSelect(id: string) {
    setSelectedId(id);
    await selectAddress(id);
    onClose();
  }

  async function onAddNew() {
    onClose();
    const user = await getSignedInUser();
    if (!user) {
      router.push({ pathname: '/login', params: { next: 'cart' } });
      return;
    }
    router.push({ pathname: '/address/form', params: { next: 'cart' } });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel="Close address picker" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Address</Text>
            <Pressable
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            {addresses.length < MAX_SAVED_ADDRESSES ? (
              <Pressable style={styles.addNew} onPress={onAddNew} accessibilityRole="button">
                <Text style={styles.addNewLabel}>+ Add New Address</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </Pressable>
            ) : (
              <Text style={styles.limit}>Maximum 3 addresses. Delete one to add another.</Text>
            )}
            <Text style={styles.kicker}>Saved Addresses</Text>
            {addresses.length === 0 ? (
              <Text style={styles.empty}>No saved address yet. Add one to continue.</Text>
            ) : (
              addresses.map((item) => {
                const selected = item.id === selectedId;
                const label = (item.label === 'work' || item.label === 'other' ? item.label : 'home') as AddressLabel;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => onSelect(item.id)}
                    style={[styles.card, selected && styles.cardOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View style={styles.iconWrap}>
                      <Ionicons name={LABEL_ICONS[label]} size={22} color={colors.primaryDark} />
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.nameRow}>
                        <Text style={styles.cardName}>{savedAddressLabel(label)}</Text>
                        {selected ? <Text style={styles.badge}>Selected</Text> : null}
                      </View>
                      <Text style={styles.cardLine} numberOfLines={3}>
                        {savedAddressLine(item)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 27, 0.45)',
    justifyContent: 'flex-end',
  },
  dismiss: {
    flex: 1,
  },
  sheet: {
    maxHeight: '86%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  addNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addNewLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  limit: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  empty: {
    fontSize: 15,
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
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  cardName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  badge: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.success,
    backgroundColor: '#DCFCE7',
    overflow: 'hidden',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cardLine: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
});
