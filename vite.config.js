import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Disc Golf Manager & Caddie',
        short_name: 'Disc Golf',
        description: 'Putting practice, stats, and caddie tools for disc golf.',
        // Sun-Drenched Topo tokens, matching the <meta name="theme-color">
        // in index.html. background_color is the standalone splash backdrop,
        // so a non-palette value flashes on every cold start; pure white is
        // banned by the design system.
        theme_color: '#F4F1EA',
        background_color: '#F4F1EA',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App-shell caching only: precache the built JS/CSS/HTML/icons so the
        // shell loads offline/on flaky signal. Deliberately no runtimeCaching
        // entries here — Supabase reads/writes must always hit the network.
        // Offline data buffering is handled by the InstantLaunch outbox and
        // the Dexie repository layer, not by the service worker.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
})
