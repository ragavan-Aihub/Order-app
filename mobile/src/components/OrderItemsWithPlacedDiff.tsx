import { StyleSheet, Text, View } from 'react-native';

import {
  buildOrderDiffTableRows,
  orderDiffHasChanges,
  orderLineKey,
  type OrderDiffRowKind,
  type OrderDiffTableRow,
} from '@/order-modifications/diff';
import type { CustomerAdminOrderDiff } from '@/order-modifications/shop-modified';
import { formatPrice } from '@/utils/format';
import { colors, radius, spacing } from '@/config/theme';

const STATUS_LABEL: Record<OrderDiffRowKind, string | null> = {
  unchanged: null,
  added: 'New',
  removed: 'Removed',
  qty_changed: 'Qty updated',
};

function rowStyle(kind: OrderDiffRowKind) {
  switch (kind) {
    case 'added':
      return { bar: '#10B981', bg: '#ECFDF5' };
    case 'removed':
      return { bar: '#78716C', bg: '#F5F5F4' };
    case 'qty_changed':
      return { bar: '#F59E0B', bg: '#FFFBEB' };
    default:
      return { bar: 'transparent', bg: 'transparent' };
  }
}

function mergeDisplayRows(
  diffRows: OrderDiffTableRow[],
  currentByKey: Map<string, CustomerAdminOrderDiff['current'][number]>,
): Array<OrderDiffTableRow & { displaySubtotal: number; displayQty: number; displayUnit: number }> {
  return diffRows.map((row) => {
    const live = currentByKey.get(row.rowKey);
    return {
      ...row,
      displayQty: live?.quantity ?? row.quantity,
      displayUnit: live?.product_price ?? row.unitPrice,
      displaySubtotal: live?.subtotal ?? row.subtotal,
    };
  });
}

export function OrderItemsWithPlacedDiff({ diff }: { diff: CustomerAdminOrderDiff }) {
  const diffRows = buildOrderDiffTableRows(diff.placed, diff.adminCompare);
  const showDiff = orderDiffHasChanges(diffRows);
  const currentByKey = new Map(diff.current.map((line) => [orderLineKey(line), line]));
  const rows = mergeDisplayRows(diffRows, currentByKey);

  if (!showDiff) {
    return null;
  }

  return (
    <>
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Changes by the shop</Text>
        <View style={styles.legendRow}>
          <LegendDot color="#10B981" label="New" />
          <LegendDot color="#F59E0B" label="Qty updated" />
          <LegendDot color="#78716C" label="Removed" />
        </View>
      </View>

      {rows.map((row) => {
        const tone = rowStyle(row.kind);
        const removed = row.kind === 'removed';
        const label = STATUS_LABEL[row.kind];
        return (
          <View
            key={row.rowKey}
            style={[
              styles.itemRow,
              { backgroundColor: tone.bg, borderLeftColor: tone.bar },
              tone.bar !== 'transparent' && styles.itemRowMarked,
            ]}
          >
            <View style={styles.itemCopy}>
              {label ? (
                <Text style={[styles.statusChip, chipStyle(row.kind)]}>{label}</Text>
              ) : null}
              <Text
                style={[styles.itemName, removed && styles.removedText]}
                numberOfLines={2}
              >
                {row.productName}
              </Text>
              {!removed ? (
                <Text style={styles.itemQty}>
                  {row.kind === 'qty_changed' && row.placedQuantity != null ? (
                    <>
                      × {row.displayQty}{' '}
                      <Text style={styles.qtyWas}>was {row.placedQuantity}</Text>
                    </>
                  ) : (
                    `× ${row.displayQty}`
                  )}
                </Text>
              ) : (
                <Text style={[styles.itemQty, styles.removedText]}>× {row.quantity}</Text>
              )}
            </View>
            <Text style={[styles.itemPrice, removed && styles.removedText]}>
              {formatPrice(removed ? (row.placedSubtotal ?? row.subtotal) : row.displaySubtotal)}
            </Text>
          </View>
        );
      })}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <View style={styles.totalCopy}>
          {diff.placedTotal !== diff.currentTotal ? (
            <Text style={styles.totalWas}>{formatPrice(diff.placedTotal)}</Text>
          ) : null}
          <Text style={styles.totalValue}>{formatPrice(diff.currentTotal)}</Text>
        </View>
      </View>
    </>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function chipStyle(kind: OrderDiffRowKind) {
  switch (kind) {
    case 'added':
      return styles.chipAdded;
    case 'removed':
      return styles.chipRemoved;
    case 'qty_changed':
      return styles.chipQty;
    default:
      return undefined;
  }
}

const styles = StyleSheet.create({
  legend: {
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 6,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    borderLeftWidth: 4,
  },
  itemRowMarked: {
    marginHorizontal: -4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  itemCopy: {
    flex: 1,
    gap: 4,
  },
  statusChip: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  chipAdded: {
    color: '#047857',
    backgroundColor: '#D1FAE5',
  },
  chipRemoved: {
    color: '#57534E',
    backgroundColor: '#E7E5E4',
  },
  chipQty: {
    color: '#92400E',
    backgroundColor: '#FEF3C7',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  removedText: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  itemQty: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  qtyWas: {
    fontWeight: '500',
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  totalCopy: {
    alignItems: 'flex-end',
    gap: 2,
  },
  totalWas: {
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
});
