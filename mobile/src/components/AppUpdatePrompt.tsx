import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { AppDialog } from '@/components/AppDialog';
import { refreshBusiness } from '@/services/business';
import {
  installedAndroidVersionCode,
  openAppUpdate,
  resolveAppUpdate,
  shouldCheckStoreVersion,
  updateBody,
  updateTitle,
  type AppUpdatePrompt as AppUpdatePromptData,
} from '@/services/app-update';

const DISMISS_KEY = '@farm2flavour/dismissed_update_version_code';

export function AppUpdatePrompt() {
  const [prompt, setPrompt] = useState<AppUpdatePromptData | null>(null);

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
    <AppDialog
      visible
      title={updateTitle(prompt)}
      message={updateBody(prompt)}
      icon="cloud-download"
      dismissible={!required}
      onClose={() => void onLater()}
      actions={[
        { label: 'Update', onPress: () => void openAppUpdate(prompt.url) },
        ...(required ? [] : [{ label: 'Later', variant: 'secondary' as const, onPress: () => void onLater() }]),
      ]}
    />
  );
}
