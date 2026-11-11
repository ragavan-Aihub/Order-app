import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow, spacing } from '@/config/theme';

export type AppDialogIcon = React.ComponentProps<typeof Ionicons>['name'];

export type AppDialogTone = 'brand' | 'danger' | 'warning';

export type AppDialogAction = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
};

export function AppDialog({
  visible,
  title,
  message,
  icon = 'information-circle',
  tone = 'brand',
  actions,
  onClose,
  dismissible = true,
  children,
}: {
  visible: boolean;
  title: string;
  message?: string;
  icon?: AppDialogIcon;
  tone?: AppDialogTone;
  actions?: AppDialogAction[];
  onClose: (reason?: 'dismiss' | 'action') => void;
  dismissible?: boolean;
  children?: ReactNode;
}) {
  const buttons = actions?.length ? actions : [{ label: 'OK', variant: 'primary' as const }];
  const palette = TONE[tone];

  function dismiss() {
    onClose('dismiss');
  }

  function closeThen(action: AppDialogAction) {
    if (action.busy) {
      return;
    }
    if (action.onPress) {
      action.onPress();
      return;
    }
    onClose('action');
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={dismissible ? dismiss : undefined}>
      <View style={styles.overlay}>
        {dismissible ? (
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Dismiss" />
        ) : (
          <View style={StyleSheet.absoluteFill} />
        )}
        <View style={styles.card} accessibilityViewIsModal>
          {dismissible ? (
            <Pressable
              onPress={dismiss}
              style={styles.close}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}

          <View style={[styles.iconWell, { backgroundColor: palette.well }]}>
            <View style={[styles.iconInner, { backgroundColor: palette.inner }]}>
              <Ionicons name={icon} size={36} color={palette.icon} />
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.body}>{message}</Text> : null}
          {children}

          <View style={[styles.actions, !message && !children ? styles.actionsTight : null]}>
            {buttons.map((action) => {
              const variant = action.variant ?? 'primary';
              return (
                <Pressable
                  key={action.label}
                  onPress={() => closeThen(action)}
                  disabled={action.busy}
                  style={({ pressed }) => [
                    styles.btn,
                    variant === 'primary' && styles.btnPrimary,
                    variant === 'danger' && styles.btnDanger,
                    variant === 'secondary' && styles.btnSecondary,
                    pressed && !action.busy && styles.pressed,
                    action.busy && styles.busy,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                >
                  {action.busy ? (
                    <ActivityIndicator
                      size="small"
                      color={variant === 'secondary' ? colors.primary : colors.primaryText}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.btnLabel,
                        variant === 'secondary' ? styles.btnLabelSecondary : styles.btnLabelFilled,
                      ]}
                    >
                      {action.label}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const TONE: Record<AppDialogTone, { well: string; inner: string; icon: string }> = {
  brand: { well: colors.primarySoft, inner: '#E6FAF4', icon: colors.primary },
  danger: { well: '#FEE2E2', inner: '#FEF2F2', icon: colors.danger },
  warning: { well: '#FFEDD5', inner: '#FFF7ED', icon: colors.warning },
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 27, 0.48)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    ...shadow.card,
  },
  close: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  iconWell: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionsTight: {
    marginTop: spacing.md,
  },
  btn: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnDanger: {
    backgroundColor: colors.danger,
  },
  btnSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  btnLabel: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  btnLabelFilled: {
    color: colors.primaryText,
  },
  btnLabelSecondary: {
    color: colors.primary,
  },
  pressed: {
    opacity: 0.88,
  },
  busy: {
    opacity: 0.7,
  },
});
