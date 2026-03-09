import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'

  return {
    base: '/',
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: [
          'favicon.png',
          'kuran.svg',
          'fonts/diyanet-kuran.ttf',
          'fonts/acikkuran-uthmanic.woff2'
        ],
        manifest: {
          name: 'Kuran23',
          short_name: 'Kuran23',
          description: 'Kuran-ı Kerim için sade, hızlı ve odaklı dijital okuma deneyimi.',
          theme_color: '#121212',
          background_color: '#121212',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: '/index.html',
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf}'],
          runtimeCaching: [
            {
              urlPattern: /\/tafsir-library\/.*\.json$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'tafsir-library-json',
                expiration: {
                  maxEntries: 2500,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                }
              }
            },
            {
              urlPattern: /\/diyanet_.*\.json$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-json',
                expiration: {
                  maxEntries: 12,
                  maxAgeSeconds: 60 * 60 * 24 * 7
                }
              }
            },
            {
              urlPattern: /^https:\/\/(api\.quran\.com|api\.acikkuran\.com|.*\.supabase\.co)\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-runtime',
                networkTimeoutSeconds: 8,
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24
                }
              }
            }
          ]
        }
      })
    ],
    esbuild: isProd
      ? {
        drop: ['console', 'debugger']
      }
      : undefined
  }
})
