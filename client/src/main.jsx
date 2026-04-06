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

// Registro del Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    // En desarrollo, desregistrar service workers para evitar problemas de cache
    if (import.meta.env.DEV) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (let registration of registrations) {
        await registration.unregister()
      }
      return
    }

    // En producción, registrar y actualizar service worker
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        // Forzar actualización del service worker si hay una nueva versión
        registration.update()
      })
      .catch((error) => {
        // Error registrando service worker
      })
  })
}
