import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { theme, STATUS_META, textStyles } from '@/constants/theme';
import { LINE_META, fetchOcorrencias, todayISO, daysAgoISO } from '@/services/api';
import { IcoAlert, IcoLightning, IcoInfo } from '@/components/Icons';
import { LineCodeBadge } from '@/components/LineBadge';
import { QueryStateView } from '@/components/QueryStateView';
import type { RichOcorrencia } from '@/constants/data';

// ── helpers ──────────────────────────────────────────────────────────────────

type SeverityFilter = 'all' | 'critico' | 'aviso' | 'info';

const SEV_LABELS: Record<SeverityFilter, string> = {
  all: 'Todas',
  critico: 'Crítico',
  aviso: 'Avisos',
  info: 'Info',
};

function severityMeta(severity: 'critico' | 'aviso' | 'info') {
  if (severity === 'critico') return STATUS_META.parado;
  if (severity === 'aviso') return STATUS_META.lento;
  return STATUS_META.atencao;
}

function SevIcon({ severity, size = 20 }: { severity: RichOcorrencia['severity']; size?: number }) {
  const meta = severityMeta(severity);
  if (severity === 'critico') return <IcoAlert size={size} color={meta.color} strokeWidth={2} />;
  if (severity === 'aviso') return <IcoLightning size={size} color={meta.color} strokeWidth={2} />;
  return <IcoInfo size={size} color={meta.color} strokeWidth={2} />;
}

// ── componente ───────────────────────────────────────────────────────────────

export default function AlertsScreen() {
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [read, setRead] = useState<Set<number>>(new Set());

  // Busca ocorrências de hoje + ontem (para pegar início do dia completo)
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['ocorrencias', todayISO()],
    queryFn: () => fetchOcorrencias(daysAgoISO(1), todayISO()),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const ocorrencias = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(
    () => ocorrencias.filter((o) => filter === 'all' || o.severity === filter),
    [ocorrencias, filter],
  );

  const unread = ocorrencias.filter((o) => !read.has(o.id)).length;

  const sevFilters: { id: SeverityFilter; count: number }[] = [
    { id: 'all', count: ocorrencias.length },
    { id: 'critico', count: ocorrencias.filter((o) => o.severity === 'critico').length },
    { id: 'aviso', count: ocorrencias.filter((o) => o.severity === 'aviso').length },
    { id: 'info', count: ocorrencias.filter((o) => o.severity === 'info').length },
  ];

  function markRead(id: number) {
    setRead((s) => new Set([...s, id]));
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={textStyles.eyebrow}>CENTRO DE ALERTAS</Text>
          <Text style={textStyles.pageTitle}>
            {isLoading ? 'Carregando…' : unread > 0 ? `${unread} alertas` : 'Tudo lido'}
          </Text>
        </View>
        {ocorrencias.length > 0 && (
          <Pressable onPress={() => setRead(new Set(ocorrencias.map((o) => o.id)))}>
            <Text style={styles.markAllBtn}>Marcar todas</Text>
          </Pressable>
        )}
      </View>

      {/* Severity filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
        style={styles.filtersScroll}>
        {sevFilters.map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.chipActive : 'transparent',
                  borderColor: active ? theme.chipActive : theme.border,
                },
              ]}>
              <Text style={[styles.chipText, { color: active ? theme.onChipActive : theme.text }]}>
                {SEV_LABELS[f.id]}
                {f.id === 'all' ? ` · ${f.count}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Content */}
      <QueryStateView
        isLoading={isLoading}
        isError={isError}
        loadingText="Buscando alertas…"
        onRetry={refetch}
      />
      {!isLoading && !isError && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }>
          {filtered.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>
                {filter === 'all'
                  ? 'Nenhuma ocorrência hoje.'
                  : `Sem alertas do tipo "${SEV_LABELS[filter]}".`}
              </Text>
            </View>
          ) : (
            filtered.map((o) => {
              const meta = severityMeta(o.severity);
              const isRead = read.has(o.id);
              const lineMeta = LINE_META[o.lineCode];

              return (
                <Pressable
                  key={o.id}
                  onPress={() => {
                    markRead(o.id);
                    router.push(`/line/${o.lineCode}`);
                  }}
                  style={({ pressed }) => [
                    styles.card,
                    { opacity: isRead ? 0.55 : pressed ? 0.8 : 1 },
                  ]}>
                  {/* severity strip */}
                  <View style={[styles.strip, { backgroundColor: meta.color }]} />

                  {/* severity icon */}
                  <View style={[styles.sevIcon, { backgroundColor: `${meta.color}22` }]}>
                    <SevIcon severity={o.severity} />
                  </View>

                  <View style={styles.content}>
                    {/* meta row */}
                    <View style={styles.metaRow}>
                      <LineCodeBadge num={o.lineCode} color={lineMeta?.color ?? '#888'} size={22} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {o.net} · {o.lineName} · {o.at}
                      </Text>
                      {!isRead && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notifTitle}>{o.situacao}</Text>
                    <Text style={styles.notifBody} numberOfLines={2}>
                      {o.descricao}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  markAllBtn: { color: theme.accent, fontSize: 12.5, fontWeight: '600', paddingBottom: 4 },

  filtersScroll: { flexGrow: 0 },
  filtersContainer: { paddingHorizontal: 18, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: theme.radiusChip,
  },
  chipText: { fontSize: 12, fontWeight: '600' },

  scroll: { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingBottom: 32, gap: 8 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyText: { color: theme.textDim, fontSize: 13, textAlign: 'center' },

  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusCard,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  sevIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: { flex: 1, minWidth: 0 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  metaText: {
    color: theme.textDim,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flex: 1,
  },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accent },

  notifTitle: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  notifBody: { color: theme.textDim, fontSize: 12.5, marginTop: 4, lineHeight: 18 },
});
