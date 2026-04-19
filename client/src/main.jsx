import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)

// Limpieza de SW legacy.
// vite-plugin-pwa (con injectRegister: 'auto') se encarga de registrar /sw.js automáticamente.
// Este bloque solo desregistra el /service-worker.js viejo que quedaba de versiones previas y
// convivía con /sw.js causando loops de reload.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (const reg of registrations) {
        const url = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || ''
        if (url.endsWith('/service-worker.js')) {
          await reg.unregister()
        }
      }
      if (import.meta.env.DEV) {
        for (const reg of await navigator.serviceWorker.getRegistrations()) {
          await reg.unregister()
        }
      }
    } catch (_) {}
  })
}
