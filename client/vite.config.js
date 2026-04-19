import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['images/logo.png', 'images/icon-192.png', 'images/icon-512.png'],
      manifest: {
        name: 'Clubix - Gestión Inteligente',
        short_name: 'Clubix',
        description: 'Clubix - Gestión Inteligente - Administración de cuotas, actividades y beneficios',
        theme_color: '#DC2626',
        background_color: '#F9FAFB',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        categories: ['sports', 'lifestyle', 'social'],
        icons: [
          {
            src: '/images/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/images/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        runtimeCaching: [
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
