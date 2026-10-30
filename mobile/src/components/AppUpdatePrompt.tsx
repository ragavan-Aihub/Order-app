import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/config/theme';
import { refreshBusiness } from '@/services/business';
import {
  installedAndroidVersionCode,
  openAppUpdate,
  resolveAppUpdate,
  shouldCheckStoreVersion,
  updateBody,
  updateTitle,
  type AppUpdatePrompt,
} from '@/services/app-update';

const DISMISS_KEY = '@farm2flavour/dismissed_update_version_code';

export function AppUpdatePrompt() {
  const [prompt, setPrompt] = useState<AppUpdatePrompt | null>(null);

  useEffect(() => {
    if (!shouldCheckStoreVersion()) {
      return;
    }
    let cancelled = false;
    (async () => {
      const business = await refreshBusiness();
      const next = resolveAppUpdate(business, installedAndroidVersionCode());
      if (cancelled || next.mode === 'none') {
        return;
      }
      if (next.mode === 'optional') {
        const dismissed = await AsyncStorage.getItem(DISMISS_KEY);
        if (dismissed === String(next.latestVersionCode)) {
          return;
        }
      }
      if (!cancelled) {
        setPrompt(next);
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!prompt || prompt.mode === 'none') {
    return null;
  }

  const required = prompt.mode === 'required';

  async function onLater() {
    if (!prompt || required) {
      return;
    }
    await AsyncStorage.setItem(DISMISS_KEY, String(prompt.latestVersionCode));
    setPrompt(null);
  }

  return (
    <Modal visible animationType="fade" transparent onRequestClose={() => void onLater()}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{updateTitle(prompt)}</Text>
          <Text style={styles.body}>{updateBody(prompt)}</Text>
          <Pressable
            onPress={() => void openAppUpdate(prompt.url)}
            style={styles.primary}
            accessibilityRole="button"
          >
            <Text style={styles.primaryLabel}>Update</Text>
          </Pressable>
          {required ? null : (
            <Pressable onPress={() => void onLater()} style={styles.secondary} accessibilityRole="button">
              <Text style={styles.secondaryLabel}>Later</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 27, 0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
  secondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: '600',
  },
});
