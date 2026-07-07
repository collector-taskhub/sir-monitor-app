const CACHE = 'sir-monitor-v4'; // bump this EVERY time you change app.js/index.html/styles.css
const SHELL = ['./index.html', './app.js', './styles.css', './manifest.json'];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // activate the new worker immediately, don't wait for old tabs to close
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)) // wipe old caches
      )
    ).then(() => self.clients.claim()) // take control of open tabs right away
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Only manage our own site's files. Let everything else (like calls to script.google.com)
  // pass through untouched -- otherwise the service worker's own fetch() re-triggers CORS.
  if (url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
