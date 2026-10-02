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
import { colors, radius, shadow, spacing } from '@/config/theme';
import { getSignedInUser } from '@/services/supabase';
import type { AddressLabel } from '@/utils/address';

export const LABEL_ICONS: Record<AddressLabel, keyof typeof Ionicons.glyphMap> = {
  home: 'home',
  work: 'briefcase',
  other: 'location',
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
  returnTo = 'cart',
}: {
  visible: boolean;
  onClose: () => void;
  returnTo?: 'cart' | 'home';
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
      router.push({ pathname: '/login', params: { next: returnTo === 'home' ? 'checkout' : 'cart' } });
      return;
    }
    router.push({ pathname: '/address/form', params: { next: returnTo } });
  }

  function onManage() {
    onClose();
    router.push('/checkout');
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel="Close address picker" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Deliver to</Text>
              <Text style={styles.subtitle}>Choose a saved address or add a new one</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            {addresses.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="location-outline" size={28} color={colors.primary} />
                <Text style={styles.emptyTitle}>No saved address yet</Text>
                <Text style={styles.empty}>Add one to start ordering.</Text>
              </View>
            ) : (
              addresses.map((item) => {
                const selected = item.id === selectedId;
                const label = (item.label === 'work' || item.label === 'other' ? item.label : 'home') as AddressLabel;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => onSelect(item.id)}
                    style={({ pressed }) => [styles.card, selected && styles.cardOn, pressed && styles.pressed]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.iconWrap, selected && styles.iconWrapOn]}>
                      <Ionicons
                        name={LABEL_ICONS[label]}
                        size={20}
                        color={selected ? colors.primaryText : colors.primaryDark}
                      />
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardName}>{savedAddressLabel(label)}</Text>
                      <Text style={styles.cardLine} numberOfLines={2}>
                        {savedAddressLine(item)}
                      </Text>
                      {item.name ? (
                        <Text style={styles.cardMeta} numberOfLines={1}>
                          {item.name}
                          {item.mobile ? ` · ${item.mobile}` : ''}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={selected ? colors.primary : colors.border}
                    />
                  </Pressable>
                );
              })
            )}

            {addresses.length < MAX_SAVED_ADDRESSES ? (
              <Pressable
                style={({ pressed }) => [styles.addNew, pressed && styles.pressed]}
                onPress={onAddNew}
                accessibilityRole="button"
              >
                <Ionicons name="add-circle" size={22} color={colors.primary} />
                <Text style={styles.addNewLabel}>Add new address</Text>
              </Pressable>
            ) : (
              <Text style={styles.limit}>You can save up to 3 addresses. Delete one to add another.</Text>
            )}

            {addresses.length > 0 ? (
              <Pressable onPress={onManage} style={styles.manage} accessibilityRole="button">
                <Text style={styles.manageLabel}>Manage saved addresses</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
            ) : null}
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
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textMuted,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: radius.md,
    padding: spacing.sm,
    ...shadow.sm,
  },
  cardOn: {
    borderColor: colors.primary,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOn: {
    backgroundColor: colors.primary,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  cardLine: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  cardMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  addNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
  },
  addNewLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  manage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
  },
  manageLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  limit: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  emptyTitle: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  empty: {
    fontSize: 14,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.88,
  },
});
