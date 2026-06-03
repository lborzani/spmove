import React, { useRef, useEffect, useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { SPStop, SPVehicle } from '@/constants/sptransTypes';

import type { OSMStop } from '@/constants/sptransTypes';

interface BusMapProps {
  userCoords?: { lat: number; lon: number } | null;
  stops?: SPStop[];
  osmStops?: OSMStop[];
  vehicles?: SPVehicle[];
  routeStops?: SPStop[];
  routeLineCode?: string | null;
  routeCoords?: [number, number][] | null; // GTFS shape — skips OSM Overpass when set
  selectedStopId?: number | null;
  centerOn?: { lat: number; lon: number; zoom?: number } | null;
  onStopPress?: (stop: SPStop) => void;
  onOsmStopPress?: (stop: OSMStop) => void;
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

  var userMarker = null;
  var stopMarkers = [];
  var osmMarkers  = [];
  var busMarkers  = [];
  var routeLine   = null;

  function send(data) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(data)); } catch(e) {}
  }

  // Signal readiness to React Native after map is initialized
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

  function setVehicles(vehicles) {
    busMarkers.forEach(function(m) { m.remove(); });
    busMarkers = [];

    vehicles.forEach(function(v) {
      if (v.py == null || v.px == null) return;
      var m = L.circleMarker([v.py, v.px], {
        radius: 7,
        fillColor: v.a ? '#1a6ef5' : '#666666',
        fillOpacity: 1,
        color: '#ffffff',
        weight: 2,
      }).addTo(map);
      m.bindPopup('Ônibus ' + v.p);
      busMarkers.push(m);
    });
  }

  function drawPolyline(coords, fit) {
    if (routeLine) { routeLine.remove(); routeLine = null; }
    routeLine = L.polyline(coords, { color: '#3D9EFF', weight: 5, opacity: 0.9 }).addTo(map);
    if (fit) {
      try { map.fitBounds(routeLine.getBounds().pad(0.08), { animate: true }); } catch(e) {}
    }
  }

  function noRouteAvailable() {
    // OSM doesn't have this line mapped — don't draw a fake route.
    // Stops are still shown as markers; send a message so UI can show a note.
    send({ type: 'no-route' });
  }

  // Properly chain OSM ways into a continuous path.
  // Consecutive ways may need to be flipped to connect end-to-start.
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
      // skip duplicate junction node
      path = path.concat(wc.slice(1));
    }
    return path;
  }

  var lastRouteKey = null;

  function setRoute(coords, lineCode, gtfsCoords, routeKey) {
    var fit = routeKey !== lastRouteKey;
    lastRouteKey = routeKey;
    if (routeLine) { routeLine.remove(); routeLine = null; }

    // GeoServer/GTFS shape tem prioridade — não depende de coords
    if (gtfsCoords && gtfsCoords.length >= 2) {
      drawPolyline(gtfsCoords, fit);
      return;
    }

    if (!coords || coords.length < 2) return;

    if (!lineCode) { noRouteAvailable(); return; }

    // Fallback: OSM Overpass
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
        drawPolyline(path, fit);
      })
      .catch(function(){ clearTimeout(timer); noRouteAvailable(); });
  }

  function clearLine() {
    busMarkers.forEach(function(m) { m.remove(); });
    busMarkers = [];
    if (routeLine) { routeLine.remove(); routeLine = null; }
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
        case 'set-route':    setRoute(msg.coords, msg.lineCode || null, msg.gtfsCoords || null, msg.routeKey || null); break;
        case 'clear-line':   clearLine(); break;
        case 'select-stop':  refreshSelectedStop(msg.id); break;
        case 'pan-to':       panTo(msg.lat, msg.lon, msg.zoom); break;
      }
    } catch(e) {}
  }

  document.addEventListener('message', handleMsg);
  window.addEventListener('message', handleMsg);
</script>
</body>
</html>`;

export function BusMap({
  userCoords,
  stops,
  osmStops,
  vehicles,
  routeStops,
  routeLineCode,
  routeCoords,
  selectedStopId,
  centerOn,
  onStopPress,
  onOsmStopPress,
  onNoRoute,
}: BusMapProps) {
  const wvRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  // Queue messages that arrive before WebView is ready
  const queue = useRef<object[]>([]);

  const inject = useCallback((js: string) => {
    wvRef.current?.injectJavaScript(`(function(){ ${js} })(); true;`);
  }, []);

  const send = useCallback((obj: object) => {
    if (!ready) {
      queue.current.push(obj);
      return;
    }
    inject(`handleMsg({ data: ${JSON.stringify(JSON.stringify(obj))} })`);
  }, [ready, inject]);

  // Flush queue when WebView becomes ready
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
    send({ type: 'set-vehicles', vehicles: vehicles ?? [] });
  }, [vehicles, send]);

  useEffect(() => {
    const hasRoute = (routeStops && routeStops.length > 0) || (routeCoords && routeCoords.length > 0);
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
    });
  }, [routeStops, routeLineCode, routeCoords, send]);

  useEffect(() => {
    if (!centerOn) return;
    send({ type: 'pan-to', lat: centerOn.lat, lon: centerOn.lon, zoom: centerOn.zoom ?? 17 });
  }, [centerOn, send]);

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
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
      if (msg.type === 'no-route' && onNoRoute) {
        onNoRoute();
      }
    } catch {}
  }, [onStopPress, onOsmStopPress, onNoRoute]);

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
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
