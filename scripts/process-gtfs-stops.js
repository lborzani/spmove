#!/usr/bin/env node
/**
 * Processa GTFS do SPTrans → assets/gtfs-stops.json
 *
 * Como usar:
 *   1. Baixe o GTFS em: https://www.sptrans.com.br/umbraco/Surface/PerfilDesenvolvedor/BaixarGTFS?memberName=sptrans
 *   2. Extraia o ZIP em algum diretório (ex: ~/Downloads/gtfs-sptrans/)
 *   3. Execute: node scripts/process-gtfs-stops.js ~/Downloads/gtfs-sptrans/
 *
 * Saída: assets/gtfs-stops.json
 * Formato: { "875C1-1": [{cp, np, py, px, ed}], "875C1-2": [...] }
 * Chave: normalize(route_short_name) + "-" + sentido (1=ida/direction_id=0, 2=volta/direction_id=1)
 *
 * Nota: cp usa o stop_id do GTFS (≠ Olho Vivo cp). Paradas são para display.
 *       Previsões de chegada tentam getPrevisaoParada(cp) — falha graciosamente se não houver match.
 */

const fs = require('fs');
const path = require('path');
const rl = require('readline');

const gtfsDir = process.argv[2];
if (!gtfsDir) {
  console.error('Uso: node scripts/process-gtfs-stops.js <gtfs-dir>');
  process.exit(1);
}

function parseLine(line) {
  const result = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
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
    const line = rawLine.replace(/^﻿/, '').trim();
    if (!line) continue;
    const vals = parseLine(line);
    if (!headers) {
      headers = vals.map((h) => h.trim());
      continue;
    }
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (vals[i] ?? '').trim();
    });
    rows.push(obj);
  }
  return rows;
}

function normalize(code) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function main() {
  const stopsPath = path.join(gtfsDir, 'stops.txt');
  const routesPath = path.join(gtfsDir, 'routes.txt');
  const tripsPath = path.join(gtfsDir, 'trips.txt');
  const stopTimesPath = path.join(gtfsDir, 'stop_times.txt');

  for (const p of [stopsPath, routesPath, tripsPath, stopTimesPath]) {
    if (!fs.existsSync(p)) {
      console.error(`Não encontrado: ${p}`);
      process.exit(1);
    }
  }

  // 1. stops.txt → stopId → {cp, np, py, px}
  console.log('Lendo stops.txt...');
  const stopRows = await readCSV(stopsPath);
  const stopMap = new Map();
  for (const s of stopRows) {
    const lat = parseFloat(s.stop_lat);
    const lon = parseFloat(s.stop_lon);
    if (!s.stop_id || isNaN(lat) || isNaN(lon)) continue;
    stopMap.set(s.stop_id, {
      cp: parseInt(s.stop_code || s.stop_id, 10) || 0,
      np: (s.stop_name || '').replace(/"/g, '').trim(),
      py: Math.round(lat * 1e6) / 1e6,
      px: Math.round(lon * 1e6) / 1e6,
      ed: (s.stop_desc || '').replace(/"/g, '').trim(),
    });
  }
  console.log(`  ${stopMap.size} paradas`);

  // 2. routes.txt → routeId → normalizedShortName
  console.log('Lendo routes.txt...');
  const routeRows = await readCSV(routesPath);
  const routeIdToNorm = new Map();
  for (const r of routeRows) {
    const name = r.route_short_name || r.route_long_name || '';
    if (r.route_id && name) routeIdToNorm.set(r.route_id, normalize(name));
  }
  console.log(`  ${routeIdToNorm.size} rotas`);

  // 3. trips.txt → tripId → routeKey ("875C1-1" or "875C1-2")
  //    direction_id 0 → sentido 1 (ida), 1 → sentido 2 (volta)
  //    Keep ALL trips — we'll union stops across trips of same routeKey
  console.log('Lendo trips.txt...');
  const tripRows = await readCSV(tripsPath);
  const tripToKey = new Map();
  for (const t of tripRows) {
    const norm = routeIdToNorm.get(t.route_id);
    if (!norm || !t.trip_id) continue;
    const sentido = t.direction_id === '1' ? 2 : 1;
    tripToKey.set(t.trip_id, `${norm}-${sentido}`);
  }
  console.log(`  ${tripToKey.size} trips mapeadas`);

  // 4. stop_times.txt → routeKey → ordered stop list (union across trips)
  //    We track: routeKey → Map<stopId, minSequence> to preserve canonical order
  console.log('Lendo stop_times.txt...');
  const routeStopOrder = new Map(); // routeKey → Map<stopId, firstSeq>

  let lineCount = 0;
  let headers = null;
  const stReader = rl.createInterface({
    input: fs.createReadStream(stopTimesPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const rawLine of stReader) {
    const line = rawLine.replace(/^﻿/, '').trim();
    if (!line) continue;
    const vals = parseLine(line);
    if (!headers) {
      headers = vals.map((h) => h.trim());
      continue;
    }
    lineCount++;

    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (vals[i] ?? '').trim();
    });

    const routeKey = tripToKey.get(obj.trip_id);
    if (!routeKey) continue;

    const seq = parseInt(obj.stop_sequence, 10);
    if (isNaN(seq)) continue;

    if (!routeStopOrder.has(routeKey)) routeStopOrder.set(routeKey, new Map());
    const stopSeqs = routeStopOrder.get(routeKey);

    // Keep minimum sequence for each stop (earliest appearance in any trip)
    const existing = stopSeqs.get(obj.stop_id);
    if (existing === undefined || seq < existing) {
      stopSeqs.set(obj.stop_id, seq);
    }
  }
  console.log(`  ${lineCount} linhas, ${routeStopOrder.size} rotas com paradas`);

  // 5. Build output: routeKey → [{cp, np, py, px, ed}] sorted by sequence
  const output = {};
  for (const [routeKey, stopSeqs] of routeStopOrder) {
    const sorted = [...stopSeqs.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([stopId]) => stopMap.get(stopId))
      .filter(Boolean);
    if (sorted.length >= 2) output[routeKey] = sorted;
  }

  const outPath = path.join(__dirname, '..', 'assets', 'gtfs-stops.json');
  fs.writeFileSync(outPath, JSON.stringify(output));

  const totalRoutes = Object.keys(output).length;
  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log('\nPronto!');
  console.log(`  Rotas: ${totalRoutes}`);
  console.log(`  Tamanho: ${sizeMB} MB`);
  console.log(`  Arquivo: ${outPath}`);
  console.log('\nExemplo 875C:');
  for (const dir of [1, 2]) {
    const key = `875C1-${dir}`;
    const stops = output[key];
    console.log(`  ${key}: ${stops ? stops.length + ' paradas' : 'não encontrado'}`);
    if (stops) stops.slice(0, 3).forEach((s) => console.log(`    ${s.cp} ${s.np}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
