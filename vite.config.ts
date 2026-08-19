import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the app at /<repo>/ — override with BASE_PATH for a custom domain.
const base = process.env.BASE_PATH ?? '/foodtrack/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'FoodTrack',
        short_name: 'FoodTrack',
        description: 'Eten loggen met je stem — calorieën en macro’s automatisch bijgehouden',
        lang: 'nl',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#F3F4EE',
        theme_color: '#F3F4EE',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            urlPattern: /\/data\/foods-extra\.json$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'foods-extra', networkTimeoutSeconds: 3 }
          },
          {
            urlPattern: /\/data\/foods-branded\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'foods-branded' }
          }
        ]
      }
    })
  ],
  test: {
    environment: 'node'
  }
} as Parameters<typeof defineConfig>[0])
