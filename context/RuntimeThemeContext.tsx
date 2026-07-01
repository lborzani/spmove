import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { theme as greenTheme, charcoalTheme, type AppRuntimeTheme } from '@/constants/theme';
import { APP_THEMES, type AppTheme, type AppThemeId } from '@/constants/appThemes';
import { getAppTheme, setAppTheme } from '@/constants/themePrefs';

interface RuntimeThemeContextValue {
  rt: AppRuntimeTheme;
  selectedThemeId: AppThemeId;
  setSelectedTheme: (id: AppThemeId) => Promise<void>;
  staticTheme: AppTheme | null;
}

const RuntimeThemeContext = createContext<RuntimeThemeContextValue>({
  rt: greenTheme,
  selectedThemeId: 'dinamico',
  setSelectedTheme: async () => {},
  staticTheme: null,
});

function buildRuntimeTheme(staticTheme: AppTheme | null): AppRuntimeTheme {
  if (!staticTheme) return greenTheme;
  return {
    ...charcoalTheme,
    accent: staticTheme.text,
    accent2: staticTheme.text,
    accent3: staticTheme.text,
    accentSoft: `${staticTheme.text}30`,
    onAccent: staticTheme.bg,
    chipActive: staticTheme.text,
    onChipActive: staticTheme.bg,
  };
}

export function RuntimeThemeProvider({ children }: { children: React.ReactNode }) {
  const [selectedThemeId, setSelectedThemeId] = useState<AppThemeId>('dinamico');

  useEffect(() => {
    getAppTheme().then(setSelectedThemeId);
  }, []);

  const setSelectedTheme = useCallback(async (id: AppThemeId) => {
    setSelectedThemeId(id);
    await setAppTheme(id);
  }, []);

  const staticTheme = APP_THEMES.find((t) => t.id === selectedThemeId && !t.isDynamic) ?? null;
  const rt = buildRuntimeTheme(staticTheme);

  return (
    <RuntimeThemeContext.Provider value={{ rt, selectedThemeId, setSelectedTheme, staticTheme }}>
      {children}
    </RuntimeThemeContext.Provider>
  );
}

export function useRuntimeTheme() {
  return useContext(RuntimeThemeContext);
}
