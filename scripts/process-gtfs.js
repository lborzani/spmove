#!/usr/bin/env node
/**
 * Processa GTFS do SPTrans → assets/gtfs-shapes.json
 *
 * Como usar:
 *   1. Baixe o GTFS em: https://www.sptrans.com.br/desenvolvedores/gtfs-da-sptrans/
 *   2. Extraia o ZIP em algum diretório (ex: ~/Downloads/gtfs/)
 *   3. Execute: node scripts/process-gtfs.js ~/Downloads/gtfs/
 *
 * Saída: assets/gtfs-shapes.json
 * Formato: { "702C10": [[-23.55, -46.63], ...], ... }
 * Chave: route_short_name normalizado (maiúsc, sem hífens/espaços)
 */

const fs   = require('fs');
const path = require('path');
const rl   = require('readline');

const gtfsDir = process.argv[2];
if (!gtfsDir) {
  console.error('Uso: node scripts/process-gtfs.js <gtfs-dir>');
  process.exit(1);
}

// ── CSV parser simples (handles quoted fields) ──────────────────────────────

function parseLine(line) {
  const result = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

async function readCSV(filepath) {
  const rows = [];
  let headers = null;
  const reader = rl.createInterface({
    input: fs.createReadStream(filepath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const rawLine of reader) {
    // strip BOM
    const line = rawLine.replace(/^﻿/, '').trim();
    if (!line) continue;
    const vals = parseLine(line);
    if (!headers) { headers = vals; continue; }
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] ?? '').trim(); });
    rows.push(obj);
  }
  return rows;
}

function normalize(code) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const routesPath = path.join(gtfsDir, 'routes.txt');
  const tripsPath  = path.join(gtfsDir, 'trips.txt');
  const shapesPath = path.join(gtfsDir, 'shapes.txt');

  for (const p of [routesPath, tripsPath, shapesPath]) {
    if (!fs.existsSync(p)) {
      console.error(`Arquivo não encontrado: ${p}`);
      process.exit(1);
    }
  }

  // 1. routes.txt → routeId → normalizedShortName
  console.log('Lendo routes.txt...');
  const routeRows = await readCSV(routesPath);
  const routeIdToName = new Map();
  for (const r of routeRows) {
    const id   = r.route_id;
    const name = r.route_short_name || r.route_long_name || '';
    if (id && name) routeIdToName.set(id, normalize(name));
  }
  console.log(`  ${routeIdToName.size} rotas`);

  // 2. trips.txt → normalizedShortName → { dir: shapeId }
  //    direction_id=0 → main direction, 1 → return
  console.log('Lendo trips.txt...');
  const tripRows = await readCSV(tripsPath);
  const nameToShapes = new Map(); // normName → { '0': shapeId, '1': shapeId }
  for (const t of tripRows) {
    if (!t.shape_id || !t.route_id) continue;
    const name = routeIdToName.get(t.route_id);
    if (!name) continue;
    if (!nameToShapes.has(name)) nameToShapes.set(name, {});
    const dir = t.direction_id || '0';
    const entry = nameToShapes.get(name);
    if (!entry[dir]) entry[dir] = t.shape_id; // first trip wins
  }
  console.log(`  ${nameToShapes.size} nomes com shapes`);

  // 3. Collect needed shape IDs
  const neededIds = new Set();
  for (const dirs of nameToShapes.values()) {
    for (const sid of Object.values(dirs)) neededIds.add(sid);
  }
  console.log(`  ${neededIds.size} shape IDs necessários`);

  // 4. shapes.txt (streaming) → shapeId → sorted [[lat,lon], ...]
  console.log('Lendo shapes.txt (streaming)...');
  const rawPoints = new Map(); // shapeId → [[lat, lon, seq], ...]
  let headers = null;
  let pointCount = 0;
  const shapeReader = rl.createInterface({
    input: fs.createReadStream(shapesPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const rawLine of shapeReader) {
    const line = rawLine.replace(/^﻿/, '').trim();
    if (!line) continue;
    const vals = parseLine(line);
    if (!headers) { headers = vals.map(h => h.trim()); continue; }
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim(); });
    const sid = obj.shape_id;
    if (!neededIds.has(sid)) continue;
    const lat = parseFloat(obj.shape_pt_lat);
    const lon = parseFloat(obj.shape_pt_lon);
    const seq = parseInt(obj.shape_pt_sequence, 10);
    if (isNaN(lat) || isNaN(lon) || isNaN(seq)) continue;
    if (!rawPoints.has(sid)) rawPoints.set(sid, []);
    rawPoints.get(sid).push([lat, lon, seq]);
    pointCount++;
    if (pointCount % 200_000 === 0) console.log(`  ...${(pointCount / 1000).toFixed(0)}k pontos`);
  }
  console.log(`  ${pointCount} pontos lidos`);

  // 5. Sort each shape by sequence, drop seq column
  for (const [sid, pts] of rawPoints) {
    pts.sort((a, b) => a[2] - b[2]);
    rawPoints.set(sid, pts.map(p => [
      Math.round(p[0] * 1e5) / 1e5,
      Math.round(p[1] * 1e5) / 1e5,
    ]));
  }

  // 6. Build output: normName → [[lat,lon], ...] (direction 0 preferred)
  const output = {};
  for (const [name, dirs] of nameToShapes) {
    const sid = dirs['0'] || dirs['1'] || Object.values(dirs)[0];
    const pts = rawPoints.get(sid);
    if (!pts || pts.length < 2) continue;
    output[name] = pts;
  }

  const outPath = path.join(__dirname, '..', 'assets', 'gtfs-shapes.json');
  fs.writeFileSync(outPath, JSON.stringify(output));

  const totalRoutes = Object.keys(output).length;
  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
  console.log(`\nPronto!`);
  console.log(`  Rotas: ${totalRoutes}`);
  console.log(`  Tamanho: ${sizeMB} MB`);
  console.log(`  Arquivo: ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
