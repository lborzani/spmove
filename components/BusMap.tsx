import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import {
  Map as MapView,
  Camera,
  Marker,
  GeoJSONSource,
  RasterSource,
  Layer,
  Images,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { LocateFixed } from 'lucide-react-native';
import Svg, {
  Circle as SvgCircle,
  Rect as SvgRect,
  Path as SvgPath,
  G as SvgG,
} from 'react-native-svg';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { SPStop, SPVehicle, MetroStation, MetroLineData } from '@/constants/sptransTypes';

interface BusMapProps {
  userCoords?: { lat: number; lon: number } | null;
  spStops?: SPStop[];
  vehicles?: SPVehicle[];
  routeCoords?: [number, number][] | null;
  routeColor?: string | null;
  fitRoute?: boolean;
  allRoutes?: { coords: [number, number][]; color?: string }[] | null;
  selectedStopId?: number | null;
  metroStations?: MetroStation[];
  metroLines?: MetroLineData[];
  centerOn?: { lat: number; lon: number; zoom?: number } | null;
  onSpStopPress?: (stop: SPStop) => void;
  onLinePress?: (lineCode: string) => void;
  onMetroLinePress?: (lineId: string) => void;
  onNoRoute?: () => void;
  onMapPress?: () => void;
}

// Blank style avoids HTTP/2 stream-reset issues on Android with the CARTO vector style endpoint.
const BLANK_STYLE = { version: 8 as const, sources: {}, layers: [] };
const CARTO_TILES = ['https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'];
const INITIAL_CENTER: [number, number] = [-46.6333, -23.5505];
const INITIAL_ZOOM = 13;
const SHOW_STOPS_ZOOM = 15;
const SHOW_METRO_ZOOM = 13;
const BUS_ICON_SIZE = 56;
// toDataURL captures at 1x (BUS_ICON_SIZE px); icon-size is a direct px→dp multiplier
const TARGET_STOP_DP = 10;
const STOP_ICON_SIZE = TARGET_STOP_DP / BUS_ICON_SIZE;
const STOP_ICON_SIZE_SELECTED = (TARGET_STOP_DP * 1.4) / BUS_ICON_SIZE;
// Derived from calibrated STOP_ICON_SIZE — same device-capture factor applies automatically
const METRO_ICON_SIZE = STOP_ICON_SIZE * 0.7; // matches vehicle-icon ratio inside its circle
const CPTM_ICON_SIZE = STOP_ICON_SIZE; // same as bus stop; adjust if needed

// Our route coords are [lat, lon]; GeoJSON/MapLibre needs [lon, lat]
function toGeoCoords(pairs: [number, number][]): number[][] {
  return pairs.map(([lat, lon]) => [lon, lat]);
}

// [west, south, east, north] from [lat, lon] pairs
function toBounds(coords: [number, number][]): [number, number, number, number] {
  let minLat = Infinity,
    maxLat = -Infinity,
    minLon = Infinity,
    maxLon = -Infinity;
  for (const [lat, lon] of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  return [minLon, minLat, maxLon, maxLat];
}

function lineFC(
  items: { coords: [number, number][]; color?: string; id?: string | number }[],
): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: items
      .filter((r) => r.coords.length >= 2)
      .map(
        (r, i): Feature<LineString> => ({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: toGeoCoords(r.coords) },
          properties: { color: r.color ?? '#3D9EFF', id: r.id ?? i },
        }),
      ),
  };
}

function UserIcon() {
  return (
    <View style={iconStyles.userBadge}>
      <LocateFixed size={14} color="white" strokeWidth={2.5} />
    </View>
  );
}

