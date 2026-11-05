const CACHE_NAME = 'lizparks-v8';
const APP_SHELL = [
  './',
  './index.html',
  './confidentialite.html',
  './css/styles.css',
  './js/app.js',
  './js/storage.js',
  './js/fireworks.js',
  './js/sound.js',
  './js/flags.js',
  './data/parks.json',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];
const CACHEABLE_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

// `cache: 'reload'` / `'no-cache'` bypass stale HTTP-cache copies, otherwise a fresh app.js could be
// mixed with an outdated module it imports and the app would fail to start.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const outdated = (await caches.keys()).filter((key) => key !== CACHE_NAME);
      await Promise.all(outdated.map((key) => caches.delete(key)));
      await self.clients.claim();
      // On update, reload open tabs so they don't keep running a mix of old and new files.
      if (outdated.length) {
        const windows = await self.clients.matchAll({ type: 'window' });
        windows.forEach((client) => client.navigate(client.url).catch(() => {}));
      }
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  if (!isSameOrigin && !CACHEABLE_ORIGINS.includes(url.origin)) return;

  event.respondWith(networkFirst(request, isSameOrigin));
});

async function networkFirst(request, revalidate) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await (revalidate ? fetch(request, { cache: 'no-cache' }) : fetch(request));
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    return Response.error();
  }
}
