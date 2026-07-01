import { NativeModules } from 'react-native';

import type { Line } from '@/constants/data';
import { STATUS_META } from '@/constants/theme';

export function configureAndroidWidget(
  backendUrl: string,
  apiKey: string,
  favorites: string[],
): void {
  const { WidgetModule } = NativeModules;
  if (!WidgetModule) return;
  WidgetModule.configure(backendUrl, apiKey, JSON.stringify(favorites));
  WidgetModule.scheduleRefresh();
}

export function syncLineStatusWidget(lines: Line[], favorites: Set<string>): void {
  const { WidgetModule } = NativeModules;
  if (!WidgetModule) return;

  const displayLines = favorites.size > 0 ? lines.filter((l) => favorites.has(l.num)) : lines;

  const problemCount = displayLines.filter((l) => l.status !== 'normal').length;
  const overall = displayLines.some((l) => l.status === 'parado')
    ? 'parado'
    : displayLines.some((l) => l.status === 'lento')
      ? 'lento'
      : displayLines.some((l) => l.status === 'atencao')
        ? 'atencao'
        : 'normal';

  const summary =
    problemCount === 0
      ? `${displayLines.length} linhas operando`
      : `${problemCount} com ocorrência`;

  WidgetModule.updateWidget(
    JSON.stringify(
      displayLines.map((l) => ({
        num: l.num,
        name: l.name,
        color: l.color,
        statusLabel: STATUS_META[l.status].label,
        statusColor: STATUS_META[l.status].color,
      })),
    ),
    summary,
    STATUS_META[overall].color,
  );
}
