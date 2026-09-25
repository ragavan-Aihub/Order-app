import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, spacing } from '@/config/theme';
import { OFFLINE_MESSAGE, OFFLINE_TITLE } from '@/services/network';

function WifiOfflineMark() {
  return (
    <View style={mark.wrap} accessibilityElementsHidden>
      <View style={[mark.bar, mark.barLarge]} />
      <View style={[mark.bar, mark.barMid]} />
      <View style={[mark.bar, mark.barSmall]} />
      <View style={mark.dot} />
    </View>
  );
}

export function OfflineScreen({
  onReload,
  reloading = false,
}: {
  onReload: () => void;
  reloading?: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing.lg) },
      ]}
    >
      <View style={styles.body}>
        <WifiOfflineMark />
        <Text style={styles.title}>{OFFLINE_TITLE}</Text>
        <Text style={styles.message}>{OFFLINE_MESSAGE}</Text>
        <PrimaryButton
          label={reloading ? 'Checking…' : 'Reload'}
          disabled={reloading}
          onPress={onReload}
        />
      </View>
    </View>
  );
}

const mark = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.lg,
  },
  bar: {
    backgroundColor: '#F5C518',
    borderRadius: 999,
  },
  barLarge: {
    width: 120,
    height: 18,
    transform: [{ rotate: '-8deg' }],
  },
  barMid: {
    width: 78,
    height: 16,
    transform: [{ rotate: '-4deg' }],
  },
  barSmall: {
    width: 42,
    height: 14,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E11D48',
    marginTop: 6,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  body: {
    alignItems: 'stretch',
    gap: spacing.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
