const CACHE = 'invgen-v1';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './html/new-document.html',
  './html/preview.html',
  './css/styles.css',
  './js/db.js',
  './js/cloudflare.js',
  './js/company-config.js',
  './js/sync-config.js',
  './js/utils/constants.js',
  './js/utils/format.js',
  './js/pages/list.js',
  './js/pages/new-document.js',
  './js/pages/preview.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://unpkg.com/dexie@3.2.4/dist/dexie.min.js',
  'https://unpkg.com/pdfmake@0.2.10/build/pdfmake.min.js',
  'https://unpkg.com/pdfmake@0.2.10/build/vfs_fonts.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Cache each URL individually so one failure doesn't block the rest
      return Promise.allSettled(PRECACHE.map(url => cache.add(url)));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Only handle GET requests
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request, { redirect: 'follow' }).then(response => {
        // Don't cache opaque or error responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        return response;
      });
    })
  );
});
