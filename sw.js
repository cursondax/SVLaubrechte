// SV Lau-Brechte Service Worker
// Versions-String bei jedem Release erhöhen, damit Clients neu laden
const CACHE_VERSION = 'svlb-v13';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './icon-192.png',
  './icon-512.png',
  './favicon-32.png',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-shadow.png'
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
      keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

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
  // Network-first für die index.html (damit Updates schnell beim Nutzer landen),
  // Cache-first für alles andere (Icons, Manifest).
  const isHtml = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (isHtml) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
  } else {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        return res;
      }))
    );
  }
});
