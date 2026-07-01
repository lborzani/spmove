import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { theme } from '@/constants/theme';
import { useRuntimeTheme } from '@/context/RuntimeThemeContext';
import { IcoArrowLeft } from '@/components/Icons';
import { useSubscription } from '@/context/SubscriptionContext';

const BENEFITS = [
  {
    title: 'Sem anúncios',
    desc: 'Experiência limpa, sem banner de publicidade em nenhuma tela.',
  },
  {
    title: 'Suporte ao projeto',
    desc: 'Ajuda a manter o SPMove gratuito e funcionando para todos.',
  },
  {
    title: 'Dados em tempo real',
    desc: 'Acesso completo ao status de todas as linhas da rede paulista.',
  },
];

export default function SubscriptionScreen() {
  const { rt } = useRuntimeTheme();
  const { isPremium, purchasing, purchase, restore } = useSubscription();
  const [price] = useState<string | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(true);

  useEffect(() => {
    setLoadingPrice(false);
  }, []);

  if (isPremium) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: rt.bg }]}>
        <View style={[styles.header, { borderBottomColor: rt.border }]}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: rt.surface, borderColor: rt.border }]}>
            <IcoArrowLeft size={18} color={rt.text} strokeWidth={2.2} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: rt.text }]}>Premium</Text>
        </View>
        <View style={styles.alreadyPremium}>
          <Text style={[styles.alreadyTitle, { color: rt.accent }]}>Você já é Premium</Text>
          <Text style={[styles.alreadySub, { color: rt.textDim }]}>
            Obrigado por apoiar o SPMove. Aproveite a experiência sem anúncios.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const priceLabel = loadingPrice ? '...' : (price ?? 'Ver na loja');

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rt.bg }]}>
      <View style={[styles.header, { borderBottomColor: rt.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: rt.surface, borderColor: rt.border }]}>
          <IcoArrowLeft size={18} color={rt.text} strokeWidth={2.2} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: rt.text }]}>Premium</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { borderBottomColor: rt.border }]}>
          <Text style={[styles.heroEyebrow, { color: rt.accent }]}>SPMOVE</Text>
          <Text style={[styles.heroTitle, { color: rt.text }]}>PREMIUM</Text>
          <Text style={[styles.heroSub, { color: rt.textDim }]}>
            Remova os anúncios e apoie o desenvolvimento do app.
          </Text>
        </View>

        <View style={styles.benefitsSection}>
          <Text style={[styles.sectionLabel, { color: rt.textDim }]}>O QUE VOCÊ GANHA</Text>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefitRow}>
              <View style={[styles.benefitDot, { backgroundColor: rt.accent }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.benefitTitle, { color: rt.text }]}>{b.title}</Text>
                <Text style={[styles.benefitDesc, { color: rt.textDim }]}>{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={purchase}
            disabled={purchasing}
            style={[
              styles.buyBtn,
              { backgroundColor: rt.accent },
              purchasing && styles.buyBtnDisabled,
            ]}>
            {purchasing ? (
              <ActivityIndicator color={rt.onAccent} />
            ) : (
              <>
                <Text style={[styles.buyBtnLabel, { color: rt.onAccent }]}>
                  Assinar por {priceLabel}/mês
                </Text>
                <Text style={[styles.buyBtnSub, { color: rt.onAccent }]}>
                  Cancele quando quiser
                </Text>
              </>
            )}
          </Pressable>

          <Pressable onPress={restore} disabled={purchasing} style={styles.restoreBtn}>
            <Text style={[styles.restoreBtnText, { color: rt.textDim }]}>Restaurar compra</Text>
          </Pressable>

          <Text style={[styles.legalText, { color: rt.textFaint }]}>
            A assinatura renova automaticamente ao final de cada ciclo mensal. Cancele a qualquer
            momento pela App Store ou Google Play.
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
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },

  content: { paddingBottom: 48 },

  hero: {
    paddingHorizontal: 22,
    paddingTop: 32,
    paddingBottom: 28,
    borderBottomWidth: 1,
  },
  heroEyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '700',
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 52,
    fontWeight: '700',
    letterSpacing: -3,
    lineHeight: 50,
    marginBottom: 12,
  },
  heroSub: { fontSize: 14, lineHeight: 20 },

  benefitsSection: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 8 },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '600',
    marginBottom: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 18,
  },
  benefitDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginTop: 5,
  },
  benefitTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  benefitDesc: { fontSize: 12, lineHeight: 17 },

  actions: { paddingHorizontal: 22, paddingTop: 12 },
  buyBtn: {
    borderRadius: theme.radiusCard,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  buyBtnDisabled: { opacity: 0.5 },
  buyBtnLabel: { fontSize: 15, fontWeight: '700' },
  buyBtnSub: { fontSize: 11, opacity: 0.65, marginTop: 2 },

  restoreBtn: { alignItems: 'center', paddingVertical: 12, marginBottom: 20 },
  restoreBtnText: { fontSize: 13, fontWeight: '500' },

  legalText: {
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },

  alreadyPremium: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  alreadyTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -1,
    marginBottom: 10,
  },
  alreadySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
