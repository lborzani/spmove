import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { theme, STATUS_META } from '@/constants/theme';
import { STATIONS_FALLBACK, STATION_TRANSFERS } from '@/constants/data';
import { fetchStatus, fetchOcorrencias, LINE_META, todayISO, daysAgoISO } from '@/services/api';
import { StatusDot } from '@/components/StatusDot';
import { IcoArrowLeft } from '@/components/Icons';

export default function LineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lineCode = id ?? '';

  // Reutiliza cache do /status/ — zero request extra se Home já carregou
  const { data: lines, isLoading: statusLoading } = useQuery({
    queryKey: ['status'],
    queryFn:  fetchStatus,
    staleTime: 5 * 60 * 1000,
  });

  // Reutiliza cache do /ocorrencias/ se Alertas/Histórico já carregou
  const { data: ocorrencias, isLoading: histLoading } = useQuery({
    queryKey: ['ocorrencias', todayISO()],
    queryFn:  () => fetchOcorrencias(daysAgoISO(1), todayISO()),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const line     = lines?.find((l) => l.num === lineCode);
  const lineMeta = LINE_META[lineCode];
  const lineHist = (ocorrencias ?? []).filter((o) => o.lineCode === lineCode);

  // Estações: usa os da API se disponíveis, senão fallback estático
  const stations = line?.estacoes ?? STATIONS_FALLBACK[parseInt(lineCode, 10)] ?? [];

  const getTransfers = (st: string) =>
    (STATION_TRANSFERS[st] ?? []).filter((n) => n !== lineCode);

  if (statusLoading) {
    return (
      <SafeAreaView style={styles.root}>
        <Pressable onPress={() => router.back()} style={styles.topBackBtn}>
          <IcoArrowLeft size={18} color={theme.text} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.loadingText}>Carregando…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!line || !lineMeta) {
    return (
      <SafeAreaView style={styles.root}>
        <Pressable onPress={() => router.back()} style={styles.topBackBtn}>
          <IcoArrowLeft size={18} color={theme.text} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Linha {lineCode} não encontrada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const meta = STATUS_META[line.status];

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Header com gradiente na cor da linha ─── */}
        <LinearGradient
          colors={[line.color, `${line.color}cc`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.header}
        >
          <Pressable onPress={() => router.back()} style={styles.backCircle}>
            <IcoArrowLeft size={18} color="#fff" strokeWidth={2.2} />
          </Pressable>

          <View style={styles.lineIdentity}>
            <View style={[styles.bigBadge, { backgroundColor: line.color }]}>
              <Text style={styles.bigBadgeNum}>{line.num}</Text>
            </View>
            <View>
              <Text style={styles.headerNet}>{line.net} · LINHA {line.num}</Text>
              <Text style={styles.headerName}>{line.name}</Text>
            </View>
          </View>

          {/* status box */}
          <View style={styles.statusBox}>
            <StatusDot status={line.status} size={10} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusLabel}>{line.situacao ?? meta.label}</Text>
              {line.note && line.note !== line.situacao && (
                <Text style={styles.statusNote}>{line.note}</Text>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* ─── Estações ─── */}
        {stations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ESTAÇÕES</Text>
            <View style={styles.stationList}>
              <View style={[styles.stationRail, { backgroundColor: line.color }]} />
              {stations.map((st, i) => {
                const transfers = getTransfers(st);
                return (
                  <View key={i} style={styles.stationRow}>
                    <View style={[styles.stationDot, { borderColor: line.color }]} />
                    <Text style={styles.stationName}>{st}</Text>
                    {transfers.length > 0 && (
                      <View style={styles.transferBadges}>
                        {transfers.map((n) => (
                          <View key={n} style={[styles.transferBadge, { backgroundColor: LINE_META[n]?.color ?? '#888' }]}>
                            <Text style={styles.transferBadgeText}>{n}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Ocorrências de hoje ─── */}
        {histLoading ? (
          <View style={{ padding: 18, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={theme.accent} />
          </View>
        ) : lineHist.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>OCORRÊNCIAS HOJE</Text>
            <View style={styles.histList}>
              {lineHist.map((o) => {
                const hMeta = STATUS_META[o.status];
                return (
                  <View key={o.id} style={styles.histCard}>
                    <View style={styles.histMeta}>
                      <StatusDot status={o.status} size={8} />
                      <Text style={styles.histTime}>{o.at}</Text>
                      {o.status !== 'normal' && (
                        <Text style={[styles.ongoingTag, { color: hMeta.color }]}>· EM CURSO</Text>
                      )}
                    </View>
                    <Text style={styles.histTitle}>{o.situacao}</Text>
                    {o.descricao ? (
                      <Text style={styles.histBody}>{o.descricao}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>OCORRÊNCIAS HOJE</Text>
            <Text style={styles.noHistText}>Sem ocorrências registradas hoje nesta linha.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: theme.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  topBackBtn: { margin: 16 },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  loadingText:{ color: theme.textDim, fontSize: 13 },
  errorText:  { color: theme.textDim, fontSize: 14 },

  // header
  header:        { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 22 },
  backCircle: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  lineIdentity:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  bigBadge: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  bigBadgeNum:  { color: '#fff', fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  headerNet:    { color: 'rgba(255,255,255,0.85)', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '500' },
  headerName:   { color: '#ffffff', fontSize: 26, fontWeight: '700', letterSpacing: -0.7, lineHeight: 28 },
  statusBox: {
    backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  statusLabel:  { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  statusNote:   { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 1 },

  // sections
  section:       { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 6 },
  sectionTitle: {
    color: theme.textDim, fontSize: 11, letterSpacing: 1.5,
    textTransform: 'uppercase', fontWeight: '600', marginBottom: 12,
  },
  noHistText: { color: theme.textDim, fontSize: 13 },

  // stations
  stationList: { paddingLeft: 18, position: 'relative' },
  stationRail: { position: 'absolute', left: 5, top: 6, bottom: 6, width: 3, borderRadius: 2 },
  stationRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, position: 'relative' },
  stationDot: {
    position: 'absolute', left: -18,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: theme.bg, borderWidth: 3,
  },
  stationName:  { color: theme.text, fontSize: 14, fontWeight: '500' },
  transferBadges:    { flexDirection: 'row', gap: 4, marginLeft: 8 },
  transferBadge:     { width: 18, height: 18, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  transferBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  // history
  histList:   { gap: 8 },
  histCard: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: theme.radiusCard, padding: 12,
  },
  histMeta:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  histTime:     { color: theme.textDim, fontSize: 11, fontWeight: '600' },
  ongoingTag:   { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  histTitle:    { color: theme.text, fontSize: 14, fontWeight: '600' },
  histBody:     { color: theme.textDim, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
});
