import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { theme, STATUS_META } from '@/constants/theme';
import { FILTERS, type FilterId } from '@/constants/data';
import { fetchStatus } from '@/services/api';
import { LineCard } from '@/components/LineCard';
import {
  IcoSettings,
  IcoRefresh,
  IcoHeart,
  IcoAlert,
  IcoFilter,
  IcoChevronRight,
} from '@/components/Icons';
import { getFavorites, toggleFavorite } from '@/constants/favPrefs';
import { getGlobalEnabled } from '@/constants/notifPrefs';
import { useRuntimeTheme } from '@/context/RuntimeThemeContext';
import { registerWithBackend } from '@/services/pushRegistration';
import { fetchReportsSummary } from '@/services/reports';
import { syncLineStatusWidget } from '@/services/widgetSync';
import { AdBanner } from '@/components/AdBanner';

function MiniStat({
  n,
  label,
  color,
  cardBg,
}: {
  n: number;
  label: string;
  color: string;
  cardBg?: string;
}) {
  const { rt } = useRuntimeTheme();
  return (
    <View style={[styles.miniStat, { backgroundColor: cardBg ?? rt.bg }]}>
      <Text style={[styles.miniStatNum, { color }]}>{n}</Text>
      <Text style={[styles.miniStatLabel, { color: rt.textDim }]}>{label}</Text>
    </View>
  );
}

