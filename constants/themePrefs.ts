import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppThemeId } from './appThemes';

const KEY = '@spmove:app_theme';

export async function getAppTheme(): Promise<AppThemeId> {
  try {
    const val = await AsyncStorage.getItem(KEY);
    return (val as AppThemeId) ?? 'dinamico';
  } catch {
    return 'dinamico';
  }
}

export async function setAppTheme(id: AppThemeId): Promise<void> {
  await AsyncStorage.setItem(KEY, id);
}
