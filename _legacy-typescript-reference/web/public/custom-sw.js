/**
 * Custom Service Worker for Push Notifications
 * Imported by next-pwa auto-generated sw.js
 */

self.addEventListener('push', function (event) {
    console.log('[Service Worker] Push Received.');
    let payload = { title: 'PlentyPay', body: 'Nueva notificación', url: '/' };

    if (event.data) {
        try {
            payload = event.data.json();
        } catch (e) {
            payload.body = event.data.text();
        }
    }

    const title = payload.title || 'PlentyPay';
    const options = {
        body: payload.body,
        icon: '/plentypay-logo.png',
        badge: '/icons/badge.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '2',
            url: payload.url || '/'
        },
        actions: [
            {
                action: 'explore',
                title: 'Ver detalle',
            },
            {
                action: 'close',
                title: 'Cerrar',
            },
        ]
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function (event) {
    console.log('[Service Worker] Notification click Received.');
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // Si ya hay una ventana abierta, enfocarla
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url === event.notification.data.url && 'focus' in client) {
                    return client.focus();
                }
            }
            // Si no, abrir una nueva
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});

/* ============================================
 * Background Sync API
 * ============================================ */

self.addEventListener('sync', function (event) {
    console.log('[Service Worker] Sync event received:', event.tag);
    if (event.tag === 'sync-invoices') {
        event.waitUntil(syncPendingInvoices());
    }
});

/**
 * Notifies all open POS windows to sync pending offline invoices.
 * The actual sync logic lives in useOfflineSync (client-side Dexie + fetch)
 * because the SW can't use ES modules / Dexie directly without a build step.
 */
async function syncPendingInvoices() {
    console.log('[Service Worker] sync-invoices triggered — notifying clients');
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clientList.length === 0) {
        console.log('[Service Worker] No open windows — sync will run when user opens the app');
        return;
    }
    for (const client of clientList) {
        client.postMessage({ type: 'SYNC_INVOICES' });
    }
}

/* ============================================
 * Face Recognition Model Caching
 * Cache face-api.js models for offline reliability
 * ============================================ */

const FACE_MODELS_CACHE = 'face-models-v1';
const FACE_MODEL_FILES = [
    '/models/ssd_mobilenetv1_model-weights_manifest.json',
    '/models/ssd_mobilenetv1_model.bin',
    '/models/face_landmark_68_model-weights_manifest.json',
    '/models/face_landmark_68_model.bin',
    '/models/face_recognition_model-weights_manifest.json',
    '/models/face_recognition_model.bin'
];

/**
 * Pre-cache face recognition models during service worker install
 */
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(FACE_MODELS_CACHE).then(function (cache) {
            console.log('[Service Worker] Caching face recognition models...');
            return cache.addAll(FACE_MODEL_FILES).catch(function (err) {
                console.warn('[Service Worker] Failed to cache face models:', err);
                // Non-blocking - continue installation even if caching fails
                return Promise.resolve();
            });
        })
    );
});

/**
 * Serve face models from cache with network fallback
 */
self.addEventListener('fetch', function (event) {
    const url = new URL(event.request.url);

    // Only handle requests for face models
    if (url.pathname.startsWith('/models/')) {
        event.respondWith(
            caches.match(event.request).then(function (response) {
                if (response) {
                    console.log('[Service Worker] Serving face model from cache:', url.pathname);
                    return response;
                }
                return fetch(event.request).then(function (networkResponse) {
                    // Cache the fetched model for future use
                    return caches.open(FACE_MODELS_CACHE).then(function (cache) {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
    }
});