function LoadingSkeleton() {
  const { rt } = useRuntimeTheme();
  return (
    <View style={styles.skeleton}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[styles.skeletonCard, { backgroundColor: rt.surface }]} />
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const { rt, staticTheme } = useRuntimeTheme();
  const [filter, setFilter] = useState<FilterId>('all');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
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

  useEffect(() => {
    if (lines) syncLineStatusWidget(lines, favorites);
  }, [lines, favorites]);

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

  const filterCounts = useMemo<Record<FilterId, number>>(() => {
    if (!lines) return { all: 0, favorites: 0, metro: 0, cptm: 0, issues: 0 };
    return {
      all: lines.length,
      favorites: lines.filter((l) => favorites.has(l.num)).length,
      metro: lines.filter((l) => l.net === 'Metrô').length,
      cptm: lines.filter((l) => l.net === 'CPTM').length,
      issues: lines.filter((l) => l.status !== 'normal').length,
    };
  }, [lines, favorites]);
  const overall = counts.parado
    ? 'parado'
    : counts.lento
      ? 'lento'
      : counts.atencao
        ? 'atencao'
        : 'normal';
  const overallMeta = STATUS_META[overall];

  const hasData = !isLoading && !isError && !!lines?.length;
  const isFullyEncerrada = hasData && lines!.every((l) => l.isEncerrado);
  const isPartialNight = hasData && !isFullyEncerrada && lines!.some((l) => l.isEncerrado);
  const isAnyNightMode = isFullyEncerrada || isPartialNight;

  const activeLineCount = lines?.filter((l) => !l.isEncerrado).length ?? 0;

  const bannerBg = staticTheme
    ? staticTheme.bg
    : isFullyEncerrada
      ? '#373A3E'
      : isPartialNight
        ? '#212842'
        : overall === 'normal'
          ? rt.accent
          : overallMeta.color;

  const bannerText = staticTheme
    ? staticTheme.text
    : isFullyEncerrada
      ? '#E3E3DB'
      : isPartialNight
        ? '#F0E7D5'
        : overall === 'normal'
          ? rt.onAccent
          : overallMeta.textOn;

  const bannerHeadline = isFullyEncerrada
    ? 'Operação Encerrada'
    : isPartialNight
      ? 'Operação Noturna'
      : overall === 'normal'
        ? 'Tudo na linha'
        : overall === 'atencao'
          ? 'Atenção'
          : overall === 'lento'
            ? 'Rede lenta'
            : 'Rede parada';

  const miniStatCardBg = staticTheme ? 'rgba(0,0,0,0.25)' : rt.bg;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rt.bg }]}>
      {/* ─── Banner de status geral (fixo) ─── */}
      <View style={[styles.banner, { backgroundColor: isLoading ? rt.surface : bannerBg }]}>
        <View style={styles.bannerTopRow}>
          <View style={styles.brandRow}>
            <Image
              source={require('@/assets/icon.png')}
              style={styles.brandLogo}
              resizeMode="cover"
            />
            <Text style={[styles.brandName, { color: isLoading ? rt.textDim : bannerText }]}>
              SPMove
            </Text>
          </View>
          <View style={styles.bannerTopRight}>
            <Pressable onPress={() => router.push('/settings' as never)} style={styles.headerBtn}>
              <IcoSettings size={18} color={isLoading ? rt.textDim : bannerText} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.bannerLoading}>
            <ActivityIndicator size="large" color={rt.accent} />
            <Text style={[styles.bannerLoadingText, { color: rt.textDim }]}>Consultando rede…</Text>
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
            <Text style={[styles.bannerHeadline, { color: bannerText }]}>
              {bannerHeadline.toUpperCase()}
            </Text>
            <Text style={[styles.bannerSub, { color: bannerText }]}>
              {isFullyEncerrada
                ? 'Serviço encerrado · Retorna às 04h48'
                : isPartialNight
                  ? `${activeLineCount} ${activeLineCount === 1 ? 'linha ainda em operação' : 'linhas ainda em operação'}`
                  : problems === 0
                    ? `${counts.normal} linhas operando normalmente.`
                    : `${problems} ${problems === 1 ? 'linha' : 'linhas'} com ocorrência · ${counts.normal} normais`}
            </Text>
            {!isAnyNightMode && (
              <View style={styles.miniStats}>
                <MiniStat
                  n={counts.normal}
                  label="Normal"
                  color={STATUS_META.normal.color}
                  cardBg={miniStatCardBg}
                />
                <MiniStat
                  n={counts.atencao}
                  label="Atenção"
                  color={STATUS_META.atencao.color}
                  cardBg={miniStatCardBg}
                />
                <MiniStat
                  n={counts.lento}
                  label="Lento"
                  color={STATUS_META.lento.color}
                  cardBg={miniStatCardBg}
                />
                <MiniStat
                  n={counts.parado}
                  label="Parado"
                  color={STATUS_META.parado.color}
                  cardBg={miniStatCardBg}
                />
              </View>
            )}
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

      {/* ─── Filtro dropdown ─── */}
      {(() => {
        const activeMeta = FILTERS.find((f) => f.id === filter)!;
        const activeCount = hasData ? filterCounts[filter] : undefined;
        const hasProblem = filter === 'issues' && problems > 0;
        const btnBorder = hasProblem ? STATUS_META.atencao.color : rt.border;
        const btnText = hasProblem ? STATUS_META.atencao.color : rt.text;

        return (
          <>
            <Pressable
              onPress={() => setFilterMenuOpen(true)}
              style={[styles.filterBtn, { borderColor: btnBorder, backgroundColor: rt.surface }]}>
              <IcoFilter size={14} color={btnText} strokeWidth={2.2} />
              <Text style={[styles.filterBtnLabel, { color: btnText }]}>
                {activeMeta.label.toUpperCase()}
              </Text>
              {activeCount !== undefined && (
                <View style={[styles.filterBtnBadge, { backgroundColor: rt.bg }]}>
                  <Text style={[styles.filterBtnBadgeText, { color: rt.textDim }]}>
                    {activeCount}
                  </Text>
                </View>
              )}
              {problems > 0 && filter !== 'issues' && <View style={styles.filterAlertDot} />}
              <View style={styles.filterBtnChevron}>
                <IcoChevronRight size={14} color={rt.textDim} strokeWidth={2.5} />
              </View>
            </Pressable>

            <Modal
              visible={filterMenuOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setFilterMenuOpen(false)}>
              <Pressable style={styles.menuOverlay} onPress={() => setFilterMenuOpen(false)}>
                <View
                  style={[
                    styles.menuCard,
                    { backgroundColor: rt.surface, borderColor: rt.border },
                  ]}>
                  {FILTERS.map((f) => {
                    const fid = f.id as FilterId;
                    const active = filter === fid;
                    const count = hasData ? filterCounts[fid] : undefined;
                    const isIssues = fid === 'issues';
                    const rowHasProblem = isIssues && problems > 0;
                    const rowText = active
                      ? rt.accent
                      : rowHasProblem
                        ? STATUS_META.atencao.color
                        : rt.text;

                    return (
                      <Pressable
                        key={fid}
                        onPress={() => {
                          setFilter(fid);
                          setFilterMenuOpen(false);
                        }}
                        style={[styles.menuRow, active && { backgroundColor: rt.bg }]}>
                        <View style={styles.menuRowLeft}>
                          {fid === 'favorites' ? (
                            <IcoHeart size={14} color={rowText} filled={active} strokeWidth={2.5} />
                          ) : fid === 'issues' ? (
                            <IcoAlert size={14} color={rowText} strokeWidth={2.5} />
                          ) : (
                            <View style={styles.menuRowIconPlaceholder} />
                          )}
                          <Text
                            style={[
                              styles.menuRowLabel,
                              { color: rowText, fontWeight: active ? '700' : '500' },
                            ]}>
                            {f.label}
                          </Text>
                        </View>
                        {count !== undefined && (
                          <View
                            style={[
                              styles.menuRowBadge,
                              {
                                backgroundColor: rowHasProblem
                                  ? 'rgba(255,160,0,0.15)'
                                  : rt.surface,
                              },
                            ]}>
                            <Text
                              style={[
                                styles.menuRowBadgeText,
                                { color: rowHasProblem ? STATUS_META.atencao.color : rt.textDim },
                              ]}>
                              {count}
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </Pressable>
            </Modal>
          </>
        );
      })()}

      {/* ─── Lista (scrollável) ─── */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={rt.accent}
            colors={[rt.accent]}
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
              <Text style={[styles.emptyText, { color: rt.textDim }]}>
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
  root: { flex: 1 },
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
  brandLogo: { width: 22, height: 22, borderRadius: 5 },
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
  bannerLoadingText: { fontSize: 13 },
  bannerError: { paddingVertical: 8 },

  miniStats: { flexDirection: 'row', gap: 8 },
  miniStat: {
    flex: 1,
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
  },

  // filter dropdown button
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 22,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: theme.radiusChip,
    borderWidth: 1.5,
  },
  filterBtnLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, flex: 1 },
  filterBtnBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterBtnBadgeText: { fontSize: 11, fontWeight: '700' },
  filterAlertDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: STATUS_META.atencao.color,
  },
  filterBtnChevron: { marginLeft: 2, transform: [{ rotate: '90deg' }] },

  // filter dropdown menu
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-start',
    paddingTop: 160,
    paddingHorizontal: 22,
  },
  menuCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuRowIconPlaceholder: { width: 14 },
  menuRowLabel: { fontSize: 15 },
  menuRowBadge: {
    minWidth: 26,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  menuRowBadgeText: { fontSize: 12, fontWeight: '600' },

  // list
  list: { paddingHorizontal: 22, paddingTop: 12, gap: 8 },
  skeleton: { paddingHorizontal: 22, paddingTop: 12, gap: 8 },
  skeletonCard: {
    height: 64,
    borderRadius: theme.radiusCard,
    opacity: 0.5,
  },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 28 },
});
