import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing } from '@/config/theme';

type Props = {
  visible: boolean;
  variant?: 'info' | 'error';
  title: string;
  message: string;
  actionLabel?: string;
  onAction: () => void;
};

export function OrderUpdateNotice({
  visible,
  variant = 'info',
  title,
  message,
  actionLabel = 'OK',
  onAction,
}: Props) {
  const insets = useSafeAreaInsets();
  const isError = variant === 'error';
  const iconName = isError ? 'alert-circle' : 'information-circle';
  const iconColor = isError ? colors.danger : colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onAction}>
      <View style={[styles.backdrop, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={[styles.iconWrap, isError ? styles.iconWrapError : styles.iconWrapInfo]}>
            <Ionicons name={iconName} size={32} color={iconColor} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable
            onPress={onAction}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            accessibilityRole="button"
          >
            <Text style={styles.buttonLabel}>{actionLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 27, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadow.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  iconWrapInfo: {
    backgroundColor: colors.primarySoft,
  },
  iconWrapError: {
    backgroundColor: '#FEE2E2',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    marginTop: spacing.sm,
    fontSize: 16,
    lineHeight: 23,
    color: colors.textMuted,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
