import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/config/theme';
import { orderStatusLabel } from '@/types/order';

function StatusGlyph({ status }: { status: string }) {
  const normalized = status === 'preparing' ? 'confirmed' : status;
  if (normalized === 'out_for_delivery') {
    return <MaterialCommunityIcons name="moped" size={15} color={colors.warning} />;
  }
  if (normalized === 'confirmed') {
    return <Ionicons name="checkmark-circle" size={15} color={colors.success} />;
  }
  if (normalized === 'new') {
    return <View style={[styles.dot, styles.dotNew]} />;
  }
  return <View style={[styles.dot, styles.dotDefault]} />;
}

export function OrderStatusBadge({ status }: { status: string }) {
  const label = orderStatusLabel(status);
  const active = status === 'out_for_delivery';
  const placed = status === 'new';

  return (
    <View style={[styles.badge, active ? styles.badgeActive : placed ? styles.badgeNew : styles.badgeDefault]}>
      <StatusGlyph status={status} />
      <Text
        style={[
          styles.label,
          active ? styles.labelActive : placed ? styles.labelNew : styles.labelDefault,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeDefault: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeActive: {
    backgroundColor: '#FFEDD5',
    borderColor: '#FDBA74',
  },
  badgeNew: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  labelNew: {
    color: '#1D4ED8',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotDefault: {
    backgroundColor: colors.success,
  },
  dotNew: {
    backgroundColor: '#1D4ED8',
  },
  dotActive: {
    backgroundColor: colors.warning,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  labelDefault: {
    color: colors.success,
  },
  labelActive: {
    color: colors.warning,
  },
});
