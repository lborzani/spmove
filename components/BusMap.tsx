import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import {
  Map as MapView,
  Camera,
  Marker,
  GeoJSONSource,
  RasterSource,
  Layer,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { LocateFixed } from 'lucide-react-native';
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
}

// Blank style avoids HTTP/2 stream-reset issues on Android with the CARTO vector style endpoint.
const BLANK_STYLE = { version: 8 as const, sources: {}, layers: [] };
const CARTO_TILES = ['https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'];
const INITIAL_CENTER: [number, number] = [-46.6333, -23.5505];
const INITIAL_ZOOM = 13;
const SHOW_STOPS_ZOOM = 15;
const SHOW_METRO_ZOOM = 13;

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
}: BusMapProps) {
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
            lineCode: v.lineCode ?? '',
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
              lineCode: v.lineCode ?? '',
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleStopPress = useCallback(
    (event: any) => {
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
      setInfoCallout({
        title: `Veículo ${props.p}`,
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
      <MapView
        style={styles.map}
        mapStyle={BLANK_STYLE}
        touchRotate={false}
        touchPitch={false}
        attribution={false}
        logo={false}>
        <Camera ref={cameraRef} initialViewState={{ center: INITIAL_CENTER, zoom: INITIAL_ZOOM }} />

        <RasterSource id="carto" tiles={CARTO_TILES} tileSize={256}>
          <Layer id="carto-tiles" type="raster" />
        </RasterSource>

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

        {/* Metro/CPTM stations: medallion = colored ring + white inner dot */}
        <GeoJSONSource id="metro-stations" data={metroFCData} onPress={handleMetroPress}>
          <Layer
            id="metro-stations-base"
            type="circle"
            minzoom={SHOW_METRO_ZOOM}
            paint={{
              'circle-radius': 9,
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 3,
              'circle-stroke-color': 'white',
            }}
          />
          <Layer
            id="metro-stations-dot"
            type="circle"
            minzoom={SHOW_METRO_ZOOM}
            paint={{
              'circle-radius': 3.5,
              'circle-color': 'white',
              'circle-opacity': 0.55,
            }}
          />
        </GeoJSONSource>

        {/* Bus stops: bullseye = amber ring + dark center dot */}
        <GeoJSONSource id="stops-src" data={stopsFCData} onPress={handleStopPress}>
          {/* Unselected: bullseye pattern */}
          <Layer
            id="stops-unselected-base"
            type="circle"
            minzoom={SHOW_STOPS_ZOOM}
            filter={['!=', ['get', 'cp'], selectedId]}
            paint={{
              'circle-radius': 7,
              'circle-color': '#f5c54a',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#1e2e2b',
            }}
          />
          <Layer
            id="stops-unselected-dot"
            type="circle"
            minzoom={SHOW_STOPS_ZOOM}
            filter={['!=', ['get', 'cp'], selectedId]}
            paint={{
              'circle-radius': 2.5,
              'circle-color': '#1e2e2b',
            }}
          />
          {/* Selected: green crosshair, no minzoom = always visible */}
          <Layer
            id="stops-selected-base"
            type="circle"
            filter={['==', ['get', 'cp'], selectedId]}
            paint={{
              'circle-radius': 12,
              'circle-color': '#4FE566',
              'circle-stroke-width': 3,
              'circle-stroke-color': 'white',
            }}
          />
          <Layer
            id="stops-selected-dot"
            type="circle"
            filter={['==', ['get', 'cp'], selectedId]}
            paint={{
              'circle-radius': 4,
              'circle-color': 'white',
              'circle-opacity': 0.8,
            }}
          />
        </GeoJSONSource>

        {/* Vehicles: aura (semi-transparent halo) + solid body */}
        <GeoJSONSource id="vehicles-src" data={vehiclesDisplay} onPress={handleVehiclePress}>
          <Layer
            id="vehicles-halo"
            type="circle"
            paint={{
              'circle-radius': 15,
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.2,
            }}
          />
          <Layer
            id="vehicles-body"
            type="circle"
            paint={{
              'circle-radius': 9,
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 2,
              'circle-stroke-color': 'white',
            }}
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
