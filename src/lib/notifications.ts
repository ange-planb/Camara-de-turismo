export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  const result = await Notification.requestPermission();
  return result;
}

export async function showEventNotification(title: string, body: string): Promise<void> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon: '/logo.svg',
      badge: '/logo.svg',
      tag: 'evento-camara',
      data: { url: '/eventos' },
    });
  } catch {
    new Notification(title, { body, icon: '/logo.svg' });
  }
}

export async function showReminderNotification(title: string, body: string): Promise<void> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon: '/logo.svg',
      badge: '/logo.svg',
      tag: 'recordatorio-camara',
      data: { url: '/eventos' },
    });
  } catch {
    new Notification(title, { body, icon: '/logo.svg' });
  }
}
