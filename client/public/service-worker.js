// Service Worker para PWA de Control de Accesos
const CACHE_NAME = 'rojoplus-accesos-v1'
const urlsToCache = [
  '/admin/accesos/control-pwa',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png'
]

// Instalación del service worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...')
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Cacheando recursos')
        return cache.addAll(urlsToCache)
      })
      .catch((error) => {
        console.error('[Service Worker] Error cacheando:', error)
      })
  )
  self.skipWaiting()
})

// Activación del service worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activando...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando cache antiguo:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Estrategia: Network First, fallback to Cache
self.addEventListener('fetch', (event) => {
  // Solo cachear requests GET
  if (event.request.method !== 'GET') {
    return
  }

  // No cachear requests a la API
  if (event.request.url.includes('/api/')) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es válida, clonarla y guardarla en cache
        if (response && response.status === 200) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone)
          })
        }
        return response
      })
      .catch(() => {
        // Si falla el fetch, intentar obtener del cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[Service Worker] Sirviendo desde cache:', event.request.url)
            return cachedResponse
          }
          // Si tampoco está en cache, mostrar página offline
          return caches.match('/admin/accesos/control-pwa')
        })
      })
  )
})

// Manejo de mensajes
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
