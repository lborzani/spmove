import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { theme } from '@/constants/theme';
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
  const { isPremium, purchasing, purchase, restore } = useSubscription();
  const [price] = useState<string | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(true);

  useEffect(() => {
    setLoadingPrice(false);
  }, []);

  if (isPremium) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <IcoArrowLeft size={18} color={theme.text} strokeWidth={2.2} />
          </Pressable>
          <Text style={styles.headerTitle}>Premium</Text>
        </View>
        <View style={styles.alreadyPremium}>
          <Text style={styles.alreadyTitle}>Você já é Premium</Text>
          <Text style={styles.alreadySub}>
            Obrigado por apoiar o SPMove. Aproveite a experiência sem anúncios.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const priceLabel = loadingPrice ? '...' : (price ?? 'Ver na loja');

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <IcoArrowLeft size={18} color={theme.text} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>Premium</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>SPMOVE</Text>
          <Text style={styles.heroTitle}>PREMIUM</Text>
          <Text style={styles.heroSub}>Remova os anúncios e apoie o desenvolvimento do app.</Text>
        </View>

        <View style={styles.benefitsSection}>
          <Text style={styles.sectionLabel}>O QUE VOCÊ GANHA</Text>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefitRow}>
              <View style={styles.benefitDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDesc}>{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={purchase}
            disabled={purchasing}
            style={[styles.buyBtn, purchasing && styles.buyBtnDisabled]}>
            {purchasing ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <>
                <Text style={styles.buyBtnLabel}>Assinar por {priceLabel}/mês</Text>
                <Text style={styles.buyBtnSub}>Cancele quando quiser</Text>
              </>
            )}
          </Pressable>

          <Pressable onPress={restore} disabled={purchasing} style={styles.restoreBtn}>
            <Text style={styles.restoreBtnText}>Restaurar compra</Text>
          </Pressable>

          <Text style={styles.legalText}>
            A assinatura renova automaticamente ao final de cada ciclo mensal. Cancele a qualquer
            momento pela App Store ou Google Play.
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
  headerTitle: { color: theme.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },

  content: { paddingBottom: 48 },

  hero: {
    paddingHorizontal: 22,
    paddingTop: 32,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  heroEyebrow: {
    color: theme.accent,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '700',
    marginBottom: 6,
  },
  heroTitle: {
    color: theme.text,
    fontSize: 52,
    fontWeight: '700',
    letterSpacing: -3,
    lineHeight: 50,
    marginBottom: 12,
  },
  heroSub: { color: theme.textDim, fontSize: 14, lineHeight: 20 },

  benefitsSection: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 8 },
  sectionLabel: {
    color: theme.textDim,
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
    backgroundColor: theme.accent,
    marginTop: 5,
  },
  benefitTitle: { color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  benefitDesc: { color: theme.textDim, fontSize: 12, lineHeight: 17 },

  actions: { paddingHorizontal: 22, paddingTop: 12 },
  buyBtn: {
    backgroundColor: theme.accent,
    borderRadius: theme.radiusCard,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  buyBtnDisabled: { opacity: 0.5 },
  buyBtnLabel: { color: theme.onAccent, fontSize: 15, fontWeight: '700' },
  buyBtnSub: { color: theme.onAccent, fontSize: 11, opacity: 0.65, marginTop: 2 },

  restoreBtn: { alignItems: 'center', paddingVertical: 12, marginBottom: 20 },
  restoreBtnText: { color: theme.textDim, fontSize: 13, fontWeight: '500' },

  legalText: {
    color: theme.textFaint,
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
    color: theme.accent,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -1,
    marginBottom: 10,
  },
  alreadySub: {
    color: theme.textDim,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
