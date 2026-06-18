export interface SPLine {
  cl: number; // line code (direction-specific)
  lc: boolean; // circular
  lt: string; // line number e.g. "3046"
  tl: number; // variant e.g. 10
  tp: string; // terminal principal (origin name)
  ts: string; // terminal secundário (destination name)
  sl: 1 | 2; // direction
  // derived helper — built client-side
  lt0?: string;
  lt1?: string;
}

export interface SPStop {
  cp: number; // stop code
  np: string; // stop name
  ed: string; // address
  py: number; // latitude
  px: number; // longitude
  distance?: number; // calculated client-side (meters)
}

export interface SPVehicle {
  p: number | string; // vehicle ID
  a: boolean; // active
  py: number; // latitude
  px: number; // longitude
  ta?: string; // last update ISO timestamp
  lineCode?: string; // display code, e.g. "5103-10" — set client-side
  lineColor?: string; // hex color, set client-side
}

export interface SPLinePosition {
  c: string; // line display code
  cl: number; // line code
  sl: number; // direction (1 | 2)
  lt0: string; // terminal 0
  lt1: string; // terminal 1
  qv: number; // vehicle count
  vs: SPVehicle[];
}

export interface SPPositionResponse {
  hr: string; // official time
  l?: SPLinePosition[]; // lines with vehicles
  vs?: SPVehicle[]; // vehicles (flat, when querying by line)
}

export interface SPArrivalVehicle {
  p: number | string; // vehicle ID
  t: string; // predicted arrival time e.g. "13:58"
  a: boolean; // accessible
  ta: string; // last update ISO timestamp
  py?: number;
  px?: number;
}

export interface SPArrivalLine {
  c: string; // display code e.g. "5103-10"
  cl: number;
  sl: number;
  lt0: string;
  lt1: string;
  qv: number;
  vs: SPArrivalVehicle[];
}

// Real API structure: GET /Previsao/Parada?codigoParada={cp}
// Returns { hr, p: { cp, np, py, px, l: SPArrivalLine[] } | null }
export interface SPArrivalStop {
  cp: number;
  np: string;
  py: number;
  px: number;
  l: SPArrivalLine[];
}

export interface SPArrivalResponse {
  hr: string;
  p: SPArrivalStop | null;
}

export interface OSMStop {
  osmId: number;
  lat: number;
  lon: number;
  name: string;
  gtfsRef?: string;
  shelter?: boolean;
  distance?: number;
}

export interface MetroStation {
  id: number;
  name: string;
  lat: number;
  lon: number;
  line?: string;
  network?: string;
  color?: string;
}

export interface MetroLineData {
  id: string;
  line: string;
  network: string;
  color: string;
  coords: [number, number][];
}

export type RouteColorMap = Record<string, { color: string; textColor: string }>;

export interface SPNearbyLine {
  cl: number; // line code (direction-specific)
  c: string; // display number e.g. "8000-10"
  sl: 1 | 2; // direction: 1=ida, 2=volta
  lt0: string; // terminal origin
  lt1: string; // terminal destination
  qv: number; // active vehicle count nearby (0 when search is stop-based)
  nearestBusM: number; // distance of closest stop or bus (meters)
  vs: SPVehicle[]; // all vehicles for this line
}
