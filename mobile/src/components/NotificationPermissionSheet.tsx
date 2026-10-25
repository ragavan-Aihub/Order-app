import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing } from '@/config/theme';
import { notificationsPermissionCopy } from '@/copy/notifications-permission';

export function NotificationPermissionSheet({
  visible,
  busy,
  onAllow,
  onNotNow,
}: {
  visible: boolean;
  busy?: boolean;
  onAllow: () => void;
  onNotNow: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onNotNow}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismiss} onPress={onNotNow} accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <View style={styles.heroWrap}>
              <View style={styles.heroIcon}>
                <Ionicons name="notifications" size={28} color={colors.primaryDark} />
              </View>
              <View style={styles.sparkA} />
              <View style={styles.sparkB} />
            </View>
            <Text style={styles.title}>{notificationsPermissionCopy.title}</Text>
            <Text style={styles.subtitle}>{notificationsPermissionCopy.subtitle}</Text>
          </View>

          <View style={styles.bulletList}>
            {notificationsPermissionCopy.bullets.map((item) => (
              <View key={item.title} style={[styles.bulletCard, { backgroundColor: item.cardBg }]}>
                <View style={[styles.bulletIcon, { backgroundColor: item.iconBg }]}>
                  {'iconSet' in item && item.iconSet === 'material-community' ? (
                    <MaterialCommunityIcons name={item.icon} size={24} color={item.iconColor} />
                  ) : (
                    <Ionicons name={item.icon} size={22} color={item.iconColor} />
                  )}
                </View>
                <View style={styles.bulletText}>
                  <Text style={styles.bulletTitle}>{item.title}</Text>
                  <Text style={styles.bulletBody}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            onPress={onAllow}
            disabled={busy}
            style={({ pressed }) => [styles.allowBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={notificationsPermissionCopy.allow}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <Text style={styles.allowLabel}>{notificationsPermissionCopy.allow}</Text>
            )}
          </Pressable>

          <Pressable
            onPress={onNotNow}
            disabled={busy}
            style={({ pressed }) => [styles.notNowBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={notificationsPermissionCopy.notNow}
          >
            <Text style={styles.notNowLabel}>{notificationsPermissionCopy.notNow}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 27, 0.55)',
    justifyContent: 'flex-end',
  },
  dismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(15, 118, 110, 0.2)',
    ...shadow.sm,
  },
  sparkA: {
    position: 'absolute',
    top: 4,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FBBF24',
  },
  sparkB: {
    position: 'absolute',
    bottom: 10,
    left: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FDE047',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.primaryDark,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  bulletList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  bulletCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  bulletIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    flex: 1,
    gap: 2,
    paddingTop: 2,
  },
  bulletTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  bulletBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  allowBtn: {
    minHeight: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    ...shadow.md,
  },
  allowLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryText,
  },
  notNowBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  notNowLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.88,
  },
});
