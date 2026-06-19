import type {
  SPLine,
  SPStop,
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
    ? '?' +
      Object.entries(params)
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

interface SPLineRaw {
  cl: number;
  lc: boolean;
  lt: string;
  sl: 1 | 2;
  tl: number;
  tp: string;
  ts: string;
}

const linhasCache = new Map<string, SPLine[]>();

export async function buscarLinhas(termos: string): Promise<SPLine[]> {
  const key = termos.trim().toLowerCase();
  if (linhasCache.has(key)) return linhasCache.get(key)!;
  const raw = await get<SPLineRaw[]>('/Linha/Buscar', { termosBusca: termos });
  const result = (raw ?? []).map((l) => ({ ...l, lt0: l.tp, lt1: l.ts }));
  linhasCache.set(key, result);
  return result;
}

// ── Paradas ─────────────────────────────────────────────────────────────────

export async function buscarParadas(termos: string): Promise<SPStop[]> {
  return get<SPStop[]>('/Parada/Buscar', { termosBusca: termos });
}

const paradasPorLinhaCache = new Map<number, SPStop[]>();

export async function buscarParadasPorLinha(cl: number): Promise<SPStop[]> {
  if (paradasPorLinhaCache.has(cl)) return paradasPorLinhaCache.get(cl)!;
  const result = await get<SPStop[]>('/Parada/BuscarParadasPorLinha', { codigoLinha: cl });
  paradasPorLinhaCache.set(cl, result);
  return result;
}

interface GeoServerFeature {
  properties: Record<string, unknown> | null;
  geometry: {
    type: string;
    coordinates: number[][] | number[][][];
  } | null;
}

// ── Rota (GeoServer SPTrans) ─────────────────────────────────────────────────

const GEOSERVER = 'https://maps.sptrans.com.br/geoserver/SIM/wms';

// GeoJSON stores [lon, lat]; Leaflet needs [lat, lon]
function geoToLatLon(pairs: number[][]): [number, number][] {
  return pairs.map(([lon, lat]) => [lat, lon]);
}

// null cached = confirmed no route for this line/direction
const rotaCache = new Map<string, [number, number][] | null>();

export async function buscarRotaLinha(
  lineCode: string,
  sentido: 1 | 2 = 1,
): Promise<[number, number][] | null> {
  const cacheKey = `${lineCode}|${sentido}`;
  if (rotaCache.has(cacheKey)) return rotaCache.get(cacheKey)!;
  const filter = `LINHA LIKE '${lineCode}%' AND SENTIDO = ${sentido}`;
  const url =
    GEOSERVER +
    '?service=WFS&version=2.0&request=GetFeature' +
    '&typeName=SIM%3ALinhasAtuaisEFuturas' +
    '&outputFormat=application%2Fjson' +
    '&CQL_FILTER=' +
    encodeURIComponent(filter);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`GeoServer ${res.status}`);
  const data = (await res.json()) as { features?: GeoServerFeature[] };

  const features: GeoServerFeature[] = data.features ?? [];
  if (!features.length) {
    rotaCache.set(cacheKey, null);
    return null;
  }

  const feature = features.find((f) => f.properties?.['LINHA'] === lineCode) ?? features[0];

  const geom = feature?.geometry;
  if (!geom) {
    rotaCache.set(cacheKey, null);
    return null;
  }

  const coords: [number, number][] = [];
  if (geom.type === 'MultiLineString') {
    for (const line of geom.coordinates as number[][][]) coords.push(...geoToLatLon(line));
  } else if (geom.type === 'LineString') {
    coords.push(...geoToLatLon(geom.coordinates as number[][]));
  }

  const result = coords.length >= 2 ? coords : null;
  rotaCache.set(cacheKey, result);
  return result;
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
  // Use WFS native bbox param — avoids needing the geometry field name for CQL
  const deltaLat = radiusM / 111111;
  const deltaLon = radiusM / (111111 * Math.cos((lat * Math.PI) / 180));
  const bbox = `${lon - deltaLon},${lat - deltaLat},${lon + deltaLon},${lat + deltaLat},EPSG:4326`;

  const url =
    GEOSERVER +
    '?service=WFS&version=2.0&request=GetFeature' +
    '&typeName=SIM%3ALinhasAtuaisEFuturas' +
    '&outputFormat=application%2Fjson' +
    '&bbox=' +
    encodeURIComponent(bbox);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`GeoServer bbox ${res.status}`);
  const data = (await res.json()) as { features?: GeoServerFeature[] };
  const features: GeoServerFeature[] = data.features ?? [];
  if (!features.length) return [];

  // Collect (LINHA, SENTIDO) → nearest route point distance (sampled to avoid iterating huge geometries)
  const lineMap = new Map<string, { lineCode: string; sentido: 1 | 2; nearestM: number }>();

  for (const feature of features) {
    const props = feature.properties ?? {};
    const lineCode: string = String(props.LINHA ?? '').trim();
    const sentido = (Number(props.SENTIDO) === 2 ? 2 : 1) as 1 | 2;
    if (!lineCode) continue;

    const key = `${lineCode}|${sentido}`;
    let minDist = lineMap.get(key)?.nearestM ?? Infinity;

    const samplePairs = (pairs: number[][]) => {
      const step = Math.max(1, Math.floor(pairs.length / 30));
      for (let i = 0; i < pairs.length; i += step) {
        const d = haversineMeters(lat, lon, pairs[i][1], pairs[i][0]);
        if (d < minDist) minDist = d;
      }
    };

    const geom = feature.geometry;
    if (geom?.type === 'MultiLineString') {
      for (const seg of geom.coordinates as number[][][]) samplePairs(seg);
    } else if (geom?.type === 'LineString') {
      samplePairs(geom.coordinates as number[][]);
    }

    lineMap.set(key, { lineCode, sentido, nearestM: minDist });
  }

  if (!lineMap.size) return [];

  // GeoServer LINHA = "REBO-10" → split into lineNum "REBO" + variant 10
  const parseGeoCode = (code: string) => {
    const idx = code.lastIndexOf('-');
    if (idx < 0) return { lineNum: code, variant: 0 };
    const v = parseInt(code.slice(idx + 1), 10);
    return { lineNum: code.slice(0, idx), variant: isNaN(v) ? 0 : v };
  };

  // Take closest 30 (line, direction) pairs to cap API calls
  const topEntries = [...lineMap.values()].sort((a, b) => a.nearestM - b.nearestM).slice(0, 30);

  // Fetch terminal names + cl by lineNum (not full code) — API does substring match
  const uniqueLineNums = [...new Set(topEntries.map((e) => parseGeoCode(e.lineCode).lineNum))];
  const linesByNum = new Map<string, SPLine[]>();
  await Promise.all(
    uniqueLineNums.map(async (lineNum) => {
      try {
        const lines = await buscarLinhas(lineNum);
        linesByNum.set(lineNum, lines);
      } catch {
        /* skip */
      }
    }),
  );

  // Build result: for each unique line code, include ALL directions from the API
  const seenCl = new Set<number>();
  const seenCode = new Set<string>();
  const result: SPNearbyLine[] = [];

  for (const { lineCode, nearestM } of topEntries) {
    if (seenCode.has(lineCode)) continue;
    seenCode.add(lineCode);

    const { lineNum, variant } = parseGeoCode(lineCode);
    const allLines = linesByNum.get(lineNum) ?? [];
    const matchingVariant = allLines.filter((l) => l.tl === variant);
    const candidates = matchingVariant.length > 0 ? matchingVariant : allLines.slice(0, 2);

    for (const line of candidates) {
      if (seenCl.has(line.cl)) continue;
      seenCl.add(line.cl);
      result.push({
        cl: line.cl,
        c: `${line.lt}-${line.tl}`,
        sl: (line.sl === 2 ? 2 : 1) as 1 | 2,
        lt0: line.tp,
        lt1: line.ts,
        qv: 0,
        nearestBusM: nearestM,
        vs: [],
      });
    }
  }

  return result.sort((a, b) => a.nearestBusM - b.nearestBusM);
}

// ── Previsão ─────────────────────────────────────────────────────────────────

export async function getPrevisaoParada(codigoParada: number): Promise<SPArrivalResponse> {
  return get<SPArrivalResponse>('/Previsao/Parada', { codigoParada });
}

export async function getPrevisaoLinhaNaParada(
  codigoParada: number,
  codigoLinha: number,
): Promise<SPArrivalResponse> {
  return get<SPArrivalResponse>('/Previsao', { codigoParada, codigoLinha });
}

// ── Utilitários ──────────────────────────────────────────────────────────────

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
