const CACHE_NAME = 'emprende-venta-pos-cache-v6'; // Versión incrementada para forzar la actualización
const urlsToCache = [
    './',
    './index.html',
    './logo.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache and caching basic assets');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting(); // Forza al nuevo Service Worker a activarse inmediatamente.
});

self.addEventListener('fetch', event => {
    const { request } = event;

    // Estrategia: Network First, then Cache (Primero Red, luego Caché) para la API de la tasa.
    if (request.url.includes('https://ve.dolarapi.com')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Si la red funciona, se clona la respuesta, se guarda en caché y se devuelve.
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseToCache);
                    });
                    return response;
                })
                .catch(() => {
                    // Si la red falla, se intenta obtener la respuesta desde el caché.
                    console.log('Network failed, serving from cache for API');
                    return caches.match(request);
                })
        );
        return;
    }

    // Estrategia: Cache First (Primero Caché) para todo lo demás.
    event.respondWith(
        caches.match(request)
            .then(response => {
                if (response) {
                    return response; // Se devuelve desde el caché si existe.
                }

                // Si no está en caché, se busca en la red.
                return fetch(request).then(
                    networkResponse => {
                        if (!networkResponse || networkResponse.status !== 200) {
                            return networkResponse;
                        }
                        
                        // Si la solicitud fue exitosa y es de tipo GET, se guarda en caché.
                        if (request.method === 'GET') {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(request, responseToCache);
                            });
                        }
                        return networkResponse;
                    }
                );
            })
            .catch(() => {
                // Si todo falla, se muestra la página principal (para navegación).
                if (request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            })
    );
});


self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Se borran las versiones viejas del caché que no están en la whitelist.
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Asegura que el SW tome control de inmediato.
    );
});
