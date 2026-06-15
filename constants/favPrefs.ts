import AsyncStorage from '@react-native-async-storage/async-storage';

const FAV_KEY = 'line_favorites';

export async function getFavorites(): Promise<string[]> {
  const val = await AsyncStorage.getItem(FAV_KEY);
  try {
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
}

export async function toggleFavorite(num: string): Promise<string[]> {
  const current = await getFavorites();
  const next = current.includes(num) ? current.filter((n) => n !== num) : [...current, num];
  await AsyncStorage.setItem(FAV_KEY, JSON.stringify(next));
  return next;
}
