import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing } from '@/config/theme';
import { formatOrderStatus, orderStatusTone } from '@/utils/format';

export function StatusBadge({ status }: { status: string }) {
  const tone = orderStatusTone(status);
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.label, { color: tone.fg }]}>{formatOrderStatus(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});
