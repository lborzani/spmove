import React, { useRef, useEffect, useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type {
  SPStop,
  SPVehicle,
  OSMStop,
  MetroStation,
  MetroLineData,
} from '@/constants/sptransTypes';

interface BusMapProps {
  userCoords?: { lat: number; lon: number } | null;
  stops?: SPStop[];
  osmStops?: OSMStop[];
  spStops?: SPStop[];
  vehicles?: SPVehicle[];
  routeStops?: SPStop[];
  routeLineCode?: string | null;
  routeCoords?: [number, number][] | null;
  routeColor?: string | null;
  fitRoute?: boolean;
  allRoutes?: { coords: [number, number][]; color?: string }[] | null;
  selectedStopId?: number | null;
  metroStations?: MetroStation[];
  metroLines?: MetroLineData[];
  centerOn?: { lat: number; lon: number; zoom?: number } | null;
  onStopPress?: (stop: SPStop) => void;
  onOsmStopPress?: (stop: OSMStop) => void;
  onSpStopPress?: (stop: SPStop) => void;
  onNoRoute?: () => void;
}

const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #0d1614; }
    #map { width: 100%; height: 100%; }
    .leaflet-container { background: #1a2826; }
    .leaflet-control-attribution { font-size: 9px; }
    .user-loc {
      width: 18px; height: 18px; position: relative;
      display: flex; align-items: center; justify-content: center;
    }
    .user-loc-core {
      width: 14px; height: 14px; border-radius: 50%;
      background: #4FE566; border: 2.5px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.5);
      position: relative; z-index: 2;
    }
    .user-loc-ring {
      position: absolute; top: 50%; left: 50%;
      width: 18px; height: 18px; border-radius: 50%;
      background: rgba(79,229,102,0.35);
      transform: translate(-50%,-50%) scale(1);
      animation: ulpulse 2s ease-out infinite;
      z-index: 1;
    }
    @keyframes ulpulse {
      0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.8; }
      100% { transform: translate(-50%,-50%) scale(3.2); opacity: 0; }
    }
    .stop-pin {
      width: 10px; height: 10px; border-radius: 50%;
      background: #f5c54a; border: 2px solid #1e2e2b;
      box-shadow: 0 1px 4px rgba(0,0,0,0.55);
      cursor: pointer; position: relative;
    }
    .stop-pin.sel {
      width: 14px; height: 14px;
      background: #4FE566; border-color: #fff;
    }
    .bus-body {
      position: relative; width: 26px; height: 17px;
      background: #3D9EFF; border-radius: 4px;
      border: 2px solid #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.55);
    }
    .bus-body.acc { background: #4FE566; }
    .bus-body::before {
      content: ''; position: absolute;
      top: 3px; left: 2px; right: 2px; height: 4px;
      background: rgba(255,255,255,0.28); border-radius: 2px;
    }
    .bus-wheel {
      position: absolute; bottom: -5px;
      width: 7px; height: 7px; border-radius: 50%;
      background: #1e2e2b; border: 1.5px solid #fff;
    }
    .bus-wheel.l { left: 2px; }
    .bus-wheel.r { right: 2px; }
    .metro-pin {
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,0.9);
      box-shadow: 0 1px 6px rgba(0,0,0,0.7);
      cursor: pointer;
    }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', {
    center: [-23.5505, -46.6333],
    zoom: 13,
    zoomControl: false,
    attributionControl: false,
    tap: true,
    tapTolerance: 15,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
    maxNativeZoom: 18,
  }).addTo(map);

  var userMarker      = null;
  var stopMarkers     = [];
  var osmMarkers      = [];
  var spMarkers       = [];
  var busMarkers      = [];
  var busMarkerMap    = {};
  var metroMarkers    = [];
  var metroPolylines  = [];
  var metroStationsCache = [];
  var metroLinesCache    = [];
  var METRO_ZOOM_THRESHOLD = 15;
  var routeLine       = null;
  var allRouteLines   = [];

  function send(data) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(data)); } catch(e) {}
  }

  map.whenReady(function() {
    send({ type: 'ready' });
  });

  var userIcon = L.divIcon({
    className: '',
    html: '<div class="user-loc"><div class="user-loc-ring"></div><div class="user-loc-core"></div></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  });

  function setUserLocation(lat, lon) {
    if (userMarker) userMarker.remove();
    userMarker = L.marker([lat, lon], {
      icon: userIcon,
      zIndexOffset: 1000,
    }).addTo(map).bindPopup('Sua localização');
    map.setView([lat, lon], 15, { animate: true });
  }

  function setStops(stops, selectedId) {
    stopMarkers.forEach(function(m) { m.remove(); });
    stopMarkers = [];

    stops.forEach(function(stop) {
      var sel = stop.cp === selectedId;
      var m = L.circleMarker([stop.py, stop.px], {
        radius: sel ? 10 : 8,
        fillColor: sel ? '#4FE566' : '#e05c2a',
        fillOpacity: 1,
        color: '#ffffff',
        weight: 2.5,
        interactive: true,
      }).addTo(map);

      m.bindPopup('<b>' + stop.np + '</b><br><small>' + (stop.ed || '') + '</small>');
      m.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        send({ type: 'stop-tap', stop: stop });
      });
      m._stopData = stop;
      stopMarkers.push(m);
    });

    if (stops.length > 1) {
      var group = L.featureGroup(stopMarkers);
      try { map.fitBounds(group.getBounds().pad(0.25), { animate: true, maxZoom: 16 }); } catch(e) {}
    } else if (stops.length === 1) {
      map.setView([stops[0].py, stops[0].px], 16, { animate: true });
    }
  }

  function refreshSelectedStop(selectedId) {
    stopMarkers.forEach(function(m) {
      var sel = m._stopData && m._stopData.cp === selectedId;
      m.setStyle({
        fillColor: sel ? '#4FE566' : '#e05c2a',
        radius: sel ? 10 : 8,
      });
      if (sel) m.openPopup();
    });
  }

  function setOsmStops(stops) {
    osmMarkers.forEach(function(m) { m.remove(); });
    osmMarkers = [];
    stops.forEach(function(stop) {
      var m = L.circleMarker([stop.lat, stop.lon], {
        radius: 7,
        fillColor: '#f5c54a',
        fillOpacity: 1,
        color: '#ffffff',
        weight: 2,
        interactive: true,
      }).addTo(map);
      var label = stop.name || 'Parada';
      if (stop.shelter) label += ' 🏠';
      m.bindPopup('<b>' + label + '</b>');
      m.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        send({ type: 'osm-stop-tap', stop: stop });
      });
      osmMarkers.push(m);
    });
  }

  function setSpStops(stops, selectedId) {
    spMarkers.forEach(function(m) { m.remove(); });
    spMarkers = [];
    if (!stops.length) return;
    stops.forEach(function(stop) {
      var sel = stop.cp === selectedId;
      var pinCls = 'stop-pin' + (sel ? ' sel' : '');
      var icon = L.divIcon({
        className: '',
        html: '<div class="' + pinCls + '"></div>',
        iconSize: sel ? [14, 14] : [10, 10],
        iconAnchor: sel ? [7, 7] : [5, 5],
      });
      var m = L.marker([stop.py, stop.px], { icon: icon, interactive: true, zIndexOffset: sel ? 200 : 0 }).addTo(map);
      var popup = '<b>' + (stop.np || 'Parada') + '</b>';
      if (stop.ed) popup += '<br><small>' + stop.ed + '</small>';
      m.bindPopup(popup);
      m.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        send({ type: 'sp-stop-tap', stop: stop });
      });
      m._stopData = stop;
      m._isSel = sel;
      spMarkers.push(m);
    });
    if (map.getZoom() < METRO_ZOOM_THRESHOLD) {
      spMarkers.forEach(function(m) { m.remove(); });
    }
  }

  function refreshSelectedSpStop(id) {
    spMarkers.forEach(function(m) {
      var isSel = m._stopData && m._stopData.cp === id;
      if (m._isSel === isSel) return;
      m._isSel = isSel;
      var pinCls = 'stop-pin' + (isSel ? ' sel' : '');
      m.setIcon(L.divIcon({
        className: '',
        html: '<div class="' + pinCls + '"></div>',
        iconSize: isSel ? [14, 14] : [10, 10],
        iconAnchor: isSel ? [7, 7] : [5, 5],
      }));
      m.setZIndexOffset(isSel ? 200 : 0);
    });
  }

  // Incremental update: move existing markers, add new ones, remove stale ones.
  // Avoids full DOM teardown/rebuild on every 10s polling tick.
  function setVehicles(vehicles) {
    var seen = {};
    vehicles.forEach(function(v) {
      if (v.py == null || v.px == null) return;
      seen[v.p] = true;
      var lc = v.lineColor;
      var accCls = (v.a && !lc) ? ' acc' : '';
      var styleAttr = lc ? ' style="background:' + lc + '"' : '';
      var html = '<div class="bus-body' + accCls + '"' + styleAttr + '><span class="bus-wheel l"></span><span class="bus-wheel r"></span></div>';
      if (busMarkerMap[v.p]) {
        busMarkerMap[v.p].setLatLng([v.py, v.px]);
        busMarkerMap[v.p].setIcon(L.divIcon({ className: '', html: html, iconSize: [26, 22], iconAnchor: [13, 11] }));
      } else {
        var icon = L.divIcon({ className: '', html: html, iconSize: [26, 22], iconAnchor: [13, 11] });
        var m = L.marker([v.py, v.px], { icon: icon, zIndexOffset: 500 }).addTo(map);
        var popup = '<b>Ônibus ' + v.p + '</b>' + (v.a ? ' ♿' : '');
        if (v.lineCode) popup += '<br><small>Linha ' + v.lineCode + '</small>';
        m.bindPopup(popup);
        busMarkerMap[v.p] = m;
      }
    });
    for (var id in busMarkerMap) {
      if (!seen[id]) { busMarkerMap[id].remove(); delete busMarkerMap[id]; }
    }
    busMarkers = [];
    for (var id in busMarkerMap) { busMarkers.push(busMarkerMap[id]); }
  }

  function clearAllRoutes() {
    allRouteLines.forEach(function(pl) { pl.remove(); });
    allRouteLines = [];
  }

  function setMultiRoute(routes) {
    clearAllRoutes();
    if (routeLine) { routeLine.remove(); routeLine = null; }
    routes.forEach(function(r) {
      if (!r.coords || r.coords.length < 2) return;
      var pl = L.polyline(r.coords, { color: r.color || '#3D9EFF', weight: 4, opacity: 0.65 }).addTo(map);
      allRouteLines.push(pl);
    });
  }

  function buildMetroMarkers(stations) {
    stations.forEach(function(s) {
      var isCptm = (s.network || '').includes('CPTM');
      var shape = isCptm ? '3px' : '50%';
      var html = '<div class="metro-pin" style="background:' + (s.color || '#1B3FA6') + ';border-radius:' + shape + ';"></div>';
      var icon = L.divIcon({ className: '', html: html, iconSize: [14, 14], iconAnchor: [7, 7] });
      var m = L.marker([s.lat, s.lon], { icon: icon, zIndexOffset: 50 }).addTo(map);
      m.bindPopup('<b>' + s.name + '</b><br><small>' + (s.network || '') + ' · Linha ' + (s.line || '') + '</small>');
      metroMarkers.push(m);
    });
  }

  function renderMetro() {
    var zoom = map.getZoom();
    var showDetails = zoom >= METRO_ZOOM_THRESHOLD;

    spMarkers.forEach(function(m) { showDetails ? m.addTo(map) : m.remove(); });

    if (!showDetails) {
      metroMarkers.forEach(function(m) { m.remove(); });
      metroMarkers = [];
      if (metroPolylines.length === 0) {
        metroLinesCache.forEach(function(line) {
          var pl = L.polyline(line.coords, { color: line.color, weight: 3.5, opacity: 0.9 }).addTo(map);
          pl.bindPopup('<b>' + line.network + ' — Linha ' + line.line + '</b>');
          metroPolylines.push(pl);
        });
      }
    } else {
      metroPolylines.forEach(function(pl) { pl.remove(); });
      metroPolylines = [];
      if (metroMarkers.length === 0) {
        buildMetroMarkers(metroStationsCache);
      }
    }
  }

  map.on('zoomend', renderMetro);

  function setMetroStations(stations) {
    metroPolylines.forEach(function(pl) { pl.remove(); });
    metroPolylines = [];
    metroMarkers.forEach(function(m) { m.remove(); });
    metroMarkers = [];
    metroStationsCache = stations || [];
    renderMetro();
  }

  function drawPolyline(coords, fit, color) {
    if (routeLine) { routeLine.remove(); routeLine = null; }
    routeLine = L.polyline(coords, { color: color || '#3D9EFF', weight: 5, opacity: 0.55 }).addTo(map);
    if (fit) {
      try { map.fitBounds(routeLine.getBounds().pad(0.08), { animate: true }); } catch(e) {}
    }
  }

  function noRouteAvailable() {
    send({ type: 'no-route' });
  }

  // Ways in OSM relations may be out of order or reversed — chain them end-to-start.
  function assembleOsmWays(members) {
    var ways = members.filter(function(m) {
      return m.type === 'way' && m.geometry && m.geometry.length > 0
        && m.role !== 'stop' && m.role !== 'stop_entry_only'
        && m.role !== 'stop_exit_only' && m.role !== 'platform';
    });
    if (!ways.length) return [];

    var path = ways[0].geometry.map(function(p){ return [p.lat, p.lon]; });

    for (var i = 1; i < ways.length; i++) {
      var wc = ways[i].geometry.map(function(p){ return [p.lat, p.lon]; });
      var tail = path[path.length - 1];
      var d2first = Math.pow(wc[0][0]-tail[0],2) + Math.pow(wc[0][1]-tail[1],2);
      var d2last  = Math.pow(wc[wc.length-1][0]-tail[0],2) + Math.pow(wc[wc.length-1][1]-tail[1],2);
      if (d2last < d2first) wc = wc.reverse();
      path = path.concat(wc.slice(1));
    }
    return path;
  }

  var lastRouteKey = null;

  function setRoute(coords, lineCode, gtfsCoords, routeKey, allowFit, color) {
    clearAllRoutes();
    var fit = allowFit && routeKey !== lastRouteKey;
    lastRouteKey = routeKey;
    if (routeLine) { routeLine.remove(); routeLine = null; }

    if (gtfsCoords && gtfsCoords.length >= 2) {
      drawPolyline(gtfsCoords, fit, color);
      return;
    }

    if (!coords || coords.length < 2) return;

    if (!lineCode) { noRouteAvailable(); return; }

    var codes = [lineCode, lineCode.replace('-',''), lineCode.replace(/[^0-9A-Za-z]/g,'')];
    var unique = codes.filter(function(c,i){ return codes.indexOf(c)===i; });
    var q = '[out:json][timeout:12];(';
    unique.forEach(function(c){ q += 'relation["type"="route"]["route"="bus"]["ref"="'+c+'"];'; });
    q += ');out geom;';
    var url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q);

    var timer = setTimeout(function(){ noRouteAvailable(); }, 9000);

    fetch(url)
      .then(function(r){ return r.json(); })
      .then(function(data){
        clearTimeout(timer);
        var rels = (data.elements||[]).filter(function(e){ return e.type==='relation'; });
        if (!rels.length) { noRouteAvailable(); return; }
        rels.sort(function(a,b){ return (b.members||[]).length-(a.members||[]).length; });
        var path = assembleOsmWays(rels[0].members||[]);
        if (path.length < 2) { noRouteAvailable(); return; }
        drawPolyline(path, fit, color);
      })
      .catch(function(){ clearTimeout(timer); noRouteAvailable(); });
  }

  function clearLine() {
    if (routeLine) { routeLine.remove(); routeLine = null; }
    clearAllRoutes();
    // busMarkers managed exclusively by setVehicles
  }

  function panTo(lat, lon, zoom) {
    map.setView([lat, lon], zoom || map.getZoom(), { animate: true });
  }

  function handleMsg(event) {
    try {
      var msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'set-location': setUserLocation(msg.lat, msg.lon); break;
        case 'set-stops':    setStops(msg.stops, msg.selectedId); break;
        case 'set-vehicles': setVehicles(msg.vehicles); break;
        case 'set-osm-stops': setOsmStops(msg.stops); break;
        case 'set-sp-stops':     setSpStops(msg.stops, msg.selectedId || null); break;
        case 'set-metro':
          metroLinesCache = msg.lines || [];
          setMetroStations(msg.stations || []);
          break;
        case 'set-route':      setRoute(msg.coords, msg.lineCode || null, msg.gtfsCoords || null, msg.routeKey || null, msg.fit !== false, msg.color || null); break;
        case 'set-multi-route': setMultiRoute(msg.routes || []); break;
        case 'clear-multi-route': clearAllRoutes(); break;
        case 'clear-line':   clearLine(); break;
        case 'select-stop':  refreshSelectedStop(msg.id); refreshSelectedSpStop(msg.id); break;
        case 'pan-to':       panTo(msg.lat, msg.lon, msg.zoom); break;
      }
    } catch(e) {}
  }

  document.addEventListener('message', handleMsg);
  window.addEventListener('message', handleMsg);
