import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'spmove_device_id';

function makeUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

let cached: string | null = null;
let pending: Promise<string> | null = null;

export function getDeviceId(): Promise<string> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;
  pending = (async () => {
    try {
      let id = await AsyncStorage.getItem(KEY);
      if (!id) {
        id = makeUUID();
        await AsyncStorage.setItem(KEY, id);
      }
      cached = id;
      return id;
    } finally {
      pending = null;
    }
  })();
  return pending;
}
