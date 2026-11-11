import { useCallback, useEffect, useState } from 'react';

import {
  AppDialog,
  type AppDialogAction,
  type AppDialogIcon,
  type AppDialogTone,
} from '@/components/AppDialog';

export type ShowAppDialogOptions = {
  title: string;
  message?: string;
  icon?: AppDialogIcon;
  tone?: AppDialogTone;
  actions?: AppDialogAction[];
  dismissible?: boolean;
  onDismiss?: () => void;
};

type Presenter = (next: ShowAppDialogOptions | null) => void;

let presenter: Presenter | null = null;
const queue: ShowAppDialogOptions[] = [];

function flush() {
  presenter?.(queue[0] ?? null);
}

export function showAppDialog(options: ShowAppDialogOptions) {
  queue.push(options);
  if (queue.length === 1) {
    flush();
  }
}

export function AppDialogHost() {
  const [current, setCurrent] = useState<ShowAppDialogOptions | null>(null);

  useEffect(() => {
    presenter = setCurrent;
    flush();
    return () => {
      presenter = null;
    };
  }, []);

  const onClose = useCallback((reason?: 'dismiss' | 'action') => {
    const dismissed = queue.shift();
    if (reason !== 'action') {
      dismissed?.onDismiss?.();
    }
    flush();
  }, []);

  if (!current) {
    return null;
  }

  const actions = (current.actions?.length ? current.actions : [{ label: 'OK' }]).map((action) => ({
    ...action,
    onPress: () => {
      const dismissed = queue.shift();
      flush();
      action.onPress?.();
      void dismissed;
    },
  }));

  return (
    <AppDialog
      visible
      title={current.title}
      message={current.message}
      icon={current.icon}
      tone={current.tone}
      actions={actions}
      dismissible={current.dismissible !== false}
      onClose={onClose}
    />
  );
}
