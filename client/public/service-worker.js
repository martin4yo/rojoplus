// Kill-switch del SW legacy.
// Este archivo existía en versiones previas y convivía con /sw.js (vite-plugin-pwa),
// causando loops de reload. Ahora solo se desregistra y limpia sus caches.
// No borrar el archivo — si se devuelve 404, los navegadores con el SW viejo
// registrado no reciben actualización y siguen rotos.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.map(k => caches.delete(k)))
    await self.registration.unregister()
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const c of clients) c.navigate(c.url)
  })())
})
