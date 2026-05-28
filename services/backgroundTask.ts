import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { fetchStatus, fetchOcorrencias, todayISO, daysAgoISO } from './api';
import { STATUS_META } from '@/constants/theme';
import {
  getGlobalEnabled, getLineEnabled,
  getPrevStatus, savePrevStatus,
  getPrevOcorrIds, savePrevOcorrIds,
} from '@/constants/notifPrefs';
import { scheduleNotification } from './notifications';

export const BG_TASK = 'linha-status-check';

try { TaskManager.defineTask(BG_TASK, async () => {
  try {
    const globalEnabled = await getGlobalEnabled();
    if (!globalEnabled) return BackgroundTask.BackgroundTaskResult.Failed;

    // ── Mudanças de status ──────────────────────────────────────────
    const lines      = await fetchStatus();
    const prevStatus = await getPrevStatus();
    const currStatus: Record<string, string> = {};

    for (const line of lines) {
      currStatus[line.num] = line.status;
      if (
        prevStatus &&
        prevStatus[line.num] !== undefined &&
        prevStatus[line.num] !== line.status
      ) {
        const enabled = await getLineEnabled(line.num);
        if (!enabled) continue;
        const meta = STATUS_META[line.status];
        await scheduleNotification(
          `Linha ${line.num} · ${line.name}`,
          line.note || meta.label,
          { lineNum: line.num },
        );
      }
    }
    await savePrevStatus(currStatus);

    // ── Novas ocorrências ───────────────────────────────────────────
    const ocorrs    = await fetchOcorrencias(daysAgoISO(1), todayISO());
    const prevIds   = await getPrevOcorrIds();
    const prevSet   = new Set(prevIds);
    const newOcorrs = ocorrs.filter(
      (o) => !prevSet.has(o.id) && (o.severity === 'critico' || o.severity === 'aviso'),
    );

    for (const o of newOcorrs) {
      const enabled = await getLineEnabled(o.lineCode);
      if (!enabled) continue;
      await scheduleNotification(
        `Linha ${o.lineCode} · ${o.lineName}`,
        o.descricao || o.situacao,
        { lineNum: o.lineCode },
      );
    }
    await savePrevOcorrIds(ocorrs.map((o) => o.id));

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
}); } catch { /* not available in Expo Go */ }

export async function registerBackgroundTask() {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_TASK);
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(BG_TASK, {
        minimumInterval: 15, // minutes — enforced minimum by OS
      });
    }
  } catch { /* silently skip if permissions not yet granted */ }
}
