import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useQuery } from '@tanstack/react-query';
import { theme } from '@/constants/theme';
import { fetchStatus, LINE_META } from '@/services/api';
import type { Line } from '@/constants/data';
import { LineBadge } from '@/components/LineBadge';
import { IcoArrowLeft } from '@/components/Icons';
import {
  getGlobalEnabled, setGlobalEnabled,
  getLineEnabled, setLineEnabled,
  getAllLinePrefs,
} from '@/constants/notifPrefs';
import { requestNotificationPermissions } from '@/services/notifications';
import { registerBackgroundTask } from '@/services/backgroundTask';

function LineGroup({
  title,
  lines,
  prefs,
  onToggle,
}: {
  title: string;
  lines: Line[];
  prefs: Record<string, boolean>;
  onToggle: (num: string, val: boolean) => void;
}) {
  if (lines.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {lines.map((l) => (
        <View key={l.num} style={styles.row}>
          <LineBadge line={l} size={36} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>{l.name}</Text>
            <Text style={styles.rowSub}>{l.net} · Linha {l.num}</Text>
          </View>
          <Switch
            value={prefs[l.num] ?? true}
            onValueChange={(val) => onToggle(l.num, val)}
            trackColor={{ false: theme.surface, true: `${theme.accent}55` }}
            thumbColor={prefs[l.num] ?? true ? theme.accent : theme.textFaint}
          />
        </View>
      ))}
    </View>
  );
}

export default function SettingsScreen() {
  const { data: lines, isLoading } = useQuery({
    queryKey: ['status'],
    queryFn: fetchStatus,
    staleTime: 5 * 60 * 1000,
  });

  const [globalEnabled, setGlobal]   = useState(false);
  const [linePrefs, setLinePrefs]     = useState<Record<string, boolean>>({});
  const [permGranted, setPermGranted] = useState(false);
  const [loaded, setLoaded]           = useState(false);

  useEffect(() => {
    (async () => {
      const [global, { status }] = await Promise.all([
        getGlobalEnabled(),
        Notifications.getPermissionsAsync(),
      ]);
      const prefs = await getAllLinePrefs(Object.keys(LINE_META));
      setGlobal(global);
      setPermGranted(status === 'granted');
      setLinePrefs(prefs);
      setLoaded(true);
    })();
  }, []);

  const handleGlobalToggle = useCallback(async (val: boolean) => {
    if (val && !permGranted) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          'Permissão negada',
          'Ative as notificações nas configurações do sistema para este aplicativo.',
        );
        return;
      }
      setPermGranted(true);
      await registerBackgroundTask();
    }
    setGlobal(val);
    await setGlobalEnabled(val);
  }, [permGranted]);

  const handleLineToggle = useCallback(async (num: string, val: boolean) => {
    setLinePrefs((prev) => ({ ...prev, [num]: val }));
    await setLineEnabled(num, val);
  }, []);

  const metro = (lines ?? []).filter((l) => l.net === 'Metrô');
  const cptm  = (lines ?? []).filter((l) => l.net === 'CPTM');

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IcoArrowLeft size={18} color={theme.text} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.title}>Configurações</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTIFICAÇÕES</Text>
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>Ativar notificações</Text>
              <Text style={styles.rowSub}>Mudanças de status e ocorrências</Text>
            </View>
            <Switch
              value={loaded && globalEnabled}
              onValueChange={handleGlobalToggle}
              trackColor={{ false: theme.surface, true: `${theme.accent}55` }}
              thumbColor={loaded && globalEnabled ? theme.accent : theme.textFaint}
            />
          </View>
          {loaded && !permGranted && globalEnabled && (
            <Text style={styles.permWarning}>
              Permissão do sistema não concedida. Acesse as configurações do aparelho.
            </Text>
          )}
        </View>

        {globalEnabled && loaded && (
          isLoading ? (
            <View style={styles.loadingLines}>
              <ActivityIndicator size="small" color={theme.accent} />
            </View>
          ) : (
            <>
              <LineGroup title="METRÔ" lines={metro} prefs={linePrefs} onToggle={handleLineToggle} />
              <LineGroup title="CPTM"  lines={cptm}  prefs={linePrefs} onToggle={handleLineToggle} />
            </>
          )
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            As notificações dependem de busca em segundo plano. O intervalo mínimo
            é definido pelo sistema operacional (geralmente 15 min no iOS).
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: theme.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },

  content: { paddingBottom: 40 },

  section: { paddingHorizontal: 18, paddingTop: 22 },
  sectionTitle: {
    color: theme.textDim, fontSize: 11, letterSpacing: 1.5,
    textTransform: 'uppercase', fontWeight: '600', marginBottom: 10,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: theme.radiusCard, padding: 12, marginBottom: 6,
  },
  rowInfo:  { flex: 1, minWidth: 0 },
  rowLabel: { color: theme.text, fontSize: 14, fontWeight: '600' },
  rowSub:   { color: theme.textDim, fontSize: 11, marginTop: 1 },

  permWarning: {
    color: theme.textDim, fontSize: 11.5, marginTop: 8,
    paddingHorizontal: 4, lineHeight: 16,
  },

  loadingLines: { padding: 24, alignItems: 'center' },

  footer: { paddingHorizontal: 22, paddingTop: 28 },
  footerText: {
    color: theme.textFaint, fontSize: 11, lineHeight: 16, letterSpacing: 0.1,
  },
});
