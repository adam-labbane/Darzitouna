/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Version du package.json injectée au build : elle sert de `release` Sentry
// et suivra donc automatiquement notre versionnage SemVer à venir.
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
)

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
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
            // NetworkFirst et non StaleWhileRevalidate : ce dernier renvoyait
            // immédiatement la réponse en cache et ne revalidait qu'en arrière-plan.
            // Une liste rechargée juste après une création affichait donc l'état
            // d'AVANT la mutation, et le nouvel enregistrement n'apparaissait
            // qu'au rechargement suivant — au risque que l'utilisateur croie à un
            // échec et saisisse deux fois.
            // Le cache reste un filet de sécurité hors ligne : au-delà du délai
            // réseau, ou sans réseau du tout, la dernière réponse connue est servie.
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-data',
              networkTimeoutSeconds: 3,
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
    // Deux projets plutôt qu'un environnement unique : les tests de logique
    // métier restent en `node` (démarrage quasi instantané), et seuls les
    // rares tests de rendu paient le coût de jsdom.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/tests/*.test.{ts,js}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/tests/dom/*.test.tsx'],
          // src/lib/supabase.ts appelle createClient dès l'import du module :
          // sans ces valeurs, le simple fait d'importer App ferait échouer le
          // test sur « supabaseUrl is required ». Aucune requête n'est émise,
          // les écrans testés ne déclenchent pas d'appel réseau.
          env: {
            VITE_SUPABASE_URL: 'http://localhost:54321',
            VITE_SUPABASE_ANON_KEY: 'cle-anon-de-test',
          },
        },
      },
    ],
  },
})
