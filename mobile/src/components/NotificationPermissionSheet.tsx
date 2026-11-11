import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { AppDialog } from '@/components/AppDialog';
import { colors, radius, spacing } from '@/config/theme';
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
  return (
    <AppDialog
      visible={visible}
      title={notificationsPermissionCopy.title}
      message={notificationsPermissionCopy.subtitle}
      icon="notifications"
      onClose={onNotNow}
      actions={[
        { label: notificationsPermissionCopy.allow, onPress: onAllow, busy },
        { label: notificationsPermissionCopy.notNow, variant: 'secondary', onPress: onNotNow },
      ]}
    >
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
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  bulletList: {
    alignSelf: 'stretch',
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
});
