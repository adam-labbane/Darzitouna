/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Dar Zitouna',
        short_name: 'Dar Zitouna',
        description: "Gestion d'huilerie — dépôts, pressage, cuves, facturation",
        start_url: '/',
        display: 'standalone',
        background_color: '#2D6A4F',
        theme_color: '#2D6A4F',
        lang: 'fr',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Sans cette exclusion, le service worker sert index.html pour toute
        // navigation : /sonde-api afficherait le 404 de React Router au lieu
        // d'atteindre la Pages Function.
        navigateFallbackDenylist: [/^\/sonde-/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1/'),
            method: 'GET',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-data',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
