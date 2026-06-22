import type { SPStop, MetroStation, MetroLineData, RouteColorMap } from '@/constants/sptransTypes';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';

type ShapeMap = Record<string, [number, number][]>;

let shapes: ShapeMap | null = null;

function loadShapes() {
  if (shapes !== null) return;
  try {
    shapes = require('../assets/gtfs-shapes.json') as ShapeMap;
  } catch {
    shapes = {};
  }
}

function normalize(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function gtfsLoaded(): boolean {
  loadShapes();
  return Object.keys(shapes ?? {}).length > 0;
}

export function getGtfsShape(lineCode: string): [number, number][] | null {
  loadShapes();
  if (!shapes) return null;

  const key = normalize(lineCode);
  if (shapes[key]?.length >= 2) return shapes[key];

  // Tenta sem sufixo numérico de variante: "702C10" → "702C"
  const base = key.replace(/\d+$/, '');
  if (base !== key && shapes[base]?.length >= 2) return shapes[base];

  return null;
}

// Fetches URL once per session — on error, lets next call retry instead of caching failure.
function memoFetch<T>(url: string, pick: (data: unknown) => T, empty: T): () => Promise<T> {
  let cache: T | null = null;
  return async () => {
    if (cache !== null) return cache;
    try {
      const res = await fetch(url);
      if (!res.ok) return empty;
      cache = pick(await res.json()) ?? empty;
      return cache;
    } catch {
      return empty;
    }
  };
}

export const getMetroStations = memoFetch<MetroStation[]>(
  `${BACKEND}/api/gtfs/metro-stations`,
  (d) => (d as { stations?: MetroStation[] }).stations ?? [],
  [],
);

export const getMetroLines = memoFetch<MetroLineData[]>(
  `${BACKEND}/api/gtfs/metro-lines`,
  (d) => (d as { lines?: MetroLineData[] }).lines ?? [],
  [],
);

export const getRouteColors = memoFetch<RouteColorMap>(
  `${BACKEND}/api/gtfs/route-colors`,
  (d) => d as RouteColorMap,
  {},
);

export async function getStopsNear(lat: number, lon: number, radiusM = 600): Promise<SPStop[]> {
  try {
    const res = await fetch(
      `${BACKEND}/api/gtfs/stops-near?lat=${lat}&lon=${lon}&radius=${radiusM}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { stops?: SPStop[] };
    return data.stops ?? [];
  } catch {
    return [];
  }
}

const stopsCache = new Map<string, SPStop[]>();

export async function getGtfsStops(lineCode: string, sentido: 1 | 2): Promise<SPStop[] | null> {
  const key = normalize(lineCode) + '-' + sentido;
  if (stopsCache.has(key)) return stopsCache.get(key)!;

  try {
    const res = await fetch(`${BACKEND}/api/gtfs/stops?line=${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { stops?: SPStop[]; found?: boolean };
    if (!data.found || !data.stops?.length) return null;
    stopsCache.set(key, data.stops);
    return data.stops;
  } catch {
    return null;
  }
}
