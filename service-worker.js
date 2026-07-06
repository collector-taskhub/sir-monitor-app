const CACHE = 'sir-monitor-v3';
const SHELL = ['./index.html', './app.js', './styles.css', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Only manage our own site's files. Let everything else (like calls to script.google.com)
  // pass through untouched -- otherwise the service worker's own fetch() re-triggers CORS.
  if (url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
