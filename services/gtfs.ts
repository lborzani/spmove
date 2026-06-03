type ShapeMap = Record<string, [number, number][]>;

let shapes: ShapeMap | null = null;

function loadShapes() {
  if (shapes !== null) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    shapes = require('../assets/gtfs-shapes.json') as ShapeMap;
  } catch {
    shapes = {};
  }
}

function normalize(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
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

export function gtfsLoaded(): boolean {
  loadShapes();
  return Object.keys(shapes ?? {}).length > 0;
}
