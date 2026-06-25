import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: {
    // Permite que paquetes locales (file: symlinks) resuelvan sus deps
    // desde el node_modules del proyecto host en lugar del directorio real.
    preserveSymlinks: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['images/logo.png', 'images/icon-192.png', 'images/icon-512.png'],
      // Manifest deshabilitado: lo servimos dinámicamente y branded por tenant desde
      // /api/pwa/manifest (ver server/src/routes/pwa.js + client/components/PwaManifest.jsx).
      // El service worker se sigue generando e inyectando normalmente.
      manifest: false,
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        // index.html se sirve siempre desde la red. Evita servir un index.html viejo
        // del precache que apunte a chunks que ya no existen tras un deploy.
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        navigateFallback: null,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/api\/socio\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-socio-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
                purgeOnQuotaError: true
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /\/uploads\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads-cache',
              expiration: {
                maxEntries: 40,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 días (antes 30)
                purgeOnQuotaError: true
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false // Deshabilitado en desarrollo para evitar problemas de cache
      },
      injectRegister: 'auto'
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Editor Monaco (muy pesado ~2MB por sí solo)
          'vendor-monaco': ['@monaco-editor/react'],
          // Gráficos
          'vendor-charts': ['chart.js', 'react-chartjs-2', 'recharts'],
          // Mapas
          'vendor-maps': ['leaflet', 'react-leaflet'],
          // Exportación Excel
          'vendor-xlsx': ['xlsx'],
          // Iconos
          'vendor-icons': ['lucide-react', '@heroicons/react'],
          // Socket + Query
          'vendor-realtime': ['socket.io-client', '@tanstack/react-query'],
          // Resto de deps
          'vendor-misc': ['date-fns', 'react-hot-toast', 'react-markdown', 'qrcode.react', '@yudiel/react-qr-scanner', 'react-google-recaptcha'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 8090,
    host: true,
    allowedHosts: ['sportivo.axiomacloud.com', 'localhost'],
  },
})
