import { BACKEND_URL, BACKEND_KEY } from './auth';

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC_KEY)
    return null;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

function webHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(BACKEND_KEY ? { 'x-api-key': BACKEND_KEY } : {}),
  };
}

export async function registerWithBackend(enabledLines: string[]): Promise<void> {
  if (!BACKEND_URL) return;
  try {
    const sub = await getSubscription();
    if (!sub) return;
    const json = sub.toJSON();
    await fetch(`${BACKEND_URL}/api/web-push/subscribe`, {
      method: 'POST',
      headers: webHeaders(),
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, lines: enabledLines }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[web-push] registerWithBackend error:', err);
  }
}

export async function unregisterFromBackend(): Promise<void> {
  if (!BACKEND_URL || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await fetch(`${BACKEND_URL}/api/web-push/unsubscribe`, {
      method: 'POST',
      headers: webHeaders(),
      body: JSON.stringify({ endpoint }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[web-push] unregisterFromBackend error:', err);
  }
}
