import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { theme } from '@/constants/theme';
import { IcoArrowLeft } from '@/components/Icons';
import { getGlobalEnabled, setGlobalEnabled } from '@/constants/notifPrefs';
import { requestNotificationPermissions } from '@/services/notifications';
import { registerWithBackend, unregisterFromBackend } from '@/services/pushRegistration';
import { getFavorites } from '@/constants/favPrefs';

export default function SettingsScreen() {
  const [globalEnabled, setGlobal] = useState(false);
  const [permGranted, setPermGranted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [global, { status }] = await Promise.all([
        getGlobalEnabled(),
        Notifications.getPermissionsAsync(),
      ]);
      setGlobal(global);
      setPermGranted(status === 'granted');
      setLoaded(true);
    })();
  }, []);

  const handleGlobalToggle = useCallback(
    async (val: boolean) => {
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
      }
      setGlobal(val);
      await setGlobalEnabled(val);
      if (val) {
        const favorites = await getFavorites();
        registerWithBackend(favorites).catch(() => null);
      } else {
        unregisterFromBackend().catch(() => null);
      }
    },
    [permGranted],
  );

  const version = Constants.expoConfig?.version ?? '1.0.0';

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
              <Text style={styles.rowSub}>Alertas de mudança de status nas linhas favoritas</Text>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SOBRE</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Versão</Text>
            <Text style={styles.infoValue}>{version}</Text>
          </View>
          <View style={[styles.infoRow, { marginBottom: 0 }]}>
            <Text style={styles.infoLabel}>Dados</Text>
            <Text style={styles.infoValue}>ARTESP / SPTrans</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Notificações push são enviadas para linhas favoritas, mesmo com o app fechado.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: theme.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },

  content: { paddingBottom: 40 },

  section: { paddingHorizontal: 18, paddingTop: 22 },
  sectionTitle: {
    color: theme.textDim,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 10,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusCard,
    padding: 12,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowLabel: { color: theme.text, fontSize: 14, fontWeight: '600' },
  rowSub: { color: theme.textDim, fontSize: 11, marginTop: 1 },

  permWarning: {
    color: theme.textDim,
    fontSize: 11.5,
    marginTop: 8,
    paddingHorizontal: 4,
    lineHeight: 16,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
  },
  infoLabel: { color: theme.textDim, fontSize: 13 },
  infoValue: { color: theme.text, fontSize: 13, fontWeight: '500' },

  footer: { paddingHorizontal: 22, paddingTop: 28 },
  footerText: {
    color: theme.textFaint,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
});