function BusStopSvg({
  bg,
  fg,
  svgRef,
}: {
  bg: string;
  fg: string;
  svgRef: React.RefObject<Svg | null>;
}) {
  // Lucide BusFront paths — 24×24 space, scaled into 56×56 viewBox
  return (
    <Svg ref={svgRef} width={BUS_ICON_SIZE} height={BUS_ICON_SIZE} viewBox="0 0 56 56">
      <SvgCircle cx="28" cy="28" r="26" fill={bg} stroke={fg} strokeWidth="2" />
      <SvgG transform="translate(8, 7) scale(1.7)">
        <SvgPath d="M4 6 2 7" stroke={fg} strokeWidth="2" strokeLinecap="round" fill="none" />
        <SvgPath d="M10 6h4" stroke={fg} strokeWidth="2" strokeLinecap="round" fill="none" />
        <SvgPath d="m22 7-2-1" stroke={fg} strokeWidth="2" strokeLinecap="round" fill="none" />
        <SvgRect
          width="16"
          height="16"
          x="4"
          y="3"
          rx="2"
          stroke={fg}
          strokeWidth="2"
          fill="none"
        />
        <SvgPath d="M4 11h16" stroke={fg} strokeWidth="2" strokeLinecap="round" fill="none" />
        <SvgPath d="M8 15h.01" stroke={fg} strokeWidth="3" strokeLinecap="round" fill="none" />
        <SvgPath d="M16 15h.01" stroke={fg} strokeWidth="3" strokeLinecap="round" fill="none" />
        <SvgPath d="M6 19v2" stroke={fg} strokeWidth="2" strokeLinecap="round" fill="none" />
        <SvgPath d="M18 21v-2" stroke={fg} strokeWidth="2" strokeLinecap="round" fill="none" />
      </SvgG>
    </Svg>
  );
}

type MapImageEntry = { source: { uri: string }; sdf?: boolean };

function BusVehicleSvg({ svgRef }: { svgRef: React.RefObject<Svg | null> }) {
  // White paths on transparent background → SDF mode lets MapLibre colorize at runtime
  return (
    <Svg ref={svgRef} width={BUS_ICON_SIZE} height={BUS_ICON_SIZE} viewBox="0 0 56 56">
      <SvgG transform="translate(8, 10) scale(1.7)">
        <SvgPath d="M8 6v6" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
        <SvgPath d="M15 6v6" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
        <SvgPath d="M2 12h19.6" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
        <SvgPath
          d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <SvgCircle cx="7" cy="18" r="2" stroke="white" strokeWidth="2" fill="white" />
        <SvgPath d="M9 18h5" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
        <SvgCircle cx="16" cy="18" r="2" stroke="white" strokeWidth="2" fill="white" />
      </SvgG>
    </Svg>
  );
}

function MetroIconSvg({ svgRef }: { svgRef: React.RefObject<Svg | null> }) {
  // White train-front paths on transparent background → SDF colorized by MapLibre
  return (
    <Svg ref={svgRef} width={BUS_ICON_SIZE} height={BUS_ICON_SIZE} viewBox="0 0 56 56">
      <SvgG transform="translate(4, 4) scale(2)">
        <SvgPath
          d="M8 3.1V7a4 4 0 0 0 8 0V3.1"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <SvgPath d="m9 15-1-1" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
        <SvgPath d="m15 15 1-1" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
        <SvgPath
          d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <SvgPath d="m8 19-2 3" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
        <SvgPath d="m16 19 2 3" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
      </SvgG>
    </Svg>
  );
}

function CptmIconSvg({ svgRef }: { svgRef: React.RefObject<Svg | null> }) {
  // Tram-front paths only — layered on top of CptmBgSvg, colored white via SDF
  return (
    <Svg ref={svgRef} width={BUS_ICON_SIZE} height={BUS_ICON_SIZE} viewBox="0 0 56 56">
      <SvgG transform="translate(10, 10) scale(1.5)">
        <SvgRect
          x="4"
          y="3"
          width="16"
          height="16"
          rx="2"
          stroke="white"
          strokeWidth="2"
          fill="none"
        />
        <SvgPath d="M4 11h16" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
        <SvgPath d="M12 3v8" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
        <SvgPath d="m8 19-2 3" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
        <SvgPath d="m18 22-2-3" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
        <SvgPath d="M8 15h.01" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
        <SvgPath d="M16 15h.01" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
      </SvgG>
    </Svg>
  );
}

function CptmBgSvg({ svgRef }: { svgRef: React.RefObject<Svg | null> }) {
  // White filled rounded square → SDF colored with line color as background
  return (
    <Svg ref={svgRef} width={BUS_ICON_SIZE} height={BUS_ICON_SIZE} viewBox="0 0 56 56">
      <SvgRect x="3" y="3" width="50" height="50" rx="10" fill="white" />
    </Svg>
  );
}

