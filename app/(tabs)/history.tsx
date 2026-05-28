import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { theme, STATUS_META } from '@/constants/theme';
import { LINE_META, fetchOcorrencias, todayISO, daysAgoISO } from '@/services/api';
import type { RichOcorrencia } from '@/constants/data';

// ── Pulse ring para eventos em curso ────────────────────────────────────────

function PulseRing({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 600,  useNativeDriver: true }),
      ]),
    ).start();
    return () => anim.stopAnimation();
  }, [anim]);
  const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0]  });
  return (
    <Animated.View style={[styles.pulseRing, { borderColor: color, transform: [{ scale }], opacity }]} />
  );
}

// ── Tela ─────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  // Mesma query key que alerts.tsx → cache compartilhado, zero requests extras
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['ocorrencias', todayISO()],
    queryFn:  () => fetchOcorrencias(daysAgoISO(1), todayISO()),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const ocorrencias = data ?? [];

  // Ordenar por hora (mais recente primeiro)
  const sorted = useMemo(
    () => [...ocorrencias].sort(
      (a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime(),
    ),
    [ocorrencias],
  );

  // "em curso" = última ocorrência de cada linha que não é "normal"
  const latestByLine = useMemo(() => {
    const seen = new Set<string>();
    const result: RichOcorrencia[] = [];
    for (const o of sorted) {
      if (!seen.has(o.lineCode)) {
        seen.add(o.lineCode);
        result.push(o);
      }
    }
    return result;
  }, [sorted]);

  const ongoingCount  = latestByLine.filter((o) => o.status !== 'normal').length;
  const resolvedCount = sorted.length - ongoingCount;

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>HOJE · {today.toUpperCase()}</Text>
        <Text style={styles.title}>Linha do tempo</Text>
        {!isLoading && (
          <Text style={styles.subtitle}>
            {ongoingCount} em curso · {resolvedCount} ocorrências registradas
          </Text>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.loadingText}>Carregando histórico…</Text>
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Sem conexão</Text>
          <Text style={styles.errorBody}>Não foi possível carregar o histórico.</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>TENTAR NOVAMENTE</Text>
          </Pressable>
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Sem ocorrências registradas hoje.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
        >
          <View style={styles.timeline}>
            <View style={styles.axis} />

            {sorted.map((o) => {
              const meta      = STATUS_META[o.status];
              const lineMeta  = LINE_META[o.lineCode];
              const isOngoing = o.status !== 'normal';

              return (
                <View key={o.id} style={styles.row}>
                  {/* timestamp */}
                  <View style={styles.timeCol}>
                    <Text style={styles.timeText}>{o.at}</Text>
                  </View>

                  {/* node */}
                  <View style={styles.nodeWrapper}>
                    {isOngoing && <PulseRing color={meta.color} />}
                    <View style={[styles.node, { borderColor: meta.color }]} />
                  </View>

                  {/* card */}
                  <Pressable
                    onPress={() => router.push(`/line/${o.lineCode}`)}
                    style={({ pressed }) => [styles.card, { opacity: pressed ? 0.75 : 1 }]}
                  >
                    {/* card header */}
                    <View style={styles.cardHeader}>
                      <View style={[styles.lineBadge, { backgroundColor: lineMeta?.color ?? '#888' }]}>
                        <Text style={styles.lineBadgeText}>{o.lineCode}</Text>
                      </View>
                      <Text style={styles.lineName}>{o.lineName}</Text>
                      <Text style={styles.lineNet}>{o.net}</Text>
                      <View style={styles.statusChip}>
                        {isOngoing ? (
                          <Text style={[styles.ongoingLabel, {
                            color: meta.color,
                            backgroundColor: `${meta.color}1f`,
                          }]}>
                            Em curso
                          </Text>
                        ) : (
                          <Text style={styles.resolvedLabel}>Registrado</Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.cardTitle}>{o.situacao}</Text>
                    {o.descricao ? (
                      <Text style={styles.cardBody} numberOfLines={2}>{o.descricao}</Text>
                    ) : null}
                  </Pressable>
                </View>
              );
            })}

            {/* início da operação */}
            <View style={[styles.row, { alignItems: 'center' }]}>
              <View style={styles.timeCol}>
                <Text style={styles.timeText}>04:40</Text>
              </View>
              <View style={styles.nodeWrapper}>
                <View style={[styles.node, { borderColor: theme.textFaint }]} />
              </View>
              <View style={styles.startMarker}>
                <Text style={styles.startMarkerText}>INÍCIO DA OPERAÇÃO · 04:40</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: theme.bg },
  header: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4 },
  eyebrow:  { color: theme.textDim, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  title:    { color: theme.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.6, marginTop: 2 },
  subtitle: { color: theme.textDim, fontSize: 12.5, marginTop: 2 },

  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  loadingText: { color: theme.textDim, fontSize: 13, marginTop: 8 },
  errorTitle:  { color: theme.text, fontSize: 16, fontWeight: '700' },
  errorBody:   { color: theme.textDim, fontSize: 13, textAlign: 'center' },
  retryBtn:    { marginTop: 8, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: theme.accent, borderRadius: theme.radiusCard },
  retryText:   { color: theme.onAccent, fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  emptyText:   { color: theme.textDim, fontSize: 13, textAlign: 'center' },

  timeline: { paddingHorizontal: 18, paddingTop: 16, position: 'relative' },
  axis: {
    position: 'absolute',
    // paddingH(18) + timeCol(40) + gap(8) + metade nodeWrapper(8) - metade eixo(1) = 73
    left: 18 + 40 + 8 + 8 - 1,
    top: 24, bottom: 24, width: 2,
    backgroundColor: theme.border,
  },
  row:         { flexDirection: 'row', gap: 8, marginBottom: 14 },
  timeCol:     { width: 40, paddingTop: 12, flexShrink: 0 },
  timeText:    { color: theme.textDim, fontSize: 11, fontWeight: '600', textAlign: 'right' },
  nodeWrapper: { width: 16, paddingTop: 12, alignItems: 'center', flexShrink: 0, position: 'relative', overflow: 'visible' },
  node: {
    width: 14, height: 14, borderRadius: 7, borderWidth: 3,
    backgroundColor: theme.bg, zIndex: 1,
  },
  pulseRing: {
    position: 'absolute', top: 9, left: -2,
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
  },
  card: {
    flex: 1, backgroundColor: theme.surface,
    borderWidth: 1, borderColor: theme.border,
    borderRadius: theme.radiusCard, padding: 12,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  lineBadge: {
    width: 22, height: 22, borderRadius: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  lineBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  lineName:   { color: theme.text, fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  lineNet:    { color: theme.textFaint, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  statusChip: { marginLeft: 'auto' },
  ongoingLabel: {
    fontSize: 10, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
  },
  resolvedLabel: { color: theme.textFaint, fontSize: 10, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 1 },
  cardTitle:  { color: theme.text, fontSize: 13.5, fontWeight: '600', lineHeight: 18 },
  cardBody:   { color: theme.textDim, fontSize: 12.5, lineHeight: 17, marginTop: 3 },

  startMarker: {
    flex: 1, backgroundColor: theme.surfaceMuted,
    borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  startMarkerText: { color: theme.textDim, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
});
