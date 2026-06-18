import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { theme } from '@/constants/theme';
import type {
  SPLine,
  SPNearbyLine,
  SPVehicle,
  SPLinePosition,
  SPStop,
  SPArrivalLine,
  MetroStation,
  MetroLineData,
  RouteColorMap,
} from '@/constants/sptransTypes';
import {
  buscarLinhasProximas,
  buscarLinhas,
  buscarParadas,
  buscarParadasPorLinha,
  getPosicaoLinha,
  getPrevisaoParada,
  getPrevisaoLinhaNaParada,
  buscarRotaLinha,
  haversineMeters,
} from '@/services/sptrans';
import { BusMap } from '@/components/BusMap';
import {
  getGtfsShape,
  getGtfsStops,
  getMetroStations,
  getMetroLines,
  getStopsNear,
  getRouteColors,
} from '@/services/gtfs';
import { IcoLocate } from '@/components/Icons';

const SNAP_PEEK = 64;
const SNAP_COLLAPSED = 380;
const SNAP_EXPANDED = 600;

type SheetMode = 'hidden' | 'nearby-lines' | 'line' | 'osm-stop';

function getDisplayCode(line: SPNearbyLine | SPLine): string {
  return 'c' in line ? (line as SPNearbyLine).c : `${(line as SPLine).lt}-${(line as SPLine).tl}`;
}

function stripRef(ed: string): string {
  const idx = ed.search(/\s+Ref\./i);
  return idx > 0 ? ed.slice(0, idx).trim() : ed;
}

function toRelativeTime(t: string): string {
  const parts = t.split(':');
  if (parts.length < 2) return t;
  const tMin = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let diff = tMin - nowMin;
  if (diff < -120) diff += 24 * 60;
  if (diff <= 1) return 'Agora';
  if (diff < 60) return `${diff} min`;
  return t;
}

