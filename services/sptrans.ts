import type {
  SPLine,
  SPStop,
  OSMStop,
  SPNearbyLine,
  SPPositionResponse,
  SPArrivalResponse,
} from '@/constants/sptransTypes';

const BASE = 'https://api.olhovivo.sptrans.com.br/v2.1';
const TOKEN = process.env.EXPO_PUBLIC_SPTRANS_TOKEN ?? '';

let sessionCookie: string | null = null;

// fetch() on Android (OkHttp) strips set-cookie — XHR exposes the full header string.
async function authenticate(): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/Login/Autenticar?token=${TOKEN}`);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        const match = (xhr.getAllResponseHeaders() ?? '').match(/set-cookie:\s*([^;\r\n]+)/i);
        if (match) sessionCookie = match[1].trim();
        resolve();
      } else {
        reject(new Error(`SPTrans auth ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('SPTrans auth network error'));
    xhr.send();
  });
}

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  if (!sessionCookie) await authenticate();

  const qs = params
    ? '?' + Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : '';

  const doFetch = () =>
    fetch(`${BASE}${path}${qs}`, {
      headers: sessionCookie ? { Cookie: sessionCookie } : {},
    });

  let res = await doFetch();

  if (res.status === 401 || res.status === 403) {
    sessionCookie = null;
    await authenticate();
    res = await doFetch();
  }

  if (!res.ok) throw new Error(`SPTrans ${res.status}: ${path}`);
  return res.json();
}

// ── Linhas ──────────────────────────────────────────────────────────────────

export async function buscarLinhas(termos: string): Promise<SPLine[]> {
  const raw = await get<any[]>('/Linha/Buscar', { termosBusca: termos });
  return (raw ?? []).map((l) => ({
    ...l,
    lt0: l.tp, // terminal principal = origem
    lt1: l.ts, // terminal secundário = destino
  }));
}

// ── Paradas ─────────────────────────────────────────────────────────────────

export async function buscarParadas(termos: string): Promise<SPStop[]> {
  return get<SPStop[]>('/Parada/Buscar', { termosBusca: termos });
}

async function buscarTodasParadas(): Promise<SPStop[] | null> {
  try {
    const result = await get<SPStop[]>('/Parada/Buscar', { termosBusca: '' });
    return result?.length > 0 ? result : null;
  } catch {
    return null;
  }
}

// ── OSM Overpass ─────────────────────────────────────────────────────────────

export async function buscarParadasOSM(
  lat: number,
  lon: number,
  radiusM = 600,
): Promise<OSMStop[]> {
  const query =
    `[out:json][timeout:10];` +
    `(node["highway"="bus_stop"](around:${radiusM},${lat},${lon});` +
    `node["public_transport"="platform"]["bus"="yes"](around:${radiusM},${lat},${lon}););` +
    `out body;`;
  const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
  const data = await res.json();
  const elements: any[] = data.elements ?? [];

  const seen = new Set<number>();
  return elements
    .filter(el => el.lat != null && el.lon != null && !seen.has(el.id) && seen.add(el.id))
    .map(el => ({
      osmId: el.id,
      lat: el.lat,
      lon: el.lon,
      name: el.tags?.name ?? el.tags?.['name:pt'] ?? '',
      gtfsRef: el.tags?.['ref:gtfs'],
      shelter: el.tags?.shelter === 'yes',
      distance: haversineMeters(lat, lon, el.lat, el.lon),
    }))
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

export async function resolverCodigoParada(osmStop: OSMStop): Promise<number | null> {
  try {
    const allStops = await buscarTodasParadas();
    if (allStops && allStops.length > 0) {
      const nearest = allStops
        .map(s => ({ cp: s.cp, dist: haversineMeters(osmStop.lat, osmStop.lon, s.py, s.px) }))
        .sort((a, b) => a.dist - b.dist)[0];
      if (nearest && nearest.dist <= 80) return nearest.cp;
    }
  } catch { /* try next */ }

  if (osmStop.name) {
    try {
      const results = await buscarParadas(osmStop.name);
      if (results.length > 0) {
        const best = results
          .map(s => ({ cp: s.cp, dist: haversineMeters(osmStop.lat, osmStop.lon, s.py, s.px) }))
          .sort((a, b) => a.dist - b.dist)[0];
        if (best && best.dist <= 200) return best.cp;
      }
    } catch { /* skip */ }
  }

  return null;
}

// ── Rota (GeoServer SPTrans) ─────────────────────────────────────────────────

const GEOSERVER = 'https://maps.sptrans.com.br/geoserver/SIM/wms';

export async function buscarRotaLinha(
  lineCode: string,
  sentido: 1 | 2 = 1,
): Promise<[number, number][] | null> {
  const filter = `LINHA LIKE '${lineCode}%' AND SENTIDO = ${sentido}`;
  const url =
    GEOSERVER +
    '?service=WFS&version=2.0&request=GetFeature' +
    '&typeName=SIM%3ALinhasAtuaisEFuturas' +
    '&outputFormat=application%2Fjson' +
    '&CQL_FILTER=' + encodeURIComponent(filter);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`GeoServer ${res.status}`);
  const data = await res.json();

  const features: any[] = data.features ?? [];
  if (!features.length) return null;

  const feature =
    features.find((f: any) => f.properties?.LINHA === lineCode) ?? features[0];

  const geom = feature?.geometry;
  if (!geom) return null;

  // GeoJSON [lon, lat] → Leaflet [lat, lon]
  const coords: [number, number][] = [];
  if (geom.type === 'MultiLineString') {
    for (const line of geom.coordinates as number[][][]) {
      for (const [lon, lat] of line) coords.push([lat, lon]);
    }
  } else if (geom.type === 'LineString') {
    for (const [lon, lat] of geom.coordinates as number[][]) coords.push([lat, lon]);
  }

  return coords.length >= 2 ? coords : null;
}

// ── Posição ──────────────────────────────────────────────────────────────────

export async function getPosicaoLinha(codigoLinha: number): Promise<SPPositionResponse> {
  return get<SPPositionResponse>('/Posicao/Linha', { codigoLinha });
}

export async function buscarLinhasProximas(
  lat: number,
  lon: number,
  radiusM = 500,
): Promise<SPNearbyLine[]> {
  const posicao = await get<SPPositionResponse>('/Posicao');
  const lines = posicao.l ?? [];

  const nearby: SPNearbyLine[] = [];
  for (const line of lines) {
    const busesNear = (line.vs ?? []).filter(
      v => v.py != null && v.px != null && haversineMeters(lat, lon, v.py, v.px) <= radiusM
    );
    if (busesNear.length === 0) continue;
    nearby.push({
      cl: line.cl,
      c: line.c,
      sl: (line.sl === 2 ? 2 : 1) as 1 | 2,
      lt0: line.lt0,
      lt1: line.lt1,
      qv: busesNear.length,
      nearestBusM: Math.min(...busesNear.map(v => haversineMeters(lat, lon, v.py, v.px))),
      vs: line.vs ?? [],
    });
  }

  return nearby.sort((a, b) => a.nearestBusM - b.nearestBusM);
}

// ── Previsão ─────────────────────────────────────────────────────────────────

export async function getPrevisaoParada(codigoParada: number): Promise<SPArrivalResponse> {
  return get<SPArrivalResponse>('/Previsao/Parada', { codigoParada });
}

// ── Utilitários ──────────────────────────────────────────────────────────────

export function haversineMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
