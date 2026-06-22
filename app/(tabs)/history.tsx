import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { theme, STATUS_META, textStyles } from '@/constants/theme';
import { LINE_META, fetchOcorrencias, todayISO, daysAgoISO } from '@/services/api';
import { LineCodeBadge } from '@/components/LineBadge';
import { QueryStateView } from '@/components/QueryStateView';
import type { RichOcorrencia } from '@/constants/data';

const SERVICE_START = '04:40';
const SERVICE_END = '00:00';

function PulseRing({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ).start();
    return () => anim.stopAnimation();
  }, [anim]);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  return (
    <Animated.View
      style={[styles.pulseRing, { borderColor: color, transform: [{ scale }], opacity }]}
    />
  );
}

function dayLabel(isoDate: string): string {
  const today = todayISO();
  const yesterday = daysAgoISO(1);
  if (isoDate === today) return 'Hoje';
  if (isoDate === yesterday) return 'Ontem';
  const [, m, d] = isoDate.split('-');
  return `${d}/${m}`;
}

export default function HistoryScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['ocorrencias-3d', todayISO()],
    queryFn: () => fetchOcorrencias(daysAgoISO(2), todayISO()),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Agrupar por dia ISO, cada grupo ordenado mais recente primeiro
  const byDay = useMemo(() => {
    const ocorrencias = data ?? [];
    const map: Record<string, RichOcorrencia[]> = {};
    for (const o of ocorrencias) {
      const day = o.dataHora.split('T')[0];
      (map[day] ??= []).push(o);
    }
    // Ordena eventos de cada dia por hora desc
    for (const day of Object.keys(map)) {
      map[day].sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
    }
    // Retorna dias ordenados desc (mais recente primeiro)
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [data]);

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={textStyles.eyebrow}>ÚLTIMOS 3 DIAS</Text>
        <Text style={textStyles.pageTitle}>Linha do tempo</Text>
        {!isLoading && <Text style={styles.subtitle}>{today}</Text>}
      </View>

      <QueryStateView
        isLoading={isLoading}
        isError={isError}
        isEmpty={!isLoading && !isError && byDay.length === 0}
        loadingText="Carregando histórico…"
        errorBody="Não foi possível carregar o histórico."
        emptyText="Sem ocorrências nos últimos 3 dias."
        onRetry={refetch}
      />
      {!isLoading && !isError && byDay.length > 0 && (
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
          }>
          {byDay.map(([isoDate, events]) => {
            const isToday = isoDate === todayISO();
            const nowH = new Date().getHours();
            const serviceEnded = !isToday || (nowH >= 0 && nowH < 4);

            return (
              <View key={isoDate}>
                {/* Day header */}
                <View style={styles.dayHeader}>
                  <Text style={styles.dayLabel}>{dayLabel(isoDate)}</Text>
                  <View style={styles.dayDivider} />
                  <Text style={styles.dayCount}>{events.length} ocorrências</Text>
                </View>

                <View style={styles.timeline}>
                  <View style={styles.axis} />

                  {/* Fim do serviço */}
                  {serviceEnded && (
                    <View style={[styles.row, { alignItems: 'center' }]}>
                      <View style={styles.timeCol}>
                        <Text style={styles.timeText}>{SERVICE_END}</Text>
                      </View>
                      <View style={styles.nodeWrapper}>
                        <View style={[styles.node, { borderColor: theme.textFaint }]} />
                      </View>
                      <View style={styles.boundaryMarker}>
                        <Text style={styles.boundaryText}>FIM DO SERVIÇO</Text>
                      </View>
                    </View>
                  )}

                  {/* Eventos */}
                  {events.map((o) => {
                    const meta = STATUS_META[o.status];
                    const lineMeta = LINE_META[o.lineCode];
                    const isOngoing = o.status !== 'normal';

                    return (
                      <View key={o.id} style={styles.row}>
                        <View style={styles.timeCol}>
                          <Text style={styles.timeText}>{o.at}</Text>
                        </View>
                        <View style={styles.nodeWrapper}>
                          {isOngoing && <PulseRing color={meta.color} />}
                          <View style={[styles.node, { borderColor: meta.color }]} />
                        </View>
                        <Pressable
                          onPress={() => router.push(`/line/${o.lineCode}`)}
                          style={({ pressed }) => [styles.card, { opacity: pressed ? 0.75 : 1 }]}>
                          <View style={styles.cardHeader}>
                            <LineCodeBadge
                              num={o.lineCode}
                              color={lineMeta?.color ?? '#888'}
                              size={22}
                            />
                            <Text style={styles.lineName}>{o.lineName}</Text>
                            <Text style={styles.lineNet}>{o.net}</Text>
                            <View style={styles.statusChip}>
                              {isOngoing ? (
                                <Text
                                  style={[
                                    styles.ongoingLabel,
                                    {
                                      color: meta.color,
                                      backgroundColor: `${meta.color}1f`,
                                    },
                                  ]}>
                                  Em curso
                                </Text>
                              ) : (
                                <Text style={styles.resolvedLabel}>Registrado</Text>
                              )}
                            </View>
                          </View>
                          <Text style={styles.cardTitle}>{o.situacao}</Text>
                          {o.descricao ? (
                            <Text style={styles.cardBody} numberOfLines={2}>
                              {o.descricao}
                            </Text>
                          ) : null}
                        </Pressable>
                      </View>
                    );
                  })}

                  {/* Início do serviço */}
                  <View style={[styles.row, { alignItems: 'center' }]}>
                    <View style={styles.timeCol}>
                      <Text style={styles.timeText}>{SERVICE_START}</Text>
                    </View>
                    <View style={styles.nodeWrapper}>
                      <View style={[styles.node, { borderColor: theme.textFaint }]} />
                    </View>
                    <View style={styles.boundaryMarker}>
                      <Text style={styles.boundaryText}>INÍCIO DO SERVIÇO</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4 },
  subtitle: { color: theme.textDim, fontSize: 12.5, marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 4,
  },
  dayLabel: { color: theme.text, fontSize: 14, fontWeight: '700' },
  dayDivider: { flex: 1, height: 1, backgroundColor: theme.border },
  dayCount: { color: theme.textFaint, fontSize: 11 },

  timeline: { paddingHorizontal: 18, paddingTop: 8, position: 'relative' },
  axis: {
    position: 'absolute',
    left: 18 + 40 + 8 + 8 - 1,
    top: 24,
    bottom: 24,
    width: 2,
    backgroundColor: theme.border,
  },
  row: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  timeCol: { width: 40, paddingTop: 12, flexShrink: 0 },
  timeText: { color: theme.textDim, fontSize: 11, fontWeight: '600', textAlign: 'right' },
  nodeWrapper: {
    width: 16,
    paddingTop: 12,
    alignItems: 'center',
    flexShrink: 0,
    position: 'relative',
    overflow: 'visible',
  },
  node: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    backgroundColor: theme.bg,
    zIndex: 1,
  },
  pulseRing: {
    position: 'absolute',
    top: 9,
    left: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  card: {
    flex: 1,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusCard,
    padding: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  lineName: { color: theme.text, fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  lineNet: { color: theme.textFaint, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  statusChip: { marginLeft: 'auto' },
  ongoingLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  resolvedLabel: {
    color: theme.textFaint,
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardTitle: { color: theme.text, fontSize: 13.5, fontWeight: '600', lineHeight: 18 },
  cardBody: { color: theme.textDim, fontSize: 12.5, lineHeight: 17, marginTop: 3 },

  boundaryMarker: {
    flex: 1,
    backgroundColor: theme.surfaceElev,
    borderWidth: 1,
    borderColor: theme.border,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boundaryText: {
    color: theme.textDim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
