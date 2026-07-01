import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '@/constants/theme';
import { useRuntimeTheme } from '@/context/RuntimeThemeContext';
import { ONBOARDED_KEY } from '@/constants/storage';
import { IcoLogo, IcoArrow } from '@/components/Icons';

const { width: W } = Dimensions.get('window');

const SLIDES = [
  {
    step: '01',
    eyebrow: 'Comece aqui',
    title: 'Toda a rede\nem um app',
    body: 'Veja o status do Metrô e da CPTM em tempo real, direto da fonte oficial.',
    accent: theme.accent,
  },
  {
    step: '02',
    eyebrow: 'Sem surpresa',
    title: 'Alertas antes\nde você sair',
    body: 'Receba avisos quando uma linha estiver lenta, com atenção ou parada.',
    accent: theme.accent2,
  },
  {
    step: '03',
    eyebrow: 'Memória da rotina',
    title: 'Histórico de\ntoda a rede',
    body: 'Acompanhe a linha do tempo das ocorrências do dia.',
    accent: theme.accent3,
  },
];

export default function OnboardingScreen() {
  const { rt } = useRuntimeTheme();
  const [step, setStep] = useState(0);
  const s = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  async function finish() {
    await AsyncStorage.setItem(ONBOARDED_KEY, '1');
    router.replace('/(tabs)');
  }

  function advance() {
    if (isLast) {
      finish();
    } else {
      setStep(step + 1);
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rt.bg }]}>
      {/* radial accent glow */}
      <View style={[styles.glow, { backgroundColor: `${s.accent}1a` }]} />

      {/* logo */}
      <View style={styles.header}>
        <IcoLogo size={26} color={s.accent} />
        <Text style={[styles.brandName, { color: rt.text }]}>SPMove</Text>
      </View>

      {/* hero text area — poster layout: content anchored to bottom */}
      <View style={styles.hero}>
        {/* step counter */}
        <Text style={[styles.stepLabel, { color: s.accent }]}>
          {s.step} / 03 — {s.eyebrow.toUpperCase()}
        </Text>

        {/* big poster title */}
        <Text style={[styles.title, { color: rt.text }]}>{s.title}</Text>

        {/* body */}
        <Text style={[styles.body, { color: rt.textDim }]}>{s.body}</Text>
      </View>

      {/* footer */}
      <View style={styles.footer}>
        {/* progress bars */}
        <View style={styles.progress}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressBar,
                {
                  flex: i === step ? 2 : 1,
                  backgroundColor: i === step ? s.accent : rt.border,
                },
              ]}
            />
          ))}
        </View>

        {/* advance button */}
        <Pressable
          onPress={advance}
          style={({ pressed }) => [
            styles.advanceBtn,
            { backgroundColor: s.accent, opacity: pressed ? 0.8 : 1 },
          ]}>
          <Text style={[styles.advanceBtnText, { color: rt.onAccent }]}>
            {isLast ? 'ENTRAR' : 'AVANÇAR'}
          </Text>
          <IcoArrow size={16} color={rt.onAccent} strokeWidth={2.4} />
        </Pressable>

        {/* skip */}
        {!isLast && (
          <Pressable onPress={finish} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: rt.textFaint }]}>Pular</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  glow: {
    position: 'absolute',
    top: -W * 0.3,
    left: -W * 0.1,
    width: W * 0.9,
    height: W * 0.9,
    borderRadius: W * 0.45,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 0,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  hero: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
    paddingBottom: 32,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    lineHeight: 44,
    letterSpacing: -1.5,
    marginBottom: 18,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 280,
  },
  footer: {
    paddingHorizontal: 22,
    paddingBottom: 32,
    gap: 0,
  },
  progress: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
  },
  progressBar: {
    height: 3,
  },
  advanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 0, // bold: sem radius
  },
  advanceBtnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  skipBtn: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