function useBusStopImages() {
  const normalRef = useRef<Svg>(null);
  const selectedRef = useRef<Svg>(null);
  const vehicleRef = useRef<Svg>(null);
  const metroRef = useRef<Svg>(null);
  const cptmRef = useRef<Svg>(null);
  const cptmBgRef = useRef<Svg>(null);
  const [mapImages, setMapImages] = useState<Record<string, MapImageEntry>>({});

  useEffect(() => {
    const id = setTimeout(() => {
      const collected: Record<string, MapImageEntry> = {};
      let done = 0;

      const finish = () => {
        done++;
        if (done === 6) setMapImages(collected);
      };

      (normalRef.current as any)?.toDataURL?.((b64: string) => {
        collected['bus-stop'] = { source: { uri: `data:image/png;base64,${b64}` } };
        finish();
      });
      (selectedRef.current as any)?.toDataURL?.((b64: string) => {
        collected['bus-stop-selected'] = { source: { uri: `data:image/png;base64,${b64}` } };
        finish();
      });
      (vehicleRef.current as any)?.toDataURL?.((b64: string) => {
        collected['bus-vehicle'] = { source: { uri: `data:image/png;base64,${b64}` }, sdf: true };
        finish();
      });
      (metroRef.current as any)?.toDataURL?.((b64: string) => {
        collected['metro-icon'] = { source: { uri: `data:image/png;base64,${b64}` }, sdf: true };
        finish();
      });
      (cptmRef.current as any)?.toDataURL?.((b64: string) => {
        collected['cptm-icon'] = { source: { uri: `data:image/png;base64,${b64}` }, sdf: true };
        finish();
      });
      (cptmBgRef.current as any)?.toDataURL?.((b64: string) => {
        collected['cptm-bg'] = { source: { uri: `data:image/png;base64,${b64}` }, sdf: true };
        finish();
      });
    }, 80);
    return () => clearTimeout(id);
  }, []);

  return { mapImages, normalRef, selectedRef, vehicleRef, metroRef, cptmRef, cptmBgRef };
}

const iconStyles = StyleSheet.create({
  userBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4FE566',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  hiddenCapture: {
    position: 'absolute',
    left: -1000,
    top: -1000,
    width: BUS_ICON_SIZE,
    height: BUS_ICON_SIZE * 6,
  },
});

const EMPTY_VEHICLES_FC: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };

// ── BusMap ─────────────────────────────────────────────────────────────────────

