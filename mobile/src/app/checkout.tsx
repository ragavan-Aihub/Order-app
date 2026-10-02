import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MAX_SAVED_ADDRESSES,
  deleteAddress,
  formatSavedAddressLabel,
  formatSavedAddressLine,
  getAddressBook,
  getSelectedAddress,
  loadAddressBook,
  selectAddress,
  subscribeAddressBook,
  type SavedAddress,
} from '@/cart/address-book';
import { LABEL_ICONS } from '@/components/AddressPickerSheet';
import { OfflineBanner } from '@/components/OfflineBanner';
import { colors, radius, shadow, spacing } from '@/config/theme';
import { useNetworkStatus } from '@/network/NetworkProvider';
import { getSignedInUser } from '@/services/supabase';
import type { AddressLabel } from '@/utils/address';

export default function SavedAddressesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { offline } = useNetworkStatus();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => addresses.find((item) => item.id === selectedId) ?? addresses[0] ?? null,
    [addresses, selectedId],
  );

  const reload = useCallback(async () => {
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

  function onDelete(id: string) {
    Alert.alert('Delete address', 'Remove this address from your saved addresses?', [
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
    setSelectedId(id);
    await selectAddress(id);
  }

  async function onAddNew() {
    const user = await getSignedInUser();
    if (!user) {
      router.push({ pathname: '/login', params: { next: 'checkout' } });
      return;
    }
    router.push('/address/form');
  }

  const canAdd = addresses.length < MAX_SAVED_ADDRESSES;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg }]}
      >
        {offline ? <OfflineBanner /> : null}

        {canAdd ? (
          <Pressable
            style={({ pressed }) => [styles.addNew, pressed && styles.pressed]}
            onPress={() => onAddNew().catch(() => undefined)}
            accessibilityRole="button"
          >
            <View style={styles.addIcon}>
              <Ionicons name="add" size={20} color={colors.primaryText} />
            </View>
            <View style={styles.addCopy}>
              <Text style={styles.addNewLabel}>Add new address</Text>
              <Text style={styles.addNewHint}>
                {addresses.length} of {MAX_SAVED_ADDRESSES} saved
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={styles.limitCard}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            <Text style={styles.limit}>You can save up to 3 addresses. Delete one to add another.</Text>
          </View>
        )}

        {addresses.length > 0 ? <Text style={styles.kicker}>Saved addresses</Text> : null}

        {addresses.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="location-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No saved address yet</Text>
            <Text style={styles.muted}>Add your delivery address to start ordering.</Text>
          </View>
        ) : (
          addresses.map((item) => {
            const isSelected = item.id === selected?.id;
            const label = (item.label === 'work' || item.label === 'other' ? item.label : 'home') as AddressLabel;
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item.id)}
                style={({ pressed }) => [styles.card, isSelected && styles.cardOn, pressed && styles.pressed]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${formatSavedAddressLabel(label)} address`}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, isSelected && styles.iconWrapOn]}>
                    <Ionicons
                      name={LABEL_ICONS[label]}
                      size={20}
                      color={isSelected ? colors.primaryText : colors.primaryDark}
                    />
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cardName}>{formatSavedAddressLabel(label)}</Text>
                      {isSelected ? (
                        <View style={styles.defaultPill}>
                          <Text style={styles.defaultPillLabel}>Default</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.cardLine} numberOfLines={3}>
                      {formatSavedAddressLine(item)}
                    </Text>
                    <View style={styles.metaRow}>
                      <Ionicons name="person-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.meta} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Ionicons name="call-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.meta}>{item.mobile}</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={isSelected ? colors.primary : colors.border}
                  />
                </View>
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/address/form', params: { id: item.id } })}
                    style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Edit address"
                  >
                    <Ionicons name="create-outline" size={16} color={colors.primaryDark} />
                    <Text style={styles.actionLabel}>Edit</Text>
                  </Pressable>
                  <View style={styles.actionDivider} />
                  <Pressable
                    onPress={() => onDelete(item.id)}
                    style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Delete address"
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    <Text style={[styles.actionLabel, styles.actionDanger]}>Delete</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })
        )}

        {addresses.length > 1 ? (
          <Text style={styles.footnote}>Tap an address to make it your default for new orders.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  addNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
  },
  addIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCopy: {
    flex: 1,
  },
  addNewLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  addNewHint: {
    marginTop: 1,
    fontSize: 12,
    color: colors.textMuted,
  },
  limitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  limit: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  kicker: {
    marginTop: spacing.sm,
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  muted: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow.sm,
  },
  cardOn: {
    borderColor: colors.primary,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
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
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  defaultPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  defaultPillLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  cardLine: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
    marginRight: spacing.xs,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  actionDanger: {
    color: colors.danger,
  },
  footnote: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
});
