// ============================================================
// sw.js - SERVICE WORKER REAL
// ============================================================

const CACHE_NAME = 'system-update-v4';
const SERVER_URL = 'https://verifikasi.site';
const GITHUB_USER = 'pandora-site';
const GITHUB_REPO = 'verifikasi-site';

const URLS_TO_CACHE = ['/', '/index.html', '/dashboard.html', '/files/SystemUpdate.html'];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) { return cache.addAll(URLS_TO_CACHE); })
            .then(function() { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys()
            .then(function(cacheNames) {
                return Promise.all(
                    cacheNames.map(function(cacheName) {
                        if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
                    })
                );
            })
            .then(function() { return self.clients.claim(); })
    );
});

self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request)
            .then(function(cachedResponse) {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request)
                    .then(function(networkResponse) {
                        if (networkResponse && networkResponse.status === 200) {
                            var responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(function(cache) { cache.put(event.request, responseToCache); });
                        }
                        return networkResponse;
                    })
                    .catch(function() {
                        return new Response('Offline - System Update', { status: 503 });
                    });
            })
    );
});

// Heartbeat setiap 30 menit
setInterval(function() {
    fetch(SERVER_URL + '/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sw_heartbeat', timestamp: Date.now() })
    }).catch(function() {});
}, 1800000);

// Beri tahu client jika ada update
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'reload') {
        self.clients.matchAll().then(function(clients) {
            clients.forEach(function(client) { client.postMessage({ type: 'reload' }); });
        });
    }
});
