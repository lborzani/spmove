export function setupNotificationHandler() {}
export async function setupAndroidChannel() {}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  if (Notification.permission === 'granted') {
    await registerSW();
    return true;
  }
  const result = await Notification.requestPermission();
  if (result === 'granted') await registerSW();
  return result === 'granted';
}

export async function scheduleNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/icon-512.png' });
}

async function registerSW() {
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[sw] registration failed:', err);
  }
}
