import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
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
