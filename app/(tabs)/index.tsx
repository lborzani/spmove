import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { theme, STATUS_META } from '@/constants/theme';
import { FILTERS, type FilterId } from '@/constants/data';
import { fetchStatus } from '@/services/api';
import { LineCard } from '@/components/LineCard';
import { IcoLogo, IcoSettings, IcoRefresh } from '@/components/Icons';
import { getFavorites, toggleFavorite } from '@/constants/favPrefs';
import { getGlobalEnabled } from '@/constants/notifPrefs';
import { registerWithBackend } from '@/services/pushRegistration';
import { fetchReportsSummary } from '@/services/reports';
import { AdBanner } from '@/components/AdBanner';

function MiniStat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniStatNum, { color }]}>{n}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function LoadingSkeleton() {
  return (
    <View style={styles.skeleton}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.skeletonCard} />
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const [filter, setFilter] = useState<FilterId>('all');
  const [now, setNow] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [reportSummary, setReportSummary] = useState<Record<string, number>>({});
  const isFirstMount = useRef(true);

  useFocusEffect(
    useCallback(() => {
      getFavorites().then((favs) => {
        setFavorites(new Set(favs));
        if (isFirstMount.current && favs.length > 0) {
          setFilter('favorites');
        }
        isFirstMount.current = false;
      });
      fetchReportsSummary()
        .then(setReportSummary)
        .catch(() => null);
    }, []),
  );

  const handleFavoriteToggle = useCallback(async (num: string) => {
    const newFavs = await toggleFavorite(num);
    setFavorites(new Set(newFavs));
    const enabled = await getGlobalEnabled();
    if (enabled) {
      registerWithBackend(newFavs).catch(() => null);
    }
  }, []);

  useEffect(() => {
    function tick() {
      setNow(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const {
    data: lines,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['status'],
    queryFn: fetchStatus,
    refetchInterval: 5 * 60 * 1000, // polling a cada 5min
    refetchIntervalInBackground: false,
  });

  const filtered = useMemo(() => {
    if (!lines) return [];
    return lines.filter((l) => {
      if (filter === 'favorites') return favorites.has(l.num);
      if (filter === 'metro') return l.net === 'Metrô';
      if (filter === 'cptm') return l.net === 'CPTM';
      if (filter === 'issues') return l.status !== 'normal';
      return true;
    });
  }, [lines, filter, favorites]);

  const counts = useMemo(() => {
    const c = { normal: 0, atencao: 0, lento: 0, parado: 0 };
    (lines ?? []).forEach((l) => {
      c[l.status]++;
    });
    return c;
  }, [lines]);

  const problems = counts.atencao + counts.lento + counts.parado;
  const overall = counts.parado
    ? 'parado'
    : counts.lento
      ? 'lento'
      : counts.atencao
        ? 'atencao'
        : 'normal';
  const overallMeta = STATUS_META[overall];
  const bannerBg = overall === 'normal' ? theme.accent : overallMeta.color;
  const bannerText = overall === 'normal' ? theme.onAccent : overallMeta.textOn;
  const bannerHeadline =
    overall === 'normal'
      ? 'Tudo na linha'
      : overall === 'atencao'
        ? 'Atenção'
        : overall === 'lento'
          ? 'Rede lenta'
          : 'Rede parada';

  return (
    <SafeAreaView style={styles.root}>
      {/* ─── Banner de status geral (fixo) ─── */}
      <View style={[styles.banner, { backgroundColor: isLoading ? theme.surface : bannerBg }]}>
        <View style={styles.bannerTopRow}>
          <View style={styles.brandRow}>
            <IcoLogo size={20} color={isLoading ? theme.textDim : bannerText} />
            <Text style={[styles.brandName, { color: isLoading ? theme.textDim : bannerText }]}>
              SPMove
            </Text>
          </View>
          <View style={styles.bannerTopRight}>
            <Pressable onPress={() => router.push('/settings' as never)} style={styles.headerBtn}>
              <IcoSettings
                size={16}
                color={isLoading ? theme.textDim : bannerText}
                strokeWidth={2}
              />
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.bannerLoading}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={styles.bannerLoadingText}>Consultando rede…</Text>
          </View>
        ) : isError ? (
          <View style={styles.bannerError}>
            <Text style={[styles.bannerHeadline, { color: '#fff', fontSize: 24 }]}>
              SEM CONEXÃO
            </Text>
            <Text style={[styles.bannerSub, { color: 'rgba(255,255,255,0.75)' }]}>
              Verifique sua internet e puxe para atualizar.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.bannerEyebrow, { color: bannerText }]}>
              REDE SÃO PAULO · {now}
            </Text>
            <Text style={[styles.bannerHeadline, { color: bannerText }]}>
              {bannerHeadline.toUpperCase()}
            </Text>
            <Text style={[styles.bannerSub, { color: bannerText }]}>
              {problems === 0
                ? `${counts.normal} linhas operando normalmente.`
                : `${problems} ${problems === 1 ? 'linha' : 'linhas'} com ocorrência · ${counts.normal} normais`}
            </Text>
            <View style={styles.miniStats}>
              <MiniStat n={counts.normal} label="Normal" color={STATUS_META.normal.color} />
              <MiniStat n={counts.atencao} label="Atenção" color={STATUS_META.atencao.color} />
              <MiniStat n={counts.lento} label="Lento" color={STATUS_META.lento.color} />
              <MiniStat n={counts.parado} label="Parado" color={STATUS_META.parado.color} />
            </View>
            <Pressable
              onPress={() => refetch()}
              style={[styles.refreshBtnFull, { opacity: isRefetching ? 0.5 : 1 }]}
              disabled={isRefetching}>
              <IcoRefresh size={14} color={bannerText} strokeWidth={2} />
              <Text style={[styles.refreshBtnText, { color: bannerText }]}>
                {isRefetching ? 'Atualizando…' : 'Atualizar'}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {/* ─── Filtros ─── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
        style={styles.filtersScroll}>
        {FILTERS.map((f) => {
          const active = filter === (f.id as FilterId);
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id as FilterId)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.chipActive : 'transparent',
                  borderColor: active ? theme.chipActive : theme.border,
                },
              ]}>
              <Text style={[styles.chipText, { color: active ? theme.onChipActive : theme.text }]}>
                {f.label.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ─── Lista (scrollável) ─── */}
      <ScrollView
        style={styles.listScroll}
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
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <View style={styles.list}>
            {filtered.map((l) => (
              <LineCard
                key={l.id}
                line={l}
                onPress={() => router.push(`/line/${l.num}`)}
                isFavorited={favorites.has(l.num)}
                onFavoriteToggle={() => handleFavoriteToggle(l.num)}
                reportCount={reportSummary[l.num] ?? 0}
              />
            ))}
            {filtered.length === 0 && (
              <Text style={styles.emptyText}>
                {filter === 'favorites'
                  ? 'Nenhuma linha favoritada. Toque no coração para favoritar.'
                  : 'Nenhuma linha neste filtro.'}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      <AdBanner />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  listScroll: { flex: 1 },
  listContent: { paddingBottom: 32 },

  // banner
  banner: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 20,
    minHeight: 140,
    justifyContent: 'center',
  },
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandName: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  bannerTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  refreshBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  bannerEyebrow: {
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.75,
  },
  bannerHeadline: {
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  bannerSub: { fontSize: 13, fontWeight: '600', opacity: 0.85, marginBottom: 16 },
  bannerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  bannerLoadingText: { color: theme.textDim, fontSize: 13 },
  bannerError: { paddingVertical: 8 },

  miniStats: { flexDirection: 'row', gap: 8 },
  miniStat: {
    flex: 1,
    backgroundColor: theme.bg,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 2,
  },
  miniStatNum: { fontSize: 18, fontWeight: '700', letterSpacing: -0.5, lineHeight: 20 },
  miniStatLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.textDim,
  },

  // filters
  filtersScroll: { flexGrow: 0, marginTop: 16 },
  filtersContainer: {
    paddingHorizontal: 22,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radiusChip,
  },
  chipText: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },

  // list
  list: { paddingHorizontal: 22, paddingTop: 12, gap: 8 },
  skeleton: { paddingHorizontal: 22, paddingTop: 12, gap: 8 },
  skeletonCard: {
    height: 64,
    borderRadius: theme.radiusCard,
    backgroundColor: theme.surface,
    opacity: 0.5,
  },
  emptyText: { color: theme.textDim, fontSize: 13, textAlign: 'center', paddingVertical: 28 },
});
