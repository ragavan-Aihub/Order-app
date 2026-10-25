export type NotificationPrepromptResult = 'granted' | 'denied';

let showPreprompt: (() => Promise<NotificationPrepromptResult>) | null = null;

export function registerNotificationPreprompt(
  handler: (() => Promise<NotificationPrepromptResult>) | null,
): void {
  showPreprompt = handler;
}

export async function requestNotificationPermissionViaPreprompt(): Promise<NotificationPrepromptResult> {
  if (showPreprompt) {
    return showPreprompt();
  }
  return 'denied';
}
