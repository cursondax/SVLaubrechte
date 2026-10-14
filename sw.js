// SV Lau-Brechte Service Worker
// Versions-String bei jedem Release erhöhen, damit Clients neu laden
const CACHE_VERSION = 'svlb-v51';
// Kartenkacheln in eigenem Cache: überlebt App-Updates (Karte bleibt offline
// nutzbar), ist aber auf TILE_MAX Kacheln begrenzt (~14 KB je Kachel).
// v2: Kacheln jetzt ohne a./b./c.-Subdomain -> alte Eintraege waren nutzlos
const TILE_CACHE = 'svlb-tiles-v2';
const TILE_MAX = 1000;
// Vorab geladene Offline-Karte (Knopf "Karte offline speichern" in index.html,
// gleicher Name dort). Wird nie gekuerzt und ueberlebt App-Updates.
const OFFLINE_TILES = 'svlb-offline-tiles-v1';
const PRECACHE = [
  './',
  './index.html',
  './padd.js',
  './manifest.json',
  './icon.png',
  './icon-192.png',
  './icon-512.png',
  './favicon-32.png',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-shadow.png',
  './vendor/jspdf/jspdf.umd.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_VERSION && k !== TILE_CACHE && k !== OFFLINE_TILES).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Älteste Kacheln löschen, wenn mehr als TILE_MAX gespeichert sind.
// Nicht bei jeder Kachel prüfen, sondern alle 50 neuen.
let tilePuts = 0;
function trimTiles() {
  return caches.open(TILE_CACHE).then((c) => c.keys().then((keys) => {
    const over = keys.length - TILE_MAX;
    if (over <= 0) return;
    // keys() liefert in Einfüge-Reihenfolge -> vorne stehen die ältesten
    return Promise.all(keys.slice(0, over).map((k) => c.delete(k)));
  }));
}

// Cache-first mit Speichern nur erfolgreicher Antworten.
// Fehlerseiten (404, 429 "Too many requests" usw.) werden nie gespeichert.
function cacheFirst(event, req, cacheName, onStore, matchOpts) {
  event.respondWith(
    caches.match(req, matchOpts).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        event.waitUntil(caches.open(cacheName).then((c) => c.put(req, copy)).then(onStore));
      }
      return res;
    }))
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Nicht-GET-Requests (POST an die Sync-API) gar nicht abfangen
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Sync-API NIEMALS cachen – Server-Stand muss immer frisch sein.
  // Matcht alle PHP-Endpoints auf fremden Hosts (z.B. raw-bert.de/svlb/api.php).
  if (url.origin !== self.location.origin && url.pathname.endsWith('.php')) {
    return; // an Browser-Default fetch durchreichen, kein Cache-Touch
  }
  // Fahrrad-Routing ebenfalls nie cachen: enthält Koordinaten der Mitglieder
  // und ist nach jeder Tour-Änderung anders.
  if (url.hostname === 'routing.openstreetmap.de') return;
  // Geocoding nie cachen: die App merkt sich Ergebnisse selbst (sgO_geocache),
  // und eine Fehlerantwort wie "Too many requests" darf nicht hängen bleiben.
  if (url.hostname === 'nominatim.openstreetmap.org') return;
  // Kartenkacheln: eigener, begrenzter Cache
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    // Download fuer die Offline-Karte (cache:'no-store'): durchreichen, die
    // Seite speichert die Kachel selbst im Offline-Speicher
    if (req.cache === 'no-store') return;
    // Sucht in allen Speichern, also auch in der Offline-Karte.
    // ignoreVary: gespeicherte Kachel passt unabhaengig von Anfrage-Kopfzeilen.
    cacheFirst(event, req, TILE_CACHE, () => {
      if (++tilePuts % 50 === 0) return trimTiles();
    }, { ignoreVary: true });
    return;
  }
  // Network-first für die index.html (damit Updates schnell beim Nutzer landen),
  // Cache-first für alles andere (Icons, Manifest).
  const isHtml = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (isHtml) {
    // Gespeicherte Seite SOFORT zeigen, neue Version im Hintergrund holen.
    // Vorher wartete der Start auf die komplette Seite aus dem Netz: bei
    // schwachem Empfang 10-30 s weisser Bildschirm.
    // Ist die neue Seite anders, bekommt die App eine Nachricht und zeigt
    // "Neue Version verfuegbar".
    const netz = fetch(req).then(async (res) => {
      if (!res.ok) return res;
      const fuerCache = res.clone(), fuerVergleich = res.clone();
      const cache = await caches.open(CACHE_VERSION);
      const alt = (await cache.match(req)) || (await caches.match('./index.html'));
      const altText = alt ? await alt.text() : null;
      const neuText = await fuerVergleich.text();
      await cache.put(req, fuerCache);
      if (altText !== null && altText !== neuText) {
        const fenster = await self.clients.matchAll({ type: 'window' });
        fenster.forEach((c) => c.postMessage({ type: 'svlb-update' }));
      }
      return res;
    });
    event.waitUntil(netz.catch(() => {}));
    event.respondWith(
      caches.match(req)
        .then((r) => r || caches.match('./index.html'))
        .then((r) => r || netz)   // allererster Start: noch nichts gespeichert
        .catch(() => Response.error())
    );
  } else {
    cacheFirst(event, req, CACHE_VERSION);
  }
});
