import AsyncStorage from '@react-native-async-storage/async-storage';

const GLOBAL_KEY       = 'notif_global_enabled';
const PREV_STATUS_KEY  = 'notif_prev_status';
const PREV_OCORR_KEY   = 'notif_prev_ocorr_ids';

const lineKey = (num: string) => `notif_line_${num}`;

export async function getGlobalEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(GLOBAL_KEY);
  return val !== 'false';
}
export async function setGlobalEnabled(enabled: boolean) {
  await AsyncStorage.setItem(GLOBAL_KEY, enabled ? 'true' : 'false');
}

export async function getLineEnabled(num: string): Promise<boolean> {
  const val = await AsyncStorage.getItem(lineKey(num));
  return val !== 'false'; // default: enabled
}
export async function setLineEnabled(num: string, enabled: boolean) {
  await AsyncStorage.setItem(lineKey(num), enabled ? 'true' : 'false');
}

export async function getAllLinePrefs(nums: string[]): Promise<Record<string, boolean>> {
  const pairs = await AsyncStorage.multiGet(nums.map(lineKey));
  const result: Record<string, boolean> = {};
  for (const [k, v] of pairs) {
    result[k.replace('notif_line_', '')] = v !== 'false';
  }
  return result;
}

export async function getPrevStatus(): Promise<Record<string, string> | null> {
  const val = await AsyncStorage.getItem(PREV_STATUS_KEY);
  try { return val ? JSON.parse(val) : null; } catch { return null; }
}
export async function savePrevStatus(status: Record<string, string>) {
  await AsyncStorage.setItem(PREV_STATUS_KEY, JSON.stringify(status));
}

export async function getPrevOcorrIds(): Promise<number[]> {
  const val = await AsyncStorage.getItem(PREV_OCORR_KEY);
  try { return val ? JSON.parse(val) : []; } catch { return []; }
}
export async function savePrevOcorrIds(ids: number[]) {
  await AsyncStorage.setItem(PREV_OCORR_KEY, JSON.stringify(ids));
}
