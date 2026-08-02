/* ROMA - Service Worker: Offline-Betrieb auf dem iPad */
var CACHE = 'roma-v1';
var DATEIEN = [
  './',
  './index.html',
  './style.css',
  './js/data.js',
  './js/world.js',
  './js/sim.js',
  './js/render.js',
  './js/ui.js',
  './js/main.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './favicon-32.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(DATEIEN); }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Netz zuerst, Cache als Rückfall - so kommen Updates sofort an,
   das Spiel läuft aber auch ohne Verbindung. */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (antwort) {
      var kopie = antwort.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, kopie); }).catch(function () { });
      return antwort;
    }).catch(function () {
      return caches.match(e.request).then(function (treffer) {
        return treffer || caches.match('./index.html');
      });
    })
  );
});
