import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  MAX_SAVED_ADDRESSES,
  formatSavedAddressLabel,
  formatSavedAddressLine,
  type SavedAddress,
} from '@/cart/address-book';
import type { AddressNewOrderRow } from '@/cart/open-cart-guard';
import { LABEL_ICONS } from '@/components/AddressPickerSheet';
import { colors, radius, shadow, spacing } from '@/config/theme';
import type { Order } from '@/types/order';
import { formatOrderNumber, formatOrderStatus } from '@/utils/format';

function AddressBlock({ address }: { address: SavedAddress }) {
  const [full, setFull] = useState(false);
  const line = formatSavedAddressLine(address);
  return (
    <View style={styles.addressBlock}>
      <View style={styles.labelRow}>
        <View style={styles.labelIcon}>
          <Ionicons name={LABEL_ICONS[address.label ?? 'home']} size={16} color={colors.primary} />
        </View>
        <Text style={styles.label}>{formatSavedAddressLabel(address.label)}</Text>
      </View>
      <Text style={styles.line} numberOfLines={full ? undefined : 2}>
        {line}
      </Text>
      {line.length > 70 ? (
        <Pressable onPress={() => setFull((open) => !open)} hitSlop={6} accessibilityRole="button">
          <Text style={styles.link}>{full ? 'Show less' : 'View full address'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ActiveOrderCard({
  row,
  onModify,
  onViewOrder,
  onSelect,
}: {
  row: AddressNewOrderRow;
  onModify: (order: Order) => void;
  onViewOrder: (order: Order) => void;
  onSelect: (address: SavedAddress) => void;
}) {
  const order = (row.blockingOrder ?? row.activeOrder) as Order;
  const editable = Boolean(row.blockingOrder);
  return (
    <View style={styles.card}>
      <AddressBlock address={row.address} />
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={18} color={colors.info} />
        <View style={styles.infoCopy}>
          <Text style={styles.infoTitle}>
            {editable
              ? 'You already have an active order going to this address.'
              : 'An order is on its way to this address.'}
          </Text>
          <Text style={styles.infoMeta}>
            Active order #{formatOrderNumber(order.order_number)} · {formatOrderStatus(order.status)}
          </Text>
        </View>
      </View>
      {editable ? (
        <>
          <Pressable
            onPress={() => onModify(order)}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="create-outline" size={18} color={colors.primaryText} />
            <Text style={styles.primaryLabel}>View / Modify order</Text>
          </Pressable>
          <Text style={styles.hint}>You can modify this order until it goes out for delivery.</Text>
        </>
      ) : (
        <>
          <Pressable
            onPress={() => onViewOrder(order)}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryLabel}>View order</Text>
          </Pressable>
          <Text style={styles.hint}>
            This order is already out for delivery, so it can no longer be modified.
          </Text>
          <Pressable
            onPress={() => onSelect(row.address)}
            style={({ pressed }) => [styles.textBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.linkInline}>Deliver a new order here</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </Pressable>
        </>
      )}
    </View>
  );
}

export function NewOrderAddressPicker({
  rows,
  loading,
  onSelect,
  onModify,
  onViewOrder,
  onAdd,
  onManage,
}: {
  rows: AddressNewOrderRow[];
  loading?: boolean;
  onSelect: (address: SavedAddress) => void;
  onModify: (order: Order) => void;
  onViewOrder: (order: Order) => void;
  onAdd: () => void;
  onManage: () => void;
}) {
  const withOrder = rows.filter((row) => row.blockingOrder || row.activeOrder);
  const free = rows.filter((row) => !row.blockingOrder && !row.activeOrder);
  const hasBlocking = rows.some((row) => row.blockingOrder);
  const canAdd = rows.length < MAX_SAVED_ADDRESSES;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Where should we deliver your new order?</Text>
      <Text style={styles.subtitle}>
        {hasBlocking
          ? 'You already have an active order. Choose another address for a separate order, or manage your existing order.'
          : 'Choose a delivery address to start your new order.'}
      </Text>

      {loading && rows.length === 0 ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}

      {withOrder.map((row) => (
        <ActiveOrderCard
          key={row.address.id}
          row={row}
          onModify={onModify}
          onViewOrder={onViewOrder}
          onSelect={onSelect}
        />
      ))}

      {free.length > 0 ? (
        <View style={styles.section}>
          {withOrder.length > 0 ? (
            <Text style={styles.sectionTitle}>Deliver new order to another address</Text>
          ) : null}
          {free.map(({ address }) => (
            <Pressable
              key={address.id}
              onPress={() => onSelect(address)}
              style={({ pressed }) => [styles.card, styles.freeCard, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Deliver to ${formatSavedAddressLabel(address.label)}`}
            >
              <View style={styles.freeCopy}>
                <AddressBlock address={address} />
              </View>
              <View style={styles.deliverHere}>
                <Text style={styles.deliverHereLabel}>Deliver here</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        {withOrder.length > 0 ? <Text style={styles.sectionTitle}>Want to place a separate order?</Text> : null}
        {canAdd ? (
          <Pressable
            onPress={onAdd}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Add new address"
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.addLabel}>Add new address</Text>
          </Pressable>
        ) : (
          <View style={styles.limitBox}>
            <Text style={styles.limitText}>
              You can save up to {MAX_SAVED_ADDRESSES} addresses. Edit one to deliver somewhere else.
            </Text>
            <Pressable onPress={onManage} hitSlop={6} accessibilityRole="button">
              <Text style={styles.linkInline}>Manage saved addresses</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.text,
  },
  subtitle: {
    marginTop: -spacing.xs,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  loader: {
    marginVertical: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.sm,
  },
  freeCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  freeCopy: {
    flex: 1,
    minWidth: 0,
  },
  addressBlock: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  labelIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  line: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    paddingLeft: 36,
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    paddingLeft: 36,
  },
  linkInline: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  infoBox: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: '#EFF6FF',
  },
  infoCopy: {
    flex: 1,
    gap: 2,
  },
  infoTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: colors.text,
  },
  infoMeta: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.info,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primaryText,
  },
  secondaryBtn: {
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  textBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    textAlign: 'center',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xs,
  },
  deliverHere: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: spacing.xs,
  },
  deliverHereLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  addBtn: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  addLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  limitBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  limitText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.85,
  },
});
