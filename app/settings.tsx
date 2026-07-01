import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Switch,
  Alert,
  Linking,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { theme } from '@/constants/theme'; // usado apenas para radiusCard
import { IcoArrowLeft } from '@/components/Icons';
import { getGlobalEnabled, setGlobalEnabled } from '@/constants/notifPrefs';
import { APP_THEMES } from '@/constants/appThemes';
import { requestNotificationPermissions, getNotifPermStatus } from '@/services/notifications';
import { registerWithBackend, unregisterFromBackend } from '@/services/pushRegistration';
import { getFavorites } from '@/constants/favPrefs';
import { useSubscription } from '@/context/SubscriptionContext';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useRuntimeTheme } from '@/context/RuntimeThemeContext';

export default function SettingsScreen() {
  const { isPremium } = useSubscription();
  const { rt, selectedThemeId: appTheme, setSelectedTheme } = useRuntimeTheme();
  const [globalEnabled, setGlobal] = useState(false);
  const [permGranted, setPermGranted] = useState(false);
  const [permBlocked, setPermBlocked] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const pwaInstall = usePWAInstall();
  const { width } = useWindowDimensions();

  useEffect(() => {
    (async () => {
      let granted = false;
      let blocked = false;
      if (Platform.OS === 'web') {
        granted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
        blocked = typeof Notification !== 'undefined' && Notification.permission === 'denied';
      } else {
        const status = await getNotifPermStatus();
        granted = status === 'granted';
        blocked = status === 'blocked';
      }
      const global = await getGlobalEnabled();
      setGlobal(global);
      setPermGranted(granted);
      setPermBlocked(blocked);
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

  const handleThemeSelect = useCallback(
    async (id: Parameters<typeof setSelectedTheme>[0]) => {
      await setSelectedTheme(id);
    },
    [setSelectedTheme],
  );

  const cardWidth = (width - 36 - 8) / 2;

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rt.bg }]}>
      <View style={[styles.header, { borderBottomColor: rt.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: rt.surface, borderColor: rt.border }]}>
          <IcoArrowLeft size={18} color={rt.text} strokeWidth={2.2} />
        </Pressable>
        <Text style={[styles.title, { color: rt.text }]}>Configurações</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: rt.textDim }]}>PREMIUM</Text>
          <Pressable
            onPress={() => router.push('/subscription' as never)}
            style={[styles.row, { backgroundColor: rt.surface, borderColor: rt.border }]}>
            <View style={styles.rowInfo}>
              <Text style={[styles.rowLabel, { color: rt.text }]}>
                {isPremium ? 'SPMove Premium ativo' : 'Remover anúncios'}
              </Text>
              <Text style={[styles.rowSub, { color: rt.textDim }]}>
                {isPremium
                  ? 'Obrigado por apoiar o projeto.'
                  : 'Assine para uma experiência sem anúncios.'}
              </Text>
            </View>
            {!isPremium && (
              <Text style={[styles.infoValue, { color: rt.accent, fontWeight: '700' }]}>
                Assinar
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: rt.textDim }]}>APARÊNCIA</Text>
          <View style={styles.themeGrid}>
            {APP_THEMES.map((t) => {
              const selected = appTheme === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => handleThemeSelect(t.id)}
                  style={[
                    styles.themeCard,
                    {
                      width: cardWidth,
                      backgroundColor: t.bg,
                      borderColor: selected ? t.text : 'transparent',
                    },
                  ]}>
                  {t.isDynamic && (
                    <View style={styles.dynamicDots}>
                      {['#4FE566', '#f5c54a', '#f08a3c', '#e64558'].map((c, i) => (
                        <View key={i} style={[styles.dynamicDot, { backgroundColor: c }]} />
                      ))}
                    </View>
                  )}
                  <View style={styles.themeCardSpacer} />
                  <Text style={[styles.themeCardName, { color: t.text }]} numberOfLines={2}>
                    {t.name}
                  </Text>
                  {selected && (
                    <View style={[styles.themeCardCheck, { borderColor: t.text }]}>
                      <Text
                        style={{ color: t.text, fontSize: 10, fontWeight: '700', lineHeight: 14 }}>
                        ✓
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: rt.textDim }]}>NOTIFICAÇÕES</Text>
          <View style={[styles.row, { backgroundColor: rt.surface, borderColor: rt.border }]}>
            <View style={styles.rowInfo}>
              <Text style={[styles.rowLabel, { color: rt.text }]}>Ativar notificações</Text>
              <Text style={[styles.rowSub, { color: rt.textDim }]}>
                Alertas de mudança de status nas linhas favoritas
              </Text>
            </View>
            <Switch
              value={loaded && globalEnabled}
              onValueChange={handleGlobalToggle}
              trackColor={{ false: rt.surface, true: `${rt.accent}55` }}
              thumbColor={loaded && globalEnabled ? rt.accent : rt.textFaint}
            />
          </View>
          {loaded &&
            !permGranted &&
            globalEnabled &&
            (permBlocked ? (
              <Pressable
                onPress={() => Linking.openSettings()}
                style={[styles.openSettingsBtn, { borderColor: rt.border }]}>
                <Text style={[styles.permWarning, { color: rt.textDim, marginBottom: 0 }]}>
                  Permissão bloqueada pelo sistema.{' '}
                </Text>
                <Text style={{ color: rt.accent, fontSize: 12, fontWeight: '600' }}>
                  Abrir configurações
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.permWarning, { color: rt.textDim }]}>
                Permissão não concedida. Toque no switch para autorizar.
              </Text>
            ))}
        </View>

        {Platform.OS === 'web' && pwaInstall.status !== 'installed' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: rt.textDim }]}>INSTALAR APP</Text>
            {pwaInstall.status === 'installable' && (
              <Pressable
                onPress={pwaInstall.prompt}
                style={[styles.installBtn, { backgroundColor: rt.accent }]}>
                <Text style={[styles.installBtnText, { color: rt.onAccent }]}>
                  Adicionar à tela inicial
                </Text>
              </Pressable>
            )}
            {pwaInstall.status === 'ios-manual' && (
              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowLabel}>Instalar no iPhone</Text>
                  <Text style={styles.rowSub}>
                    Toque em <Text style={{ fontWeight: '700' }}>Compartilhar</Text> →{' '}
                    <Text style={{ fontWeight: '700' }}>Adicionar à Tela de Início</Text>
                  </Text>
                </View>
              </View>
            )}
            {pwaInstall.status === 'unsupported' && (
              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowLabel}>Instalar app</Text>
                  <Text style={styles.rowSub}>
                    Abra no Safari (iOS) ou Chrome (Android) para instalar.
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: rt.textDim }]}>SOBRE</Text>
          <View style={[styles.infoRow, { backgroundColor: rt.surface, borderColor: rt.border }]}>
            <Text style={[styles.infoLabel, { color: rt.textDim }]}>Versão</Text>
            <Text style={[styles.infoValue, { color: rt.text }]}>{version}</Text>
          </View>
          <View
            style={[
              styles.infoRow,
              { marginBottom: 0, backgroundColor: rt.surface, borderColor: rt.border },
            ]}>
            <Text style={[styles.infoLabel, { color: rt.textDim }]}>Dados</Text>
            <Text style={[styles.infoValue, { color: rt.text }]}>ARTESP / SPTrans</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: rt.textFaint }]}>
            Notificações push são enviadas para linhas favoritas, mesmo com o app fechado.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },

  content: { paddingBottom: 40 },

  section: { paddingHorizontal: 18, paddingTop: 22 },
  sectionTitle: {
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
    borderWidth: 1,
    borderRadius: theme.radiusCard,
    padding: 12,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 11, marginTop: 1 },

  permWarning: {
    fontSize: 11.5,
    marginTop: 8,
    paddingHorizontal: 4,
    lineHeight: 16,
  },
  openSettingsBtn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: theme.radiusCard,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: theme.radiusCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
  },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '500' },

  installBtn: {
    borderRadius: theme.radiusCard,
    paddingVertical: 14,
    alignItems: 'center',
  },
  installBtnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeCard: {
    height: 90,
    borderRadius: theme.radiusCard,
    padding: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
  themeCardSpacer: { flex: 1 },
  themeCardName: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 15,
  },
  dynamicDots: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 'auto' as never,
  },
  dynamicDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  themeCardCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: { paddingHorizontal: 22, paddingTop: 28 },
  footerText: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
});