export const BusMap = React.memo(function BusMap({
  userCoords,
  spStops,
  vehicles,
  routeCoords,
  routeColor,
  fitRoute,
  allRoutes,
  selectedStopId,
  metroStations,
  metroLines,
  centerOn,
  onSpStopPress,
  onLinePress,
  onMetroLinePress,
  onNoRoute,
  onMapPress,
}: BusMapProps) {
  const { mapImages, normalRef, selectedRef, vehicleRef, metroRef, cptmRef, cptmBgRef } =
    useBusStopImages();
  const cameraRef = useRef<CameraRef>(null);
  const lastFitKey = useRef<string | null>(null);
  const prevCenterOn = useRef<typeof centerOn>(undefined);
  const noRouteFired = useRef(false);

  // Pan/zoom to requested position
  useEffect(() => {
    if (!centerOn || centerOn === prevCenterOn.current) return;
    prevCenterOn.current = centerOn;
    cameraRef.current?.easeTo({
      center: [centerOn.lon, centerOn.lat],
      zoom: centerOn.zoom ?? 15,
      duration: 400,
    });
  }, [centerOn]);

  // Fit map to route bounds when line is selected
  useEffect(() => {
    if (!fitRoute) return;
    if (!routeCoords || routeCoords.length < 2) {
      if (!noRouteFired.current) {
        noRouteFired.current = true;
        onNoRoute?.();
      }
      return;
    }
    noRouteFired.current = false;
    const key = `${routeCoords.length}:${routeCoords[0].join(',')}`;
    if (key === lastFitKey.current) return;
    lastFitKey.current = key;
    cameraRef.current?.fitBounds(toBounds(routeCoords), {
      padding: { top: 60, right: 40, bottom: 220, left: 40 },
      duration: 1000,
    });
  }, [fitRoute, routeCoords, onNoRoute]);

  const activeRoute = useMemo<Feature<LineString> | null>(() => {
    if (!routeCoords || routeCoords.length < 2) return null;
    return {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: toGeoCoords(routeCoords) },
      properties: {},
    };
  }, [routeCoords]);

  const allRoutesFC = useMemo(
    () => (allRoutes && allRoutes.length > 0 ? lineFC(allRoutes) : null),
    [allRoutes],
  );

  const metroLinesFCData = useMemo(
    () =>
      metroLines && metroLines.length > 0
        ? lineFC(metroLines.map((l) => ({ coords: l.coords, color: l.color, id: l.id })))
        : null,
    [metroLines],
  );

  const stopsFCData = useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: (spStops ?? []).map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.px, s.py] },
        properties: { cp: s.cp },
      })),
    }),
    [spStops],
  );

  const [vehiclesDisplay, setVehiclesDisplay] =
    useState<FeatureCollection<Point>>(EMPTY_VEHICLES_FC);
  // Last-known target position per vehicle id — used as animation start point
  const vehiclesPrevRef = useRef<Map<number, [number, number]>>(new Map());
  const vehiclesAnimRef = useRef<number | null>(null);

  useEffect(() => {
    const filtered = (vehicles ?? []).filter((v) => v.px != null && v.py != null);

    if (filtered.length === 0) {
      if (vehiclesAnimRef.current != null) cancelAnimationFrame(vehiclesAnimRef.current);
      vehiclesPrevRef.current = new Map();
      setVehiclesDisplay(EMPTY_VEHICLES_FC);
      return;
    }

    const newPos = new Map<number, [number, number]>(
      filtered.map((v) => [Number(v.p), [v.px!, v.py!]]),
    );
    const prevPos = vehiclesPrevRef.current;
    const overlap = filtered.filter((v) => prevPos.has(Number(v.p))).length;

    // No prior positions or completely different set — snap immediately
    if (prevPos.size === 0 || overlap === 0) {
      if (vehiclesAnimRef.current != null) cancelAnimationFrame(vehiclesAnimRef.current);
      vehiclesPrevRef.current = newPos;
      setVehiclesDisplay({
        type: 'FeatureCollection',
        features: filtered.map((v) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [v.px!, v.py!] },
          properties: {
            color: v.lineColor ?? (v.a ? '#4FE566' : '#3D9EFF'),
            p: v.p,
            lineCode: v.lineCode ?? undefined,
          },
        })),
      });
      return;
    }

    if (vehiclesAnimRef.current != null) cancelAnimationFrame(vehiclesAnimRef.current);

    const startMs = Date.now();
    const DURATION = 2000;

    const buildFrame = (t: number): FeatureCollection<Point> => {
      // easeInOut quad
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      return {
        type: 'FeatureCollection',
        features: filtered.map((v) => {
          const prev = prevPos.get(Number(v.p));
          const lon = prev ? prev[0] + (v.px! - prev[0]) * e : v.px!;
          const lat = prev ? prev[1] + (v.py! - prev[1]) * e : v.py!;
          return {
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [lon, lat] },
            properties: {
              color: v.lineColor ?? (v.a ? '#4FE566' : '#3D9EFF'),
              p: v.p,
              lineCode: v.lineCode ?? undefined,
            },
          };
        }),
      };
    };

    const tick = () => {
      const t = Math.min((Date.now() - startMs) / DURATION, 1);
      setVehiclesDisplay(buildFrame(t));
      if (t < 1) {
        vehiclesAnimRef.current = requestAnimationFrame(tick);
      } else {
        vehiclesPrevRef.current = newPos;
        vehiclesAnimRef.current = null;
      }
    };

    vehiclesAnimRef.current = requestAnimationFrame(tick);
    return () => {
      if (vehiclesAnimRef.current != null) cancelAnimationFrame(vehiclesAnimRef.current);
    };
  }, [vehicles]);

  const metroFCData = useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: (metroStations ?? []).map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: {
          color: s.color ?? '#1B3FA6',
          name: s.name,
          line: s.line ?? '',
          network: s.network ?? '',
        },
      })),
    }),
    [metroStations],
  );

  const [infoCallout, setInfoCallout] = useState<{
    title: string;
    subtitle?: string;
    color?: string;
    lineCode?: string;
    source: 'metro' | 'vehicle';
  } | null>(null);

  // Tracks the last vehicle press timestamp so handleStopPress can ignore
  // simultaneous stop-press events that MapLibre fires when a vehicle overlaps a stop.
  const lastVehiclePressMs = useRef(0);

  const handleStopPress = useCallback(
    (event: any) => {
      if (Date.now() - lastVehiclePressMs.current < 150) return;
      const cp = event.nativeEvent?.features?.[0]?.properties?.cp as number | undefined;
      if (cp != null) {
        const stop = spStops?.find((s) => s.cp === cp);
        if (stop) {
          setInfoCallout(null);
          onSpStopPress?.(stop);
        }
      }
      event.stopPropagation?.();
    },
    [spStops, onSpStopPress],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMetroPress = useCallback((event: any) => {
    const props = event.nativeEvent?.features?.[0]?.properties;
    if (props?.name) {
      const lineParts = [props.line && `Linha ${props.line}`, props.network].filter(Boolean);
      setInfoCallout({
        title: props.name,
        subtitle: lineParts.length > 0 ? lineParts.join(' · ') : undefined,
        color: props.color ?? undefined,
        lineCode: props.line ?? undefined,
        source: 'metro',
      });
    }
    event.stopPropagation?.();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleVehiclePress = useCallback((event: any) => {
    const props = event.nativeEvent?.features?.[0]?.properties;
    if (props?.p != null) {
      lastVehiclePressMs.current = Date.now();
      setInfoCallout({
        title: props.lineCode || `Veículo ${props.p}`,
        subtitle: props.lineCode ? `Linha ${props.lineCode}` : undefined,
        color: props.color ?? undefined,
        lineCode: props.lineCode || undefined,
        source: 'vehicle',
      });
    }
    event.stopPropagation?.();
  }, []);

  // -1 sentinel: no stop has cp = -1, so filter matches nothing when no selection
  const selectedId = selectedStopId ?? -1;

  return (
    <View style={styles.container}>
      {/* Off-screen SVGs captured once as PNG sprites for MapLibre */}
      <View style={iconStyles.hiddenCapture} pointerEvents="none">
        <BusStopSvg bg="#1e2e2b" fg="#f5c54a" svgRef={normalRef} />
        <BusStopSvg bg="#1e2e2b" fg="#4FE566" svgRef={selectedRef} />
        <BusVehicleSvg svgRef={vehicleRef} />
        <MetroIconSvg svgRef={metroRef} />
        <CptmIconSvg svgRef={cptmRef} />
        <CptmBgSvg svgRef={cptmBgRef} />
      </View>

      <MapView
        style={styles.map}
        mapStyle={BLANK_STYLE}
        touchRotate={false}
        touchPitch={false}
        attribution={false}
        logo={false}
        onPress={onMapPress ? () => onMapPress() : undefined}>
        <Camera ref={cameraRef} initialViewState={{ center: INITIAL_CENTER, zoom: INITIAL_ZOOM }} />

        <RasterSource id="carto" tiles={CARTO_TILES} tileSize={256}>
          <Layer id="carto-tiles" type="raster" />
        </RasterSource>

        <Images images={mapImages} />

        {/* Route lines use beforeId to always render below the circle layers,
          even when loaded asynchronously after circles are already in the style. */}
        {metroLinesFCData && (
          <GeoJSONSource id="metro-lines" data={metroLinesFCData}>
            <Layer
              id="metro-lines-layer"
              type="line"
              beforeId="metro-stations-base"
              maxzoom={SHOW_METRO_ZOOM}
              paint={{ 'line-color': ['get', 'color'], 'line-width': 3.5 }}
            />
          </GeoJSONSource>
        )}

        {allRoutesFC && (
          <GeoJSONSource id="all-routes" data={allRoutesFC}>
            <Layer
              id="all-routes-layer"
              type="line"
              beforeId="metro-stations-base"
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 4,
                'line-opacity': 0.65,
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        )}

        {activeRoute && (
          <GeoJSONSource id="active-route" data={activeRoute}>
            <Layer
              id="active-route-layer"
              type="line"
              beforeId="metro-stations-base"
              paint={{
                'line-color': routeColor ?? '#3D9EFF',
                'line-width': 5,
                'line-opacity': 0.6,
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        )}

        {/* Metro stations: colored circle + white train-front icon (SDF) */}
        {/* CPTM stations: colored rounded-square outline + colored tram-front icon (SDF) */}
        <GeoJSONSource id="metro-stations" data={metroFCData} onPress={handleMetroPress}>
          <Layer
            key="metro-stations-base"
            id="metro-stations-base"
            type="circle"
            minzoom={SHOW_METRO_ZOOM}
            filter={['==', ['get', 'network'], 'Metrô SP']}
            paint={{
              'circle-radius': 9,
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 3,
              'circle-stroke-color': 'white',
            }}
          />
          <Layer
            key="metro-icon"
            id="metro-icon"
            type="symbol"
            minzoom={SHOW_METRO_ZOOM}
            filter={['==', ['get', 'network'], 'Metrô SP']}
            layout={{
              'icon-image': 'metro-icon',
              'icon-size': METRO_ICON_SIZE,
              'icon-allow-overlap': true,
              'icon-anchor': 'center',
            }}
            paint={{ 'icon-color': 'white' }}
          />
          <Layer
            key="cptm-bg"
            id="cptm-bg"
            type="symbol"
            minzoom={SHOW_METRO_ZOOM}
            filter={['==', ['get', 'network'], 'CPTM']}
            layout={{
              'icon-image': 'cptm-bg',
              'icon-size': CPTM_ICON_SIZE,
              'icon-allow-overlap': true,
              'icon-anchor': 'center',
            }}
            paint={{ 'icon-color': ['get', 'color'] }}
          />
          <Layer
            key="cptm-icon"
            id="cptm-icon"
            type="symbol"
            minzoom={SHOW_METRO_ZOOM}
            filter={['==', ['get', 'network'], 'CPTM']}
            layout={{
              'icon-image': 'cptm-icon',
              'icon-size': CPTM_ICON_SIZE,
              'icon-allow-overlap': true,
              'icon-anchor': 'center',
            }}
            paint={{ 'icon-color': 'white' }}
          />
        </GeoJSONSource>

        {/* Bus stops: SVG sprite icon (pre-rendered at init, zero map-frame delay) */}
        <GeoJSONSource id="stops-src" data={stopsFCData} onPress={handleStopPress}>
          <Layer
            id="stops-unselected"
            type="symbol"
            minzoom={SHOW_STOPS_ZOOM}
            filter={['!=', ['get', 'cp'], selectedId]}
            layout={{
              'icon-image': 'bus-stop',
              'icon-size': STOP_ICON_SIZE,
              'icon-allow-overlap': true,
              'icon-anchor': 'center',
            }}
          />
          <Layer
            id="stops-selected"
            type="symbol"
            filter={['==', ['get', 'cp'], selectedId]}
            layout={{
              'icon-image': 'bus-stop-selected',
              'icon-size': STOP_ICON_SIZE_SELECTED,
              'icon-allow-overlap': true,
              'icon-anchor': 'center',
            }}
          />
        </GeoJSONSource>

        {/* Vehicles: colored circle (line color) + white SDF bus icon */}
        <GeoJSONSource id="vehicles-src" data={vehiclesDisplay} onPress={handleVehiclePress}>
          <Layer
            id="vehicles-body"
            type="circle"
            paint={{
              'circle-radius': 11,
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 2,
              'circle-stroke-color': 'white',
            }}
          />
          <Layer
            id="vehicles-icon"
            type="symbol"
            layout={{
              'icon-image': 'bus-vehicle',
              'icon-size': STOP_ICON_SIZE * 0.7,
              'icon-allow-overlap': true,
              'icon-anchor': 'center',
            }}
            paint={{ 'icon-color': 'white' }}
          />
        </GeoJSONSource>

        {/* User location: single Marker, negligible bridge overhead */}
        {userCoords && (
          <Marker id="user" lngLat={[userCoords.lon, userCoords.lat]} anchor="center">
            <UserIcon />
          </Marker>
        )}
      </MapView>

      {infoCallout && (
        <View style={styles.callout}>
          <View
            style={[
              styles.calloutDot,
              infoCallout.color ? { backgroundColor: infoCallout.color } : undefined,
            ]}
          />
          <View style={styles.calloutBody}>
            <Text style={styles.calloutTitle}>{infoCallout.title}</Text>
            {infoCallout.subtitle ? (
              <Text style={styles.calloutSubtitle}>{infoCallout.subtitle}</Text>
            ) : null}
          </View>
          {infoCallout.lineCode &&
            (infoCallout.source === 'metro' ? onMetroLinePress : onLinePress) && (
              <Pressable
                onPress={() => {
                  if (infoCallout.source === 'metro') onMetroLinePress?.(infoCallout.lineCode!);
                  else onLinePress?.(infoCallout.lineCode!);
                  setInfoCallout(null);
                }}
                style={styles.calloutLineBtn}
                hitSlop={8}>
                <Text style={styles.calloutLineBtnText}>Ver linha</Text>
              </Pressable>
            )}
          <Pressable onPress={() => setInfoCallout(null)} hitSlop={12} style={{ marginLeft: 4 }}>
            <Text style={styles.calloutClose}>✕</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  callout: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  calloutDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3D9EFF',
  },
  calloutBody: { flex: 1 },
  calloutTitle: { fontSize: 14, fontWeight: '700', color: '#1e2e2b' },
  calloutSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  calloutClose: { fontSize: 16, color: '#aaa' },
  calloutLineBtn: {
    backgroundColor: '#1e2e2b',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  calloutLineBtnText: { fontSize: 12, fontWeight: '700', color: 'white' },
});
