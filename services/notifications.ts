import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function setupAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('line-status', {
    name: 'Status das Linhas',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4FE566',
  });
}

export type NotifPermResult = 'granted' | 'denied' | 'blocked';

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing, canAskAgain } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  if (!canAskAgain) return false; // dialog would be suppressed by OS — caller must open Settings
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Returns detailed status so UI can react (e.g. show "open Settings" button). */
export async function getNotifPermStatus(): Promise<NotifPermResult> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (!canAskAgain) return 'blocked';
  return 'denied';
}

export async function scheduleNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data ?? {},
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: 'line-status' } : {}),
    },
    trigger: null,
  });
}