export default function OnibusScreen() {
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);

  const [nearbyLines, setNearbyLines] = useState<SPNearbyLine[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const [nearbyStops, setNearbyStops] = useState<SPStop[]>([]);
  const [spStops, setSpStops] = useState<SPStop[]>([]);
  const [selectedStop, setSelectedStop] = useState<SPStop | null>(null);
  const [metroStations, setMetroStations] = useState<MetroStation[]>([]);
  const [metroLines, setMetroLines] = useState<MetroLineData[]>([]);
  const [routeColors, setRouteColors] = useState<RouteColorMap>({});
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
  const [activeArrivalLine, setActiveArrivalLine] = useState<SPArrivalLine | null>(null);
  const [allRoutes, setAllRoutes] = useState<{ coords: [number, number][]; color?: string }[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [lineResults, setLineResults] = useState<SPLine[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [centerOn, setCenterOn] = useState<{ lat: number; lon: number; zoom?: number } | null>(
    null,
  );
  const [sheetMode, setSheetMode] = useState<SheetMode>('hidden');
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => [SNAP_PEEK, SNAP_COLLAPSED, SNAP_EXPANDED], []);

  const positionInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const firstFix = useRef(false);
  const activeClRef = useRef<number | null>(null);
  const stopEpoch = useRef(0);
  const switchEpoch = useRef(0);
  const selectEpoch = useRef(0);

  useEffect(() => {
    if (sheetMode === 'nearby-lines') {
      sheetRef.current?.snapToIndex(1);
    } else if (sheetMode === 'osm-stop') {
      sheetRef.current?.snapToIndex(2);
    } else if (sheetMode === 'line') {
      sheetRef.current?.close();
    } else {
      sheetRef.current?.snapToIndex(0);
    }
  }, [sheetMode]);

  const doSearchNearby = useCallback(async (lat: number, lon: number) => {
    setCenterOn({ lat, lon, zoom: 15 });
    setNearbyLoading(true);
    setNearbyLines([]);
    setNearbyStops([]);
    setSpStops([]);
    setSelectedLine(null);
    setRouteStops([]);
    setVehicles([]);
    setSheetMode('nearby-lines');
    if (positionInterval.current) clearInterval(positionInterval.current);
    try {
      const lines = await buscarLinhasProximas(lat, lon, 500);
      setNearbyLines(lines);
      getStopsNear(lat, lon, 400)
        .then(setNearbyStops)
        .catch(() => {});
    } catch {
      /* silent — map still shows stops */
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  const startTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    firstFix.current = false;
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 15 },
      (loc) => {
        const coords = { lat: loc.coords.latitude, lon: loc.coords.longitude };
        setUserCoords(coords);
        if (!firstFix.current) {
          firstFix.current = true;
          doSearchNearby(coords.lat, coords.lon);
        }
      },
    );
  }, [doSearchNearby]);

  const centerOnUser = useCallback(() => {
    if (userCoords) setCenterOn({ ...userCoords, zoom: 16 });
  }, [userCoords]);

  const selectLine = useCallback(async (line: SPNearbyLine | SPLine) => {
    const epoch = ++selectEpoch.current;
    const displayCode = getDisplayCode(line);
    Keyboard.dismiss();
    setSelectedLine(line);
    setLineResults([]);
    setSearchQuery('');
    setSheetMode('line');
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

    const [shape1, shape2] = await Promise.all([
      localShape1
        ? Promise.resolve(localShape1)
        : buscarRotaLinha(displayCode, 1).catch(() => null),
      localShape2
        ? Promise.resolve(localShape2)
        : buscarRotaLinha(displayCode, 2).catch(() => null),
    ]);
    if (epoch !== selectEpoch.current) return;

    const shapes = { 1: shape1, 2: shape2 } as {
      1: [number, number][] | null;
      2: [number, number][] | null;
    };
    setRouteShapes(shapes);
    const activeShape = shapes[initialSentido];
    setRouteAvailable(activeShape ? true : null);

    const cls: { 1: number | null; 2: number | null } = { 1: null, 2: null };
    try {
      const dirs = await buscarLinhas(displayCode);
      if (epoch !== selectEpoch.current) return;
      for (const d of dirs as SPLine[]) {
        if (d.sl === 1 || d.sl === 2) cls[d.sl] = d.cl;
      }
    } catch {
      /* fallback */
    }
    if (!cls[initialSentido]) cls[initialSentido] = cl;
    setDirectionCls(cls);

    const activeCl = cls[initialSentido] ?? cl;

    getGtfsStops(displayCode, initialSentido)
      .then((gtfs) => {
        if (epoch !== selectEpoch.current) return;
        if (gtfs && gtfs.length > 0) setSpStops(gtfs);
        else
          buscarParadasPorLinha(activeCl)
            .then(setSpStops)
            .catch(() => {});
      })
      .catch(() => {
        if (epoch !== selectEpoch.current) return;
        buscarParadasPorLinha(activeCl)
          .then(setSpStops)
          .catch(() => {});
      });

    try {
      const pos = await getPosicaoLinha(activeCl);
      if (epoch !== selectEpoch.current) return;
      const vs: SPVehicle[] = (pos.l ?? []).flatMap((l: SPLinePosition) => l.vs ?? []);
      setVehicles(vs.length > 0 ? vs : (pos.vs ?? []));
    } catch {
      /* keep existing */
    }

    if (epoch !== selectEpoch.current) return;
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
  }, []);

  const switchSentido = useCallback(
    (s: 1 | 2) => {
      setSentido(s);
      setRouteStops([]);

      const cl = directionCls[s];
      if (!cl) return;

      const epoch = ++switchEpoch.current;

      const code = selectedLine ? getDisplayCode(selectedLine) : '';
      if (code) {
        getGtfsStops(code, s)
          .then((gtfs) => {
            if (epoch !== switchEpoch.current) return;
            if (gtfs && gtfs.length > 0) setSpStops(gtfs);
            else
              buscarParadasPorLinha(cl)
                .then(setSpStops)
                .catch(() => {});
          })
          .catch(() =>
            buscarParadasPorLinha(cl)
              .then(setSpStops)
              .catch(() => {}),
          );
      } else {
        buscarParadasPorLinha(cl)
          .then(setSpStops)
          .catch(() => {});
      }

      getPosicaoLinha(cl)
        .then((pos) => {
          if (epoch !== switchEpoch.current) return;
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
    [directionCls, selectedLine],
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

  useEffect(() => {
    Promise.allSettled([getMetroStations(), getMetroLines(), getRouteColors()]).then(
      ([stationsRes, linesRes, colorsRes]) => {
        if (stationsRes.status === 'fulfilled') setMetroStations(stationsRes.value);
        if (linesRes.status === 'fulfilled') setMetroLines(linesRes.value);
        if (colorsRes.status === 'fulfilled') setRouteColors(colorsRes.value);
      },
    );
  }, []);

  useEffect(() => {
    activeClRef.current = directionCls[sentido] ?? null;
  }, [directionCls, sentido]);

  // Fetch real-time vehicle positions for all lines at the stop (no chip selected)
  useEffect(() => {
    if (sheetMode !== 'osm-stop' || selectedLine || activeArrivalLine) return;
    if (osmArrivals.length === 0) {
      setVehicles([]);
      return;
    }
    let active = true;
    Promise.all(
      osmArrivals.map(async (l) => {
        const pos = await getPosicaoLinha(l.cl).catch(() => null);
        if (!pos) return [] as SPVehicle[];
        const vs: SPVehicle[] = (pos.l ?? []).flatMap((lp: SPLinePosition) => lp.vs ?? []);
        const src = vs.length > 0 ? vs : (pos.vs ?? []);
        return src.map((v) => ({ ...v, lineCode: l.c, lineColor: routeColors[l.c]?.color }));
      }),
    ).then((batches) => {
      if (!active) return;
      setVehicles(batches.flat());
    });
    return () => {
      active = false;
    };
  }, [osmArrivals, sheetMode, selectedLine, activeArrivalLine, routeColors]);

  // Fetch route polylines for all lines passing through the stop
  useEffect(() => {
    if (sheetMode !== 'osm-stop' || selectedLine || activeArrivalLine) {
      setAllRoutes([]);
      return;
    }
    if (osmArrivals.length === 0) return;
    let active = true;
    Promise.all(
      osmArrivals.map(async (l) => {
        const s: 1 | 2 = l.sl === 1 || l.sl === 2 ? (l.sl as 1 | 2) : 1;
        const coords = await buscarRotaLinha(l.c, s).catch(() => null);
        if (!coords) return null;
        return { coords, color: routeColors[l.c]?.color };
      }),
    ).then((results) => {
      if (!active) return;
      setAllRoutes(results.filter((r): r is NonNullable<typeof r> => r !== null));
    });
    return () => {
      active = false;
    };
  }, [osmArrivals, sheetMode, selectedLine, activeArrivalLine, routeColors]);

  const selectArrivalChip = useCallback(async (line: SPArrivalLine | null, lineColor?: string) => {
    setActiveArrivalLine(line);
    setRouteShapes({ 1: null, 2: null });
    if (!line) return; // useEffects above restore all-routes + all-vehicles view

    const sentidoForLine: 1 | 2 = line.sl === 1 || line.sl === 2 ? (line.sl as 1 | 2) : 1;
    setSentido(sentidoForLine);

    try {
      const pos = await getPosicaoLinha(line.cl);
      const vs: SPVehicle[] = (pos.l ?? []).flatMap((l: SPLinePosition) => l.vs ?? []);
      const result = (vs.length > 0 ? vs : (pos.vs ?? [])).map((v) => ({
        ...v,
        lineCode: line.c,
        lineColor,
      }));
      setVehicles(result);
    } catch {
      /* keep arrivals-derived vehicles */
    }

    const localShape = getGtfsShape(line.c + '-' + sentidoForLine) ?? getGtfsShape(line.c);
    if (localShape) {
      setRouteShapes({ 1: localShape, 2: null });
    } else {
      buscarRotaLinha(line.c, sentidoForLine)
        .then((coords) => {
          if (coords) setRouteShapes({ 1: coords, 2: null });
        })
        .catch(() => {});
    }
  }, []);

  const selectStop = useCallback(async (stop: SPStop) => {
    const epoch = ++stopEpoch.current;
    setSelectedStop(stop);
    setActiveArrivalLine(null);
    setVehicles([]);
    setRouteShapes({ 1: null, 2: null });
    setCenterOn({ lat: stop.py, lon: stop.px, zoom: 17 });
    setSheetMode('osm-stop');
    setOsmArrivalsLoading(true);
    setOsmArrivals([]);
    if (positionInterval.current) clearInterval(positionInterval.current);
    try {
      const cl = activeClRef.current;

      const fetchWith = async (cp: number) => {
        const r = cl ? await getPrevisaoLinhaNaParada(cp, cl) : await getPrevisaoParada(cp);
        return r;
      };

      const startPolling = (cp: number) => {
        positionInterval.current = setInterval(async () => {
          if (stopEpoch.current !== epoch) return;
          const r = await fetchWith(cp).catch(() => null);
          if (r?.p && stopEpoch.current === epoch) setOsmArrivals(r.p.l ?? []);
        }, 15_000);
      };

      // 1. Try stop.cp directly — valid if Olho Vivo returns p != null
      const direct = await fetchWith(stop.cp).catch(() => null);
      if (direct?.p != null) {
        setOsmArrivals(direct.p.l ?? []);
        startPolling(stop.cp);
      } else {
        // 2. Search by stop name
        const pickNearest = (list: SPStop[]): { c: SPStop; d: number } =>
          list.reduce<{ c: SPStop; d: number }>(
            (best, c) => {
              const d = haversineMeters(stop.py, stop.px, c.py, c.px);
              return d < best.d ? { c, d } : best;
            },
            { c: list[0], d: Infinity },
          );

        let resolvedCp: number | null = null;

        const byName = await buscarParadas(stop.np).catch(() => [] as SPStop[]);
        const nearestByName = byName.length > 0 ? pickNearest(byName) : null;
        if (nearestByName && nearestByName.d <= 300) resolvedCp = nearestByName.c.cp;

        // 3. Fallback: search by stop_desc address
        if (!resolvedCp && stop.ed) {
          const addr = stripRef(stop.ed);
          const byAddr = await buscarParadas(addr).catch(() => [] as SPStop[]);
          const nearestByAddr = byAddr.length > 0 ? pickNearest(byAddr) : null;
          if (nearestByAddr && nearestByAddr.d <= 300) {
            resolvedCp = nearestByAddr.c.cp;
          } else {
            const streetOnly = addr.split(',')[0].trim();
            const byStreet = await buscarParadas(streetOnly).catch(() => [] as SPStop[]);
            const nearestByStreet = byStreet.length > 0 ? pickNearest(byStreet) : null;
            if (nearestByStreet && nearestByStreet.d <= 500) resolvedCp = nearestByStreet.c.cp;
          }
        }

        if (resolvedCp) {
          const res = await fetchWith(resolvedCp).catch(() => null);
          setOsmArrivals(res?.p?.l ?? []);
          startPolling(resolvedCp);
        }
      }
    } catch {
      /* no arrivals */
    }
    setOsmArrivalsLoading(false);
  }, []);

  const dismissSheet = useCallback(() => {
    if (positionInterval.current) clearInterval(positionInterval.current);
    setSelectedLine(null);
    setActiveArrivalLine(null);
    setRouteStops([]);
    setVehicles([]);
    setSpStops([]);
    setRouteShapes({ 1: null, 2: null });
    setSentido(1);
    setSelectedStop(null);
    setOsmArrivals([]);
    setSheetMode('nearby-lines');
    sheetRef.current?.snapToIndex(1);
  }, []);

  const lineCode = selectedLine ? getDisplayCode(selectedLine) : '';
  const lineDest = selectedLine
    ? sentido === 1
      ? `${selectedLine.lt1} → ${selectedLine.lt0}`
      : `${selectedLine.lt0} → ${selectedLine.lt1}`
    : '';
  const showRoute =
    sheetMode === 'line' || (sheetMode === 'osm-stop' && (!!selectedLine || !!activeArrivalLine));
  const displayLineCode =
    sheetMode === 'osm-stop' && activeArrivalLine ? activeArrivalLine.c : lineCode;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.searchWrapper}>
        <View style={styles.topSearchBar}>
          <TextInput
            style={styles.topSearchInput}
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
              style={styles.topSearchClear}
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
          <View style={styles.searchDropdown}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {searchLoading ? (
                <ActivityIndicator color={theme.accent} style={{ margin: 16 }} />
              ) : lineResults.length === 0 ? (
                <Text style={styles.dropdownEmpty}>Nenhuma linha encontrada</Text>
              ) : (
                Object.values(
                  lineResults.reduce<Record<string, SPLine[]>>((acc, l) => {
                    const key = `${l.lt}-${l.tl}`;
                    (acc[key] ??= []).push(l);
                    return acc;
                  }, {}),
                ).map((group) => {
                  const sorted = [...group].sort((a, b) => a.sl - b.sl);
                  const ref = sorted[0];
                  const code = `${ref.lt}-${ref.tl}`;
                  return (
                    <View key={code} style={styles.dropdownGroup}>
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
                })
              )}
            </ScrollView>
          </View>
        )}
      </View>
      <View style={styles.mapWrapper}>
        <BusMap
          userCoords={userCoords}
          stops={[]}
          osmStops={[]}
          spStops={
            sheetMode === 'line' || (sheetMode === 'osm-stop' && !!selectedLine)
              ? spStops
              : nearbyStops
          }
          vehicles={vehicles}
          routeStops={showRoute ? routeStops : []}
          routeLineCode={showRoute ? displayLineCode : null}
          routeCoords={showRoute ? (routeShapes[sentido] ?? null) : null}
          routeColor={showRoute ? (routeColors[displayLineCode]?.color ?? null) : null}
          fitRoute={sheetMode === 'line'}
          allRoutes={allRoutes.length > 0 ? allRoutes : null}
          selectedStopId={selectedStop?.cp ?? null}
          metroStations={metroStations}
          metroLines={metroLines}
          centerOn={centerOn}
          onSpStopPress={selectStop}
          onNoRoute={() => setRouteAvailable(false)}
        />

        <View style={styles.btnStack}>
          <Pressable
            style={[styles.locateBtn, !userCoords && styles.mapBtnDisabled]}
            onPress={centerOnUser}
            disabled={!userCoords}>
            <IcoLocate size={22} color={userCoords ? theme.accent : theme.textFaint} />
          </Pressable>
        </View>
      </View>

      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandleIndicator}>
        {(sheetMode === 'nearby-lines' || (sheetMode === 'osm-stop' && selectedStop)) && (
          <>
            <View style={styles.sheetHeader}>
              {sheetMode === 'osm-stop' && selectedLine ? (
                <View style={styles.sheetTitleRow}>
                  <Pressable
                    onPress={() => setSheetMode('line')}
                    hitSlop={12}
                    style={styles.backBtn}>
                    <Text style={styles.backBtnText}>‹</Text>
                    <Text style={styles.backBtnLabel}>{getDisplayCode(selectedLine)}</Text>
                  </Pressable>
                  <Text style={[styles.sheetTitle, { paddingBottom: 8 }]} numberOfLines={1}>
                    {selectedStop?.np || 'Parada'}
                  </Text>
                </View>
              ) : sheetMode === 'osm-stop' ? (
                <View style={styles.sheetTitleRow}>
                  <Text style={[styles.sheetTitle, { paddingBottom: 8 }]} numberOfLines={1}>
                    {selectedStop?.np || 'Parada'}
                  </Text>
                  <Pressable onPress={dismissSheet} hitSlop={16} style={{ paddingBottom: 8 }}>
                    <Text style={styles.sheetClose}>✕</Text>
                  </Pressable>
                </View>
              ) : (
                <Text
                  style={[styles.sheetTitle, { paddingHorizontal: 16, paddingBottom: 8 }]}
                  numberOfLines={1}>
                  {nearbyLoading ? 'Buscando linhas…' : `${nearbyLines.length} linhas próximas`}
                </Text>
              )}
            </View>

            {sheetMode === 'osm-stop' && selectedStop && (
              <BottomSheetScrollView
                style={styles.sheetScroll}
                showsVerticalScrollIndicator={false}>
                {selectedStop.ed ? (
                  <Text style={styles.sheetSub}>{stripRef(selectedStop.ed)}</Text>
                ) : null}
                {userCoords && (
                  <Text style={styles.sheetSub}>
                    {Math.round(
                      haversineMeters(
                        userCoords.lat,
                        userCoords.lon,
                        selectedStop.py,
                        selectedStop.px,
                      ),
                    )}{' '}
                    m de você
                  </Text>
                )}

                {osmArrivalsLoading ? (
                  <ActivityIndicator color={theme.accent} style={{ marginTop: 20 }} />
                ) : osmArrivals.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Parada não encontrada no sistema do Olho Vivo.
                  </Text>
                ) : (
                  <>
                    <View style={styles.chipsWrap}>
                      {osmArrivals.map((line, i) => {
                        const active = activeArrivalLine?.c === line.c;
                        const rc = routeColors[line.c];
                        const chipBg = rc ? rc.color : active ? theme.accent : theme.surfaceElev;
                        const chipText = rc ? rc.textColor : active ? theme.onAccent : theme.accent;
                        return (
                          <Pressable
                            key={line.c ?? i}
                            onPress={() => selectArrivalChip(active ? null : line, rc?.color)}
                            style={[
                              styles.lineChip,
                              {
                                backgroundColor: chipBg,
                                borderColor: chipBg,
                                opacity: active ? 1 : 0.7,
                              },
                            ]}>
                            <Text style={[styles.lineChipText, { color: chipText }]}>{line.c}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={styles.sectionLabel}>PRÓXIMAS CHEGADAS</Text>

                    {(activeArrivalLine
                      ? osmArrivals.filter((l) => l.c === activeArrivalLine.c)
                      : osmArrivals
                    )
                      .flatMap((line) => (line.vs ?? []).map((v) => ({ v, line })))
                      .sort((a, b) => a.v.t.localeCompare(b.v.t))
                      .map(({ v, line }, i) => {
                        const dest = line.sl === 1 ? line.lt0 : line.lt1;
                        const rel = toRelativeTime(v.t);
                        return (
                          <View key={`${line.c}-${v.p}-${i}`} style={styles.gmRow}>
                            <View style={styles.gmLeft}>
                              <View
                                style={[
                                  styles.gmBadge,
                                  routeColors[line.c] && {
                                    backgroundColor: routeColors[line.c].color,
                                  },
                                ]}>
                                <Text
                                  style={[
                                    styles.gmBadgeText,
                                    routeColors[line.c] && { color: routeColors[line.c].textColor },
                                  ]}>
                                  {line.c}
                                </Text>
                              </View>
                              <Text style={styles.gmDest} numberOfLines={1}>
                                {dest}
                              </Text>
                            </View>
                            <View style={styles.gmRight}>
                              {v.a && <Text style={styles.gmA11y}>♿</Text>}
                              <Text style={[styles.gmTime, rel === 'Agora' && styles.gmTimeNow]}>
                                {rel}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                  </>
                )}
              </BottomSheetScrollView>
            )}

            {sheetMode === 'nearby-lines' && (
              <BottomSheetScrollView
                style={styles.sheetScroll}
                showsVerticalScrollIndicator={false}>
                {nearbyLoading ? (
                  <View style={styles.skeletonSheet}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <View key={i} style={styles.skeletonSheetCard} />
                    ))}
                  </View>
                ) : nearbyLines.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Nenhuma linha encontrada próxima. Tente novamente.
                  </Text>
                ) : null}
                {!nearbyLoading &&
                  Object.entries(
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
                            <Pressable
                              key={l.cl}
                              style={styles.dirPickBtn}
                              onPress={() => selectLine(l)}>
                              <Text style={styles.dirPickLabel}>
                                {l.sl === 1 ? 'Ida' : 'Volta'}
                              </Text>
                              <Text style={styles.dirPickDest} numberOfLines={1}>
                                → {l.sl === 1 ? l.lt0 : l.lt1}
                              </Text>
                              <Text style={styles.dirPickMeta}>{Math.round(l.nearestBusM)} m</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    );
                  })}
              </BottomSheetScrollView>
            )}
          </>
        )}
      </BottomSheet>

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

  searchWrapper: {
    zIndex: 99,
    elevation: 99,
  },
  topSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    height: 56,
  },
  topSearchInput: {
    flex: 1,
    backgroundColor: theme.surfaceElev,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusCard,
    paddingHorizontal: 14,
    paddingRight: 40,
    paddingVertical: 10,
    color: theme.text,
    fontSize: 14,
  },
  topSearchClear: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearText: { color: theme.textDim, fontSize: 15 },
  searchDropdown: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    maxHeight: 380,
    backgroundColor: theme.surface,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: theme.border,
    zIndex: 100,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
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
    top: 12,
    right: 12,
  },

  locateBtn: {
    backgroundColor: `${theme.surface}f0`,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 10,
  },
  mapBtnDisabled: { opacity: 0.4 },

  sheetBg: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetHandleIndicator: {
    backgroundColor: theme.border,
    width: 36,
  },
  sheetHeader: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    width: '100%',
    gap: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: theme.border,
    marginRight: 4,
    paddingBottom: 8,
  },
  backBtnText: { color: theme.accent, fontSize: 22, lineHeight: 22, fontWeight: '300' },
  backBtnLabel: { color: theme.accent, fontSize: 12, fontWeight: '700' },
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

  skeletonSheet: { paddingTop: 8, gap: 12 },
  skeletonSheetCard: {
    height: 76,
    borderRadius: 10,
    backgroundColor: theme.surfaceElev,
    opacity: 0.6,
  },

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

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    marginBottom: 4,
  },
  lineChip: {
    backgroundColor: theme.surfaceElev,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lineChipText: { color: theme.accent, fontSize: 11, fontWeight: '700' },

  gmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 10,
  },
  gmLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  gmBadge: {
    backgroundColor: theme.accent,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 72,
    alignItems: 'center',
  },
  gmBadgeText: { color: theme.onAccent, fontWeight: '800', fontSize: 12 },
  gmDest: { color: theme.textDim, fontSize: 12, flex: 1 },
  gmRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gmA11y: { fontSize: 13 },
  gmTime: { color: theme.text, fontWeight: '700', fontSize: 15, minWidth: 48, textAlign: 'right' },
  gmTimeNow: { color: theme.accent },
});
