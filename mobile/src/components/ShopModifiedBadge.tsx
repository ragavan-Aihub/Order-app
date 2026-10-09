import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/config/theme';

export function ShopModifiedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.badge, compact && styles.badgeCompact]}>
      <Text style={[styles.label, compact && styles.labelCompact]}>Shop modified</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: '#FFEDD5',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.warning,
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: colors.warning,
    textTransform: 'uppercase',
  },
  labelCompact: {
    fontSize: 10,
  },
});
