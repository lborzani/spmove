import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { BACKEND_URL, authHeaders } from './auth';

async function getExpoPushToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    // eslint-disable-next-line no-console
    console.warn('[push] projectId not found in app config');
    return null;
  }
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[push] getExpoPushToken error:', err);
    return null;
  }
}

export async function registerWithBackend(enabledLines: string[]): Promise<void> {
  if (!BACKEND_URL) {
    // eslint-disable-next-line no-console
    console.warn('[push] EXPO_PUBLIC_BACKEND_URL not set');
    return;
  }

  const token = await getExpoPushToken();
  if (!token) return;

  try {
    const res = await fetch(`${BACKEND_URL}/api/register`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ token, lines: enabledLines }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[push] registerWithBackend error:', err);
  }
}

export async function unregisterFromBackend(): Promise<void> {
  if (!BACKEND_URL) return;

  const token = await getExpoPushToken();
  if (!token) return;

  try {
    await fetch(`${BACKEND_URL}/api/unregister`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[push] unregisterFromBackend error:', err);
  }
}