</script>
</body>
</html>`;

export const BusMap = React.memo(function BusMap({
  userCoords,
  stops,
  osmStops,
  spStops,
  vehicles,
  routeStops,
  routeLineCode,
  routeCoords,
  routeColor,
  fitRoute,
  allRoutes,
  selectedStopId,
  metroStations,
  metroLines,
  centerOn,
  onStopPress,
  onOsmStopPress,
  onSpStopPress,
  onNoRoute,
}: BusMapProps) {
  const wvRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  const queue = useRef<object[]>([]);

  const inject = useCallback((js: string) => {
    wvRef.current?.injectJavaScript(`(function(){ ${js} })(); true;`);
  }, []);

  const send = useCallback(
    (obj: object) => {
      if (!ready) {
        queue.current.push(obj);
        return;
      }
      inject(`handleMsg({ data: ${JSON.stringify(JSON.stringify(obj))} })`);
    },
    [ready, inject],
  );

  useEffect(() => {
    if (!ready) return;
    const msgs = queue.current.splice(0);
    msgs.forEach((obj) => inject(`handleMsg({ data: ${JSON.stringify(JSON.stringify(obj))} })`));
  }, [ready, inject]);

  useEffect(() => {
    if (!userCoords) return;
    send({ type: 'set-location', lat: userCoords.lat, lon: userCoords.lon });
  }, [userCoords, send]);

  useEffect(() => {
    send({ type: 'set-stops', stops: stops ?? [], selectedId: selectedStopId ?? null });
  }, [stops, selectedStopId, send]);

  useEffect(() => {
    send({ type: 'set-osm-stops', stops: osmStops ?? [] });
  }, [osmStops, send]);

  useEffect(() => {
    send({ type: 'set-sp-stops', stops: spStops ?? [], selectedId: selectedStopId ?? null });
  }, [spStops, selectedStopId, send]);

  useEffect(() => {
    send({ type: 'select-stop', id: selectedStopId ?? null });
  }, [selectedStopId, send]);

  useEffect(() => {
    send({ type: 'set-vehicles', vehicles: vehicles ?? [] });
  }, [vehicles, send]);

  useEffect(() => {
    const hasRoute =
      (routeStops && routeStops.length > 0) || (routeCoords && routeCoords.length > 0);
    if (!hasRoute) {
      send({ type: 'clear-line' });
      return;
    }
    send({
      type: 'set-route',
      coords: routeStops?.map((s) => [s.py, s.px]) ?? [],
      lineCode: routeLineCode ?? null,
      gtfsCoords: routeCoords ?? null,
      routeKey: routeLineCode ?? null,
      fit: fitRoute !== false,
      color: routeColor ?? null,
    });
  }, [routeStops, routeLineCode, routeCoords, routeColor, fitRoute, send]);

  useEffect(() => {
    if (allRoutes && allRoutes.length > 0) {
      send({ type: 'set-multi-route', routes: allRoutes });
    } else {
      send({ type: 'clear-multi-route' });
    }
  }, [allRoutes, send]);

  useEffect(() => {
    send({ type: 'set-metro', stations: metroStations ?? [], lines: metroLines ?? [] });
  }, [metroStations, metroLines, send]);

  useEffect(() => {
    if (!centerOn) return;
    send({ type: 'pan-to', lat: centerOn.lat, lon: centerOn.lon, zoom: centerOn.zoom ?? 17 });
  }, [centerOn, send]);

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'ready') {
          setReady(true);
          return;
        }
        if (msg.type === 'stop-tap' && onStopPress) {
          onStopPress(msg.stop as SPStop);
        }
        if (msg.type === 'osm-stop-tap' && onOsmStopPress) {
          onOsmStopPress(msg.stop as OSMStop);
        }
        if (msg.type === 'sp-stop-tap' && onSpStopPress) {
          onSpStopPress(msg.stop as SPStop);
        }
        if (msg.type === 'no-route' && onNoRoute) {
          onNoRoute();
        }
      } catch {}
    },
    [onStopPress, onOsmStopPress, onSpStopPress, onNoRoute],
  );

  return (
    <WebView
      ref={wvRef}
      style={styles.map}
      source={{ html: HTML }}
      onMessage={handleMessage}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      mixedContentMode="always"
      allowFileAccess
    />
  );
});

const styles = StyleSheet.create({
  map: { flex: 1 },
});
