import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Alert,
  Animated,
  PanResponder,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { theme } from '@/constants/theme';
import type {
  SPLine,
  SPNearbyLine,
  SPVehicle,
  SPLinePosition,
  OSMStop,
  SPArrivalLine,
} from '@/constants/sptransTypes';
import {
  buscarLinhasProximas,
  buscarLinhas,
  getPosicaoLinha,
  buscarParadasOSM,
  resolverCodigoParada,
  getPrevisaoParada,
  buscarRotaLinha,
  haversineMeters,
} from '@/services/sptrans';
import { BusMap } from '@/components/BusMap';
import { getGtfsShape } from '@/services/gtfs';
import { IcoLocate, IcoBusSearch } from '@/components/Icons';

const SHEET_COLLAPSED = 160;
const SHEET_EXPANDED = 440;

type SheetMode = 'hidden' | 'nearby-lines' | 'line' | 'osm-stop';

export default function OnibusScreen() {
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);

  const [nearbyLines, setNearbyLines] = useState<SPNearbyLine[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const [osmStops, setOsmStops] = useState<OSMStop[]>([]);
  const [selectedOsmStop, setSelectedOsmStop] = useState<OSMStop | null>(null);
  const [osmArrivals, setOsmArrivals] = useState<SPArrivalLine[]>([]);
  const [osmArrivalsLoading, setOsmArrivalsLoading] = useState(false);

  const [routeAvailable, setRouteAvailable] = useState<boolean | null>(null);
  const [selectedLine, setSelectedLine] = useState<SPNearbyLine | SPLine | null>(null);
  const [routeStops, setRouteStops] = useState<import('@/constants/sptransTypes').SPStop[]>([]);
  const [routeShapes, setRouteShapes] = useState<{
    1: [number, number][] | null;
    2: [number, number][] | null;
  }>({ 1: null, 2: null });
  const [sentido, setSentido] = useState<1 | 2>(1);
  const [directionCls, setDirectionCls] = useState<{ 1: number | null; 2: number | null }>({
    1: null,
    2: null,
  });
  const [vehicles, setVehicles] = useState<SPVehicle[]>([]);
  const [lineLoading, setLineLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [lineResults, setLineResults] = useState<SPLine[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [centerOn, setCenterOn] = useState<{ lat: number; lon: number; zoom?: number } | null>(
    null,
  );
  const [sheetMode, setSheetMode] = useState<SheetMode>('hidden');
  const [, setSheetExpanded] = useState(false);
  const sheetHeight = useMemo(() => new Animated.Value(0), []);
  const expandedRef = useRef(false);

  const sheetPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4,
      onPanResponderGrant: () => {
        sheetHeight.stopAnimation();
      },
      onPanResponderMove: (_, gs) => {
        if (Math.abs(gs.dy) < 4) return;
        const base = expandedRef.current ? SHEET_EXPANDED : SHEET_COLLAPSED;
        sheetHeight.setValue(Math.max(SHEET_COLLAPSED, Math.min(SHEET_EXPANDED, base - gs.dy)));
      },
      onPanResponderRelease: (_, gs) => {
        // Tap: pouco movimento → toggle
        if (Math.abs(gs.dy) < 8 && Math.abs(gs.dx) < 8) {
          const next = !expandedRef.current;
          expandedRef.current = next;
          setSheetExpanded(next);
          Animated.spring(sheetHeight, {
            toValue: next ? SHEET_EXPANDED : SHEET_COLLAPSED,
            useNativeDriver: false,
            bounciness: 4,
          }).start();
          return;
        }
        // Drag: snapa por posição ou velocidade
        const base = expandedRef.current ? SHEET_EXPANDED : SHEET_COLLAPSED;
        const projected = base - gs.dy;
        const mid = (SHEET_COLLAPSED + SHEET_EXPANDED) / 2;
        const goExpand = projected > mid || gs.vy < -0.5;
        expandedRef.current = goExpand;
        setSheetExpanded(goExpand);
        Animated.spring(sheetHeight, {
          toValue: goExpand ? SHEET_EXPANDED : SHEET_COLLAPSED,
          useNativeDriver: false,
          bounciness: 3,
        }).start();
      },
    }),
  ).current;

  const positionInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const firstFix = useRef(false);

  const openSheet = useCallback(
    (expanded = true) => {
      expandedRef.current = expanded;
      setSheetExpanded(expanded);
      Animated.spring(sheetHeight, {
        toValue: expanded ? SHEET_EXPANDED : SHEET_COLLAPSED,
        useNativeDriver: false,
        bounciness: 4,
      }).start();
    },
    [sheetHeight],
  );

  const closeSheet = useCallback(() => {
    expandedRef.current = false;
    setSheetExpanded(false);
    Animated.timing(sheetHeight, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start(() => setSheetMode('hidden'));
  }, [sheetHeight]);

  const startTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return; // silent — map still shows, nearby disabled

    firstFix.current = false;
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 15 },
      (loc) => {
        const coords = { lat: loc.coords.latitude, lon: loc.coords.longitude };
        setUserCoords(coords);
        if (!firstFix.current) {
          firstFix.current = true;
          setCenterOn({ ...coords, zoom: 15 });
          buscarParadasOSM(coords.lat, coords.lon, 600)
            .then((stops) => setOsmStops(stops))
            .catch(() => {});
        }
      },
    );
  }, []);

  const centerOnUser = useCallback(() => {
    if (userCoords) setCenterOn({ ...userCoords, zoom: 16 });
  }, [userCoords]);

  const searchNearby = useCallback(async () => {
    if (!userCoords) return;
    setCenterOn({ ...userCoords, zoom: 15 });
    setNearbyLoading(true);
    setNearbyLines([]);
    setSelectedLine(null);
    setRouteStops([]);
    setVehicles([]);
    if (positionInterval.current) clearInterval(positionInterval.current);
    try {
      const lines = await buscarLinhasProximas(userCoords.lat, userCoords.lon, 500);
      setNearbyLines(lines);
      if (lines.length > 0) {
        setSheetMode('nearby-lines');
        openSheet(false);
      } else {
        Alert.alert(
          'Sem linhas',
          'Nenhum ônibus encontrado a 500 m. Tente novamente em instantes.',
        );
      }
    } catch {
      Alert.alert('Erro', 'Falha ao buscar linhas próximas.');
    } finally {
      setNearbyLoading(false);
    }
  }, [userCoords, openSheet]);

  const selectLine = useCallback(
    async (line: SPNearbyLine | SPLine) => {
      const displayCode =
        'c' in line ? (line as SPNearbyLine).c : `${(line as SPLine).lt}-${(line as SPLine).tl}`;
      Keyboard.dismiss();
      setSelectedLine(line);
      setLineResults([]);
      setSearchQuery('');
      setSheetMode('line');
      Animated.timing(sheetHeight, { toValue: 0, duration: 150, useNativeDriver: false }).start();
      setSheetExpanded(false);
      const initialSentido: 1 | 2 = 'sl' in line ? (line as SPNearbyLine).sl : 1;
      setLineLoading(true);
      setRouteStops([]);
      setVehicles([]);
      setRouteShapes({ 1: null, 2: null });
      setSentido(initialSentido);
      setDirectionCls({ 1: null, 2: null });
      if (positionInterval.current) clearInterval(positionInterval.current);

      const cl = line.cl;

      if ('vs' in line && (line as SPNearbyLine).vs.length > 0) {
        setVehicles((line as SPNearbyLine).vs);
      }

      const localShape1 = getGtfsShape(displayCode + '-1') ?? getGtfsShape(displayCode);
      const localShape2 = getGtfsShape(displayCode + '-2');

      let [shape1, shape2] = await Promise.all([
        localShape1
          ? Promise.resolve(localShape1)
          : buscarRotaLinha(displayCode, 1).catch(() => null),
        localShape2
          ? Promise.resolve(localShape2)
          : buscarRotaLinha(displayCode, 2).catch(() => null),
      ]);

      const shapes = { 1: shape1, 2: shape2 } as {
        1: [number, number][] | null;
        2: [number, number][] | null;
      };
      setRouteShapes(shapes);
      setSentido(initialSentido);
      const activeShape = shapes[initialSentido];
      setRouteAvailable(activeShape ? true : null);

      const cls: { 1: number | null; 2: number | null } = { 1: null, 2: null };
      try {
        const dirs = await buscarLinhas(displayCode);
        for (const d of dirs as SPLine[]) {
          if (d.sl === 1 || d.sl === 2) cls[d.sl] = d.cl;
        }
      } catch {
        /* fallback */
      }
      if (!cls[initialSentido]) cls[initialSentido] = cl;
      setDirectionCls(cls);

      const activeCl = cls[initialSentido] ?? cl;

      try {
        const pos = await getPosicaoLinha(activeCl);
        const vs: SPVehicle[] = (pos.l ?? []).flatMap((l: SPLinePosition) => l.vs ?? []);
        setVehicles(vs.length > 0 ? vs : (pos.vs ?? []));
      } catch {
        /* keep existing */
      }

      setLineLoading(false);

      positionInterval.current = setInterval(async () => {
        try {
          const pos = await getPosicaoLinha(activeCl);
          const vs: SPVehicle[] = (pos.l ?? []).flatMap((l: SPLinePosition) => l.vs ?? []);
          setVehicles(vs.length > 0 ? vs : (pos.vs ?? []));
        } catch {
          /* skip */
        }
      }, 10_000);
    },
    [openSheet],
  );

  const switchSentido = useCallback(
    (s: 1 | 2) => {
      setSentido(s);
      setRouteStops([]);

      const cl = directionCls[s];
      if (!cl) return;

      getPosicaoLinha(cl)
        .then((pos) => {
          const vs: SPVehicle[] = (pos.l ?? []).flatMap((l: SPLinePosition) => l.vs ?? []);
          setVehicles(vs.length > 0 ? vs : (pos.vs ?? []));
        })
        .catch(() => {});

      if (positionInterval.current) clearInterval(positionInterval.current);
      positionInterval.current = setInterval(async () => {
        try {
          const pos = await getPosicaoLinha(cl);
          const vs: SPVehicle[] = (pos.l ?? []).flatMap((l: SPLinePosition) => l.vs ?? []);
          setVehicles(vs.length > 0 ? vs : (pos.vs ?? []));
        } catch {
          /* skip */
        }
      }, 10_000);
    },
    [directionCls],
  );

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = searchQuery.trim();
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (q.length < 2) {
      setLineResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchDebounce.current = setTimeout(async () => {
      try {
        let results = await buscarLinhas(q);

        if (results.length === 0 && q.includes(' ')) {
          const terms = q.split(/\s+/).filter((t) => t.length >= 2);
          const searches = await Promise.all(
            terms.map((t) => buscarLinhas(t).catch(() => [] as SPLine[])),
          );
          const seen = new Set<number>();
          results = [];
          for (const batch of searches) {
            for (const l of batch) {
              if (!seen.has(l.cl)) {
                seen.add(l.cl);
                results.push(l);
              }
            }
          }
        }

        setLineResults(results.slice(0, 30));
      } catch {
        setLineResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [searchQuery]);

  useEffect(
    () => () => {
      if (positionInterval.current) clearInterval(positionInterval.current);
      locationSub.current?.remove();
    },
    [],
  );

  useEffect(() => {
    startTracking();
  }, [startTracking]);

  const selectOsmStop = useCallback(
    async (stop: OSMStop) => {
      setSelectedOsmStop(stop);
      setSelectedLine(null);
      setRouteStops([]);
      setVehicles([]);
      setCenterOn({ lat: stop.lat, lon: stop.lon, zoom: 17 });
      setSheetMode('osm-stop');
      openSheet(true);
      setOsmArrivalsLoading(true);
      setOsmArrivals([]);
      if (positionInterval.current) clearInterval(positionInterval.current);
      try {
        const cp = await resolverCodigoParada(stop);
        if (cp) {
          const res = await getPrevisaoParada(cp);
          setOsmArrivals(res.t ?? []);
        }
      } catch {
        /* no arrivals */
      }
      setOsmArrivalsLoading(false);
    },
    [openSheet],
  );

  const dismissSheet = () => {
    if (sheetMode !== 'line') closeSheet();
    setSheetMode('hidden');
    setSelectedLine(null);
    setSelectedOsmStop(null);
    setOsmArrivals([]);
    setRouteStops([]);
    setVehicles([]);
    setRouteShapes({ 1: null, 2: null });
    setSentido(1);
    if (positionInterval.current) clearInterval(positionInterval.current);
  };

  const lineCode = selectedLine
    ? 'c' in selectedLine
      ? (selectedLine as SPNearbyLine).c
      : `${(selectedLine as SPLine).lt}-${(selectedLine as SPLine).tl}`
    : '';
  const lineDest = selectedLine
    ? sentido === 1
      ? `${selectedLine.lt1} → ${selectedLine.lt0}`
      : `${selectedLine.lt0} → ${selectedLine.lt1}`
    : '';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.mapWrapper}>
        <BusMap
          userCoords={userCoords}
          stops={[]}
          osmStops={osmStops}
          vehicles={vehicles}
          routeStops={sheetMode === 'line' ? routeStops : []}
          routeLineCode={sheetMode === 'line' ? lineCode : null}
          routeCoords={sheetMode === 'line' ? (routeShapes[sentido] ?? null) : null}
          centerOn={centerOn}
          onOsmStopPress={selectOsmStop}
          onNoRoute={() => setRouteAvailable(false)}
        />

        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar linha (ex: 8000-10)"
            placeholderTextColor={theme.textFaint}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <Pressable
              style={styles.searchClear}
              onPress={() => {
                setSearchQuery('');
                setLineResults([]);
              }}
              hitSlop={8}>
              <Text style={styles.searchClearText}>✕</Text>
            </Pressable>
          )}
        </View>

        {searchQuery.trim().length >= 2 && (
          <View style={styles.dropdown}>
            {searchLoading ? (
              <ActivityIndicator color={theme.accent} style={{ margin: 16 }} />
            ) : lineResults.length === 0 ? (
              <Text style={styles.dropdownEmpty}>Nenhuma linha encontrada</Text>
            ) : (
              <FlatList
                data={Object.values(
                  lineResults.reduce<Record<string, SPLine[]>>((acc, l) => {
                    const key = `${l.lt}-${l.tl}`;
                    (acc[key] ??= []).push(l);
                    return acc;
                  }, {}),
                )}
                keyExtractor={(group) => `${group[0].lt}-${group[0].tl}`}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item: group }) => {
                  const sorted = [...group].sort((a, b) => a.sl - b.sl);
                  const ref = sorted[0];
                  const code = `${ref.lt}-${ref.tl}`;
                  return (
                    <View style={styles.dropdownGroup}>
                      <View style={styles.dropdownGroupHeader}>
                        <Text style={styles.dropdownCode}>{code}</Text>
                        <Text style={styles.dropdownName} numberOfLines={1}>
                          {ref.lt0} ↔ {ref.lt1}
                        </Text>
                      </View>
                      <View style={styles.dropdownDirRow}>
                        {sorted.map((l) => (
                          <Pressable
                            key={l.cl}
                            style={styles.dropdownDirBtn}
                            onPress={() => selectLine(l)}>
                            <Text style={styles.dropdownDirLabel}>
                              {l.sl === 1 ? 'Ida' : 'Volta'}
                            </Text>
                            <Text style={styles.dropdownDirDest} numberOfLines={1}>
                              → {l.sl === 1 ? l.lt0 : l.lt1}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        )}

        <View style={styles.btnStack}>
          <Pressable
            style={[styles.nearbyBtn, !userCoords && styles.mapBtnDisabled]}
            onPress={centerOnUser}
            disabled={!userCoords}>
            <IcoLocate size={18} color={userCoords ? theme.accent : theme.textFaint} />
            <Text style={styles.nearbyBtnText}>Centralizar</Text>
          </Pressable>
          <Pressable
            style={[styles.nearbyBtn, !userCoords && styles.mapBtnDisabled]}
            onPress={searchNearby}
            disabled={!userCoords || nearbyLoading}>
            {nearbyLoading ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <IcoBusSearch size={18} color={theme.accent} />
            )}
            <Text style={styles.nearbyBtnText}>Linhas Próximas</Text>
          </Pressable>
        </View>
      </View>

      <Animated.View
        style={[styles.sheet, { height: sheetHeight }]}
        pointerEvents={sheetMode === 'line' ? 'none' : 'auto'}>
        <View style={styles.sheetHeader} {...sheetPan.panHandlers}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {sheetMode === 'nearby-lines'
                ? `${nearbyLines.length} linhas próximas`
                : sheetMode === 'osm-stop' && selectedOsmStop
                  ? selectedOsmStop.name || 'Parada'
                  : ''}
            </Text>
            <Pressable onPress={dismissSheet} hitSlop={16}>
              <Text style={styles.sheetClose}>✕</Text>
            </Pressable>
          </View>
        </View>

        {sheetMode === 'osm-stop' && selectedOsmStop && (
          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {selectedOsmStop.shelter && <Text style={styles.sheetSub}>🏠 Com abrigo</Text>}
            {userCoords && (
              <Text style={styles.sheetSub}>
                {Math.round(
                  haversineMeters(
                    userCoords.lat,
                    userCoords.lon,
                    selectedOsmStop.lat,
                    selectedOsmStop.lon,
                  ),
                )}{' '}
                m de você
              </Text>
            )}
            <Text style={styles.sectionLabel}>LINHAS QUE PASSAM AQUI</Text>
            {osmArrivalsLoading ? (
              <ActivityIndicator color={theme.accent} style={{ marginTop: 16 }} />
            ) : osmArrivals.length === 0 ? (
              <Text style={styles.emptyText}>
                Sem previsões disponíveis. Parada pode não estar no sistema do Olho Vivo.
              </Text>
            ) : (
              osmArrivals.map((a) => (
                <View key={a.c} style={styles.arrivalRow}>
                  <Text style={styles.arrivalCode}>{a.c}</Text>
                  <View style={styles.arrivalTimes}>
                    {(a.vs ?? []).slice(0, 3).map((v, i) => (
                      <View key={i} style={styles.arrivalBadge}>
                        <Text style={styles.arrivalTime}>{v.t}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}

        {sheetMode === 'nearby-lines' && (
          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {Object.entries(
              nearbyLines.reduce<Record<string, SPNearbyLine[]>>((acc, l) => {
                (acc[l.c] ??= []).push(l);
                return acc;
              }, {}),
            ).map(([code, dirs]) => {
              const sorted = [...dirs].sort((a, b) => a.sl - b.sl);
              const ref = sorted[0];
              return (
                <View key={code} style={styles.lineGroup}>
                  <View style={styles.lineGroupHeader}>
                    <View style={styles.lineBadge}>
                      <Text style={styles.lineBadgeText}>{code}</Text>
                    </View>
                    <Text style={styles.lineGroupRoute} numberOfLines={1}>
                      {ref.lt0} ↔ {ref.lt1}
                    </Text>
                  </View>
                  <View style={styles.dirBtnRow}>
                    {sorted.map((l) => (
                      <Pressable key={l.cl} style={styles.dirPickBtn} onPress={() => selectLine(l)}>
                        <Text style={styles.dirPickLabel}>{l.sl === 1 ? 'Ida' : 'Volta'}</Text>
                        <Text style={styles.dirPickDest} numberOfLines={1}>
                          → {l.sl === 1 ? l.lt0 : l.lt1}
                        </Text>
                        <Text style={styles.dirPickMeta}>
                          {l.qv} ôn · {Math.round(l.nearestBusM)} m
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </Animated.View>

      {sheetMode === 'line' && selectedLine && (
        <View style={styles.linePanel}>
          <View style={styles.linePanelHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.linePanelCode}>{lineCode}</Text>
              <Text style={styles.linePanelName} numberOfLines={1}>
                {lineDest}
              </Text>
            </View>
            {lineLoading ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <Pressable onPress={dismissSheet} hitSlop={16}>
                <Text style={styles.sheetClose}>✕</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.sentidoRow}>
            <Pressable
              style={[styles.sentidoBtn, sentido === 1 && styles.sentidoBtnActive]}
              onPress={() => switchSentido(1)}
              disabled={!routeShapes[1]}>
              <Text style={[styles.sentidoBtnText, sentido === 1 && styles.sentidoBtnTextActive]}>
                Ida
              </Text>
              <Text
                style={[styles.sentidoDest, sentido === 1 && styles.sentidoDestActive]}
                numberOfLines={1}>
                {selectedLine.lt0}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.sentidoBtn, sentido === 2 && styles.sentidoBtnActive]}
              onPress={() => switchSentido(2)}
              disabled={!routeShapes[2]}>
              <Text style={[styles.sentidoBtnText, sentido === 2 && styles.sentidoBtnTextActive]}>
                Volta
              </Text>
              <Text
                style={[styles.sentidoDest, sentido === 2 && styles.sentidoDestActive]}
                numberOfLines={1}>
                {selectedLine.lt1}
              </Text>
            </Pressable>
          </View>
          {routeAvailable === false && (
            <Text style={[styles.emptyText, { marginTop: 8 }]}>
              Trajeto não mapeado no GeoServer SPTrans.
            </Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  mapWrapper: { flex: 1, position: 'relative' },

  searchBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
  },
  searchInput: {
    backgroundColor: `${theme.surface}f0`,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusCard,
    paddingHorizontal: 14,
    paddingRight: 38,
    paddingVertical: 10,
    color: theme.text,
    fontSize: 14,
  },
  searchClear: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearText: { color: theme.textDim, fontSize: 15 },

  dropdown: {
    position: 'absolute',
    top: 62,
    left: 12,
    right: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusCard,
    maxHeight: 220,
    zIndex: 10,
  },
  dropdownGroup: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  dropdownGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dropdownCode: { color: theme.accent, fontWeight: '800', fontSize: 13 },
  dropdownName: { color: theme.textDim, fontSize: 11, flex: 1 },
  dropdownDirRow: { flexDirection: 'row', gap: 6 },
  dropdownDirBtn: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: theme.surfaceElev,
    borderWidth: 1,
    borderColor: theme.border,
  },
  dropdownDirLabel: { color: theme.accent, fontSize: 10, fontWeight: '700' },
  dropdownDirDest: { color: theme.text, fontSize: 11, marginTop: 1 },
  dropdownEmpty: { color: theme.textFaint, fontSize: 13, margin: 16, textAlign: 'center' },

  btnStack: {
    position: 'absolute',
    bottom: 16,
    right: 14,
    flexDirection: 'column',
    gap: 10,
    alignItems: 'flex-end',
  },

  nearbyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${theme.surface}f5`,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 23,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  nearbyBtnText: { color: theme.accent, fontSize: 13, fontWeight: '700' },
  mapBtnDisabled: { opacity: 0.4 },

  sheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    overflow: 'hidden',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    marginTop: 10,
    marginBottom: 8,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    width: '100%',
  },
  sheetTitle: { flex: 1, color: theme.text, fontSize: 15, fontWeight: '700' },
  sheetClose: { color: theme.textDim, fontSize: 18, paddingLeft: 16 },
  sheetSub: { color: theme.textDim, fontSize: 12, marginHorizontal: 16, marginTop: 6 },
  sheetScroll: { paddingHorizontal: 16 },

  sectionLabel: {
    color: theme.textFaint,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
  },

  lineGroup: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  lineGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  lineBadge: {
    backgroundColor: theme.accent,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 56,
    alignItems: 'center',
  },
  lineBadgeText: { color: theme.onAccent, fontWeight: '800', fontSize: 13 },
  lineGroupRoute: { color: theme.textDim, fontSize: 11, flex: 1 },

  dirBtnRow: { flexDirection: 'row', gap: 8 },
  dirPickBtn: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    backgroundColor: theme.surfaceElev,
    borderWidth: 1,
    borderColor: theme.border,
  },
  dirPickLabel: { color: theme.accent, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  dirPickDest: { color: theme.text, fontSize: 12, fontWeight: '600' },
  dirPickMeta: { color: theme.textFaint, fontSize: 10, marginTop: 3 },

  emptyText: { color: theme.textFaint, fontSize: 12, marginTop: 10 },

  linePanel: {
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 24,
  },
  linePanelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  linePanelCode: { color: theme.accent, fontSize: 20, fontWeight: '800' },
  linePanelName: { color: theme.textDim, fontSize: 12, marginTop: 2 },

  sentidoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sentidoBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: theme.surfaceElev,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  sentidoBtnActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  sentidoBtnText: {
    color: theme.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sentidoBtnTextActive: { color: theme.onAccent },
  sentidoDest: {
    color: theme.textFaint,
    fontSize: 10,
    marginTop: 2,
  },
  sentidoDestActive: { color: theme.onAccent, opacity: 0.85 },

  arrivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  arrivalCode: { color: theme.accent, fontWeight: '700', fontSize: 13, minWidth: 72 },
  arrivalTimes: { flexDirection: 'row', gap: 6, flex: 1, flexWrap: 'wrap' },
  arrivalBadge: {
    backgroundColor: theme.surfaceElev,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  arrivalTime: { color: theme.text, fontSize: 12, fontWeight: '600' },
});
