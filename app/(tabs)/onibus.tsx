import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { router } from 'expo-router';
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
import { useRuntimeTheme } from '@/context/RuntimeThemeContext';
import type { AppRuntimeTheme } from '@/constants/theme';
import type {
  SPLine,
  SPNearbyLine,
  SPVehicle,
  SPPositionResponse,
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

// Posicao/Linha returns vehicles either nested under `l[]` (grouped by line) or
// flat under `vs[]`. Normalize to a single list.
function parseVehicles(pos: SPPositionResponse): SPVehicle[] {
  const nested = (pos.l ?? []).flatMap((l) => l.vs ?? []);
  return nested.length > 0 ? nested : (pos.vs ?? []);
}

function vehiclesFromArrivals(lines: SPArrivalLine[], colors: RouteColorMap): SPVehicle[] {
  return lines.flatMap((l) =>
    (l.vs ?? [])
      .filter((v) => v.py != null && v.px != null)
      .map((v) => ({
        p: v.p,
        a: v.a,
        py: v.py!,
        px: v.px!,
        ta: v.ta,
        lineCode: l.c,
        lineColor: colors[l.c]?.color,
      })),
  );
}

function routeChipStyle(
  code: string,
  colors: RouteColorMap,
  rt: AppRuntimeTheme,
): { bg: string; text: string } {
  const rc = colors[code];
  return rc ? { bg: rc.color, text: rc.textColor } : { bg: rt.accent, text: rt.onAccent };
}

function SheetHeader({
  title,
  onBack,
  backLabel,
  onClose,
}: {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  onClose?: () => void;
}) {
  const { rt } = useRuntimeTheme();
  return (
    <View style={[styles.sheetHeader, { borderBottomColor: rt.border }]}>
      <View style={[styles.sheetTitleRow, { paddingVertical: 8 }]}>
        {onBack && backLabel && (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={[styles.backBtn, { borderRightColor: rt.border }]}>
            <Text style={[styles.backBtnText, { color: rt.accent }]}>‹</Text>
            <Text style={[styles.backBtnLabel, { color: rt.accent }]}>{backLabel}</Text>
          </Pressable>
        )}
        <Text style={[styles.sheetTitle, { color: rt.text }]} numberOfLines={1}>
          {title}
        </Text>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={16}>
            <Text style={[styles.sheetClose, { color: rt.textDim }]}>✕</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
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
  const { rt } = useRuntimeTheme();
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

  // Polls live vehicle positions for a line class every 10s. Replaces any prior
  // interval. Optional mapFn decorates each vehicle (e.g. line code/color).
  const startVehiclePolling = useCallback((cl: number, mapFn?: (v: SPVehicle) => SPVehicle) => {
    if (positionInterval.current) clearInterval(positionInterval.current);
    positionInterval.current = setInterval(async () => {
      try {
        const pos = await getPosicaoLinha(cl);
        const list = parseVehicles(pos);
        setVehicles(mapFn ? list.map(mapFn) : list);
      } catch {
        /* skip */
      }
    }, 10_000);
  }, []);

  const selectLine = useCallback(
    async (line: SPNearbyLine | SPLine) => {
      const epoch = ++selectEpoch.current;
      const displayCode = getDisplayCode(line);
      Keyboard.dismiss();
      setSelectedLine(line);
      setLineResults([]);
      setSearchQuery('');
      setSheetMode('line');
      const initialSentido: 1 | 2 = 'sl' in line ? (line as SPNearbyLine).sl : 1;
      setLineLoading(true);

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
      setRouteAvailable(activeShape ? true : false);

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

      const setStopsGuarded = (s: SPStop[]) => {
        if (epoch === selectEpoch.current) setSpStops(s);
      };
      getGtfsStops(displayCode, initialSentido)
        .then((gtfs) => {
          if (epoch !== selectEpoch.current) return;
          if (gtfs && gtfs.length > 0) setSpStops(gtfs);
          else
            buscarParadasPorLinha(activeCl)
              .then(setStopsGuarded)
              .catch(() => {});
        })
        .catch(() => {
          buscarParadasPorLinha(activeCl)
            .then(setStopsGuarded)
            .catch(() => {});
        });

      try {
        const pos = await getPosicaoLinha(activeCl);
        if (epoch !== selectEpoch.current) return;
        setVehicles(parseVehicles(pos));
      } catch {
        /* keep existing */
      }

      if (epoch !== selectEpoch.current) return;
      setLineLoading(false);

      startVehiclePolling(activeCl);
    },
    [startVehiclePolling],
  );

  const switchSentido = useCallback(
    (s: 1 | 2) => {
      setSentido(s);

      const cl = directionCls[s];
      if (!cl) return;

      const epoch = ++switchEpoch.current;

      const setStopsGuarded = (st: SPStop[]) => {
        if (epoch === switchEpoch.current) setSpStops(st);
      };
      const code = selectedLine ? getDisplayCode(selectedLine) : '';
      if (code) {
        getGtfsStops(code, s)
          .then((gtfs) => {
            if (epoch !== switchEpoch.current) return;
            if (gtfs && gtfs.length > 0) setSpStops(gtfs);
            else
              buscarParadasPorLinha(cl)
                .then(setStopsGuarded)
                .catch(() => {});
          })
          .catch(() =>
            buscarParadasPorLinha(cl)
              .then(setStopsGuarded)
              .catch(() => {}),
          );
      } else {
        buscarParadasPorLinha(cl)
          .then(setStopsGuarded)
          .catch(() => {});
      }

      getPosicaoLinha(cl)
        .then((pos) => {
          if (epoch !== switchEpoch.current) return;
          setVehicles(parseVehicles(pos));
        })
        .catch(() => {});

      startVehiclePolling(cl);
    },
    [directionCls, selectedLine, startVehiclePolling],
  );

  const handleLinePress = useCallback(
    async (lineCode: string) => {
      const results = await buscarLinhas(lineCode).catch(() => [] as SPLine[]);
      if (results.length > 0) selectLine(results[0]);
    },
    [selectLine],
  );

  const handleMetroLinePress = useCallback((lineId: string) => {
    router.push(`/line/${lineId}`);
  }, []);

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

  // Derive vehicle positions from arrival predictions — no extra API call needed,
  // the prediction endpoint already includes current vehicle coordinates.
  useEffect(() => {
    if (sheetMode !== 'osm-stop' || selectedLine || activeArrivalLine) return;
    setVehicles(vehiclesFromArrivals(osmArrivals, routeColors));
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
      setVehicles(parseVehicles(pos).map((v) => ({ ...v, lineCode: line.c, lineColor })));
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
      // Read the active line class fresh on each call so a direction switch
      // mid-poll filters arrivals to the currently-selected line.
      const fetchWith = async (cp: number) => {
        const cl = activeClRef.current;
        return cl ? getPrevisaoLinhaNaParada(cp, cl) : getPrevisaoParada(cp);
      };

      const startPolling = (cp: number) => {
        positionInterval.current = setInterval(async () => {
          if (stopEpoch.current !== epoch) return;
          const r = await fetchWith(cp).catch(() => null);
          if (r?.p && stopEpoch.current === epoch) setOsmArrivals((r.p.l ?? []).filter(Boolean));
        }, 15_000);
      };

      // 1. Try stop.cp directly — valid if Olho Vivo returns p != null
      const direct = await fetchWith(stop.cp).catch(() => null);
      if (direct?.p != null) {
        setOsmArrivals((direct.p.l ?? []).filter(Boolean));
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
          setOsmArrivals((res?.p?.l ?? []).filter(Boolean));
          startPolling(resolvedCp);
        }
      }
    } catch {
      /* no arrivals */
    }
    if (stopEpoch.current === epoch) setOsmArrivalsLoading(false);
  }, []);

  const onNoRoute = useCallback(() => setRouteAvailable(false), []);

  const dismissSheet = useCallback(() => {
    if (positionInterval.current) clearInterval(positionInterval.current);
    setSelectedLine(null);
    setActiveArrivalLine(null);

    setVehicles([]);
    setSpStops([]);
    setRouteShapes({ 1: null, 2: null });
    setDirectionCls({ 1: null, 2: null });
    setSentido(1);
    setSelectedStop(null);
    setOsmArrivals([]);
    setSheetMode('nearby-lines');
    sheetRef.current?.snapToIndex(1);
  }, []);

  const handleMapPress = useCallback(() => {
    if (sheetMode === 'osm-stop') {
      if (selectedLine) {
        setSheetMode('line');
      } else {
        dismissSheet();
      }
    }
  }, [sheetMode, selectedLine, dismissSheet]);

  const nearbyStopsFiltered = useMemo(
    () =>
      nearbyStops.filter(
        (stop) =>
          !metroStations.some((ms) => haversineMeters(stop.py, stop.px, ms.lat, ms.lon) < 50),
      ),
    [nearbyStops, metroStations],
  );

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
    <SafeAreaView style={[styles.root, { backgroundColor: rt.bg }]} edges={['top']}>
      <View style={styles.searchWrapper}>
        <View
          style={[
            styles.topSearchBar,
            { backgroundColor: rt.surface, borderBottomColor: rt.border },
          ]}>
          <TextInput
            style={[
              styles.topSearchInput,
              { backgroundColor: rt.surface, borderColor: rt.border, color: rt.text },
            ]}
            placeholder="Buscar linha (ex: 8000-10)"
            placeholderTextColor={rt.textFaint}
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
              <Text style={[styles.searchClearText, { color: rt.textDim }]}>✕</Text>
            </Pressable>
          )}
        </View>
        {searchQuery.trim().length >= 2 && (
          <View
            style={[
              styles.searchDropdown,
              { backgroundColor: rt.surface, borderColor: rt.border },
            ]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {searchLoading ? (
                <ActivityIndicator color={rt.accent} style={{ margin: 16 }} />
              ) : lineResults.length === 0 ? (
                <Text style={[styles.dropdownEmpty, { color: rt.textFaint }]}>
                  Nenhuma linha encontrada
                </Text>
              ) : (
                Object.values(
                  lineResults.reduce<Record<string, SPLine[]>>((acc, l) => {
                    const key = `${l.lt}-${l.tl}`;
                    (acc[key] ??= []).push(l);
                    return acc;
                  }, {}),
                ).map((group, i, arr) => {
                  const sorted = [...group].sort((a, b) => a.sl - b.sl);
                  const ref = sorted[0];
                  const code = `${ref.lt}-${ref.tl}`;
                  return (
                    <View
                      key={code}
                      style={[
                        styles.dropdownGroup,
                        { borderBottomColor: rt.border },
                        i === arr.length - 1 && styles.dropdownGroupLast,
                      ]}>
                      <View style={styles.dropdownGroupHeader}>
                        <Text style={[styles.dropdownCode, { color: rt.accent }]}>{code}</Text>
                        <Text
                          style={[styles.dropdownName, { color: rt.textDim }]}
                          numberOfLines={1}>
                          {ref.lt0} ↔ {ref.lt1}
                        </Text>
                      </View>
                      <View style={styles.dropdownDirRow}>
                        {sorted.map((l) => (
                          <Pressable
                            key={l.cl}
                            style={[
                              styles.dropdownDirBtn,
                              { backgroundColor: rt.surface, borderColor: rt.border },
                            ]}
                            onPress={() => selectLine(l)}>
                            <Text style={[styles.dropdownDirLabel, { color: rt.accent }]}>
                              {l.sl === 1 ? 'Ida' : 'Volta'}
                            </Text>
                            <Text
                              style={[styles.dropdownDirDest, { color: rt.text }]}
                              numberOfLines={1}>
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
          spStops={
            sheetMode === 'line' || (sheetMode === 'osm-stop' && !!selectedLine)
              ? spStops
              : nearbyStopsFiltered
          }
          vehicles={vehicles}
          routeCoords={showRoute ? (routeShapes[sentido] ?? null) : null}
          routeColor={showRoute ? (routeColors[displayLineCode]?.color ?? null) : null}
          fitRoute={sheetMode === 'line'}
          allRoutes={allRoutes.length > 0 ? allRoutes : null}
          selectedStopId={selectedStop?.cp ?? null}
          metroStations={metroStations}
          metroLines={metroLines}
          centerOn={centerOn}
          onSpStopPress={selectStop}
          onLinePress={handleLinePress}
          onMetroLinePress={handleMetroLinePress}
          onNoRoute={onNoRoute}
          onMapPress={handleMapPress}
        />

        <View style={styles.btnStack}>
          <Pressable
            style={[
              styles.locateBtn,
              { backgroundColor: `${rt.surface}f0`, borderColor: rt.border },
              !userCoords && styles.mapBtnDisabled,
            ]}
            onPress={centerOnUser}
            disabled={!userCoords}>
            <IcoLocate size={22} color={userCoords ? rt.accent : rt.textFaint} />
          </Pressable>
        </View>
      </View>

      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={[styles.sheetBg, { backgroundColor: rt.surface }]}
        handleIndicatorStyle={[styles.sheetHandleIndicator, { backgroundColor: rt.border }]}>
        {/* ── Linhas próximas ──────────────────────────────────────────────── */}
        {sheetMode === 'nearby-lines' && (
          <>
            <SheetHeader
              title={nearbyLoading ? 'Buscando linhas…' : `${nearbyLines.length} linhas próximas`}
            />
            <BottomSheetScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              {nearbyLoading ? (
                <View style={styles.skeletonSheet}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <View
                      key={i}
                      style={[styles.skeletonSheetCard, { backgroundColor: rt.border }]}
                    />
                  ))}
                </View>
              ) : nearbyLines.length === 0 ? (
                <Text style={[styles.emptyText, { color: rt.textFaint }]}>
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
                  const cs = routeChipStyle(code, routeColors, rt);
                  return (
                    <View key={code} style={[styles.lineGroup, { borderBottomColor: rt.border }]}>
                      <View style={styles.lineGroupHeader}>
                        <View style={[styles.lineBadge, { backgroundColor: cs.bg }]}>
                          <Text style={[styles.lineBadgeText, { color: cs.text }]}>{code}</Text>
                        </View>
                        <Text
                          style={[styles.lineGroupRoute, { color: rt.textDim }]}
                          numberOfLines={1}>
                          {ref.lt0} ↔ {ref.lt1}
                        </Text>
                      </View>
                      <View style={styles.dirBtnRow}>
                        {sorted.map((l) => (
                          <Pressable
                            key={l.cl}
                            style={[
                              styles.dirPickBtn,
                              { backgroundColor: rt.surface, borderColor: rt.border },
                            ]}
                            onPress={() => selectLine(l)}>
                            <Text style={[styles.dirPickLabel, { color: rt.accent }]}>
                              {l.sl === 1 ? 'Ida' : 'Volta'}
                            </Text>
                            <Text
                              style={[styles.dirPickDest, { color: rt.text }]}
                              numberOfLines={1}>
                              → {l.sl === 1 ? l.lt0 : l.lt1}
                            </Text>
                            <Text style={[styles.dirPickMeta, { color: rt.textFaint }]}>
                              {Math.round(l.nearestBusM)} m
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  );
                })}
            </BottomSheetScrollView>
          </>
        )}

        {/* ── Parada selecionada ───────────────────────────────────────────── */}
        {sheetMode === 'osm-stop' && selectedStop && (
          <>
            <SheetHeader
              title={selectedStop.np || 'Parada'}
              onBack={selectedLine ? () => setSheetMode('line') : undefined}
              backLabel={selectedLine ? getDisplayCode(selectedLine) : undefined}
              onClose={selectedLine ? undefined : dismissSheet}
            />
            <BottomSheetScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              {selectedStop.ed && (
                <Text style={[styles.sheetSub, { color: rt.textDim }]}>
                  {stripRef(selectedStop.ed)}
                </Text>
              )}
              {userCoords && (
                <Text style={[styles.sheetSub, { color: rt.textDim }]}>
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
                <ActivityIndicator color={rt.accent} style={{ marginTop: 20 }} />
              ) : osmArrivals.length === 0 ? (
                <Text style={[styles.emptyText, { color: rt.textFaint }]}>
                  Parada não encontrada no sistema do Olho Vivo.
                </Text>
              ) : (
                <>
                  <View style={styles.chipsWrap}>
                    {osmArrivals.map((line, i) => {
                      const active = activeArrivalLine?.c === line.c;
                      const rc = routeColors[line.c];
                      const chipBg = rc?.color ?? (active ? rt.accent : rt.surface);
                      const chipText = rc?.textColor ?? (active ? rt.onAccent : rt.accent);
                      return (
                        <Pressable
                          key={`${line.c ?? i}-${line.sl}`}
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

                  <Text style={[styles.sectionLabel, { color: rt.textFaint }]}>
                    PRÓXIMAS CHEGADAS
                  </Text>

                  {(activeArrivalLine
                    ? osmArrivals.filter((l) => l.c === activeArrivalLine.c)
                    : osmArrivals
                  )
                    .flatMap((line) => (line.vs ?? []).map((v) => ({ v, line })))
                    .sort((a, b) => a.v.t.localeCompare(b.v.t))
                    .map(({ v, line }, i) => {
                      const dest = line.sl === 1 ? line.lt0 : line.lt1;
                      const rel = toRelativeTime(v.t);
                      const gcs = routeChipStyle(line.c, routeColors, rt);
                      return (
                        <View
                          key={`${line.c}-${v.p}-${i}`}
                          style={[styles.gmRow, { borderBottomColor: rt.border }]}>
                          <View style={styles.gmLeft}>
                            <View style={[styles.gmBadge, { backgroundColor: gcs.bg }]}>
                              <Text style={[styles.gmBadgeText, { color: gcs.text }]}>
                                {line.c}
                              </Text>
                            </View>
                            <Text style={[styles.gmDest, { color: rt.textDim }]} numberOfLines={1}>
                              {dest}
                            </Text>
                          </View>
                          <View style={styles.gmRight}>
                            {v.a && <Text style={styles.gmA11y}>♿</Text>}
                            <Text
                              style={[
                                styles.gmTime,
                                { color: rt.text },
                                rel === 'Agora' && { color: rt.accent },
                              ]}>
                              {rel}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                </>
              )}
            </BottomSheetScrollView>
          </>
        )}
      </BottomSheet>

      {sheetMode === 'line' && selectedLine && (
        <View
          style={[styles.linePanel, { backgroundColor: rt.surface, borderTopColor: rt.border }]}>
          <View style={styles.linePanelHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.linePanelCode, { color: rt.accent }]}>{lineCode}</Text>
              <Text style={[styles.linePanelName, { color: rt.textDim }]} numberOfLines={1}>
                {lineDest}
              </Text>
            </View>
            {lineLoading ? (
              <ActivityIndicator size="small" color={rt.accent} />
            ) : (
              <Pressable onPress={dismissSheet} hitSlop={16}>
                <Text style={[styles.sheetClose, { color: rt.textDim }]}>✕</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.sentidoRow}>
            <Pressable
              style={[
                styles.sentidoBtn,
                { backgroundColor: rt.surface, borderColor: rt.border },
                sentido === 1 && { backgroundColor: rt.accent, borderColor: rt.accent },
              ]}
              onPress={() => switchSentido(1)}
              disabled={!routeShapes[1]}>
              <Text
                style={[
                  styles.sentidoBtnText,
                  { color: rt.textDim },
                  sentido === 1 && { color: rt.onAccent },
                ]}>
                Ida
              </Text>
              <Text
                style={[
                  styles.sentidoDest,
                  { color: rt.textFaint },
                  sentido === 1 && { color: rt.onAccent, opacity: 0.85 },
                ]}
                numberOfLines={1}>
                {selectedLine.lt0}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.sentidoBtn,
                { backgroundColor: rt.surface, borderColor: rt.border },
                sentido === 2 && { backgroundColor: rt.accent, borderColor: rt.accent },
              ]}
              onPress={() => switchSentido(2)}
              disabled={!routeShapes[2]}>
              <Text
                style={[
                  styles.sentidoBtnText,
                  { color: rt.textDim },
                  sentido === 2 && { color: rt.onAccent },
                ]}>
                Volta
              </Text>
              <Text
                style={[
                  styles.sentidoDest,
                  { color: rt.textFaint },
                  sentido === 2 && { color: rt.onAccent, opacity: 0.85 },
                ]}
                numberOfLines={1}>
                {selectedLine.lt1}
              </Text>
            </Pressable>
          </View>
          {routeAvailable === false && (
            <Text style={[styles.emptyText, { color: rt.textFaint, marginTop: 8 }]}>
              Trajeto não mapeado no GeoServer SPTrans.
            </Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
    borderBottomWidth: 1,
    height: 56,
  },
  topSearchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: theme.radiusCard,
    paddingHorizontal: 14,
    paddingRight: 40,
    paddingVertical: 10,
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
  searchClearText: { fontSize: 15 },
  searchDropdown: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    maxHeight: 380,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderTopWidth: 0,
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
  },
  dropdownGroupLast: {
    borderBottomWidth: 0,
  },
  dropdownGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dropdownCode: { fontWeight: '800', fontSize: 13 },
  dropdownName: { fontSize: 11, flex: 1 },
  dropdownDirRow: { flexDirection: 'row', gap: 6 },
  dropdownDirBtn: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  dropdownDirLabel: { fontSize: 10, fontWeight: '700' },
  dropdownDirDest: { fontSize: 11, marginTop: 1 },
  dropdownEmpty: { fontSize: 13, margin: 16, textAlign: 'center' },

  btnStack: {
    position: 'absolute',
    top: 12,
    right: 12,
  },

  locateBtn: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  mapBtnDisabled: { opacity: 0.4 },

  sheetBg: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetHandleIndicator: {
    width: 36,
  },
  sheetHeader: {
    paddingBottom: 8,
    borderBottomWidth: 1,
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
    marginRight: 4,
    paddingBottom: 8,
  },
  backBtnText: { fontSize: 22, lineHeight: 22, fontWeight: '300' },
  backBtnLabel: { fontSize: 12, fontWeight: '700' },
  sheetTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  sheetClose: { fontSize: 18, paddingLeft: 16 },
  sheetSub: { fontSize: 12, marginHorizontal: 16, marginTop: 6 },
  sheetScroll: { paddingHorizontal: 16 },

  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
  },

  lineGroup: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  lineGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  lineBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 56,
    alignItems: 'center',
  },
  lineBadgeText: { fontWeight: '800', fontSize: 13 },
  lineGroupRoute: { fontSize: 11, flex: 1 },

  dirBtnRow: { flexDirection: 'row', gap: 8 },
  dirPickBtn: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
  },
  dirPickLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  dirPickDest: { fontSize: 12, fontWeight: '600' },
  dirPickMeta: { fontSize: 10, marginTop: 3 },

  emptyText: { fontSize: 12, marginTop: 10 },

  skeletonSheet: { paddingTop: 8, gap: 12 },
  skeletonSheetCard: {
    height: 76,
    borderRadius: 10,
    opacity: 0.6,
  },

  linePanel: {
    borderTopWidth: 1,
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
  linePanelCode: { fontSize: 20, fontWeight: '800' },
  linePanelName: { fontSize: 12, marginTop: 2 },

  sentidoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sentidoBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  sentidoBtnActive: {},
  sentidoBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sentidoBtnTextActive: {},
  sentidoDest: {
    fontSize: 10,
    marginTop: 2,
  },
  sentidoDestActive: {},

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    marginBottom: 4,
  },
  lineChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lineChipText: { fontSize: 11, fontWeight: '700' },

  gmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  gmLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  gmBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 72,
    alignItems: 'center',
  },
  gmBadgeText: { fontWeight: '800', fontSize: 12 },
  gmDest: { fontSize: 12, flex: 1 },
  gmRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gmA11y: { fontSize: 13 },
  gmTime: { fontWeight: '700', fontSize: 15, minWidth: 48, textAlign: 'right' },
  gmTimeNow: {},
});
