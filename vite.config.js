import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  test: {
    // Vitest's default include matches **/*.spec.js, which would sweep up the
    // Playwright suite and fail at import — those specs need a browser and a
    // running server, not jsdom. `npm run test:e2e` owns e2e/.
    //
    // `.claude/worktrees/**` holds linked git worktrees created by isolated
    // subagent runs. Each is a full checkout of this repository, so without
    // this the suite re-runs every test once per live worktree — inflating the
    // count several-fold and reporting failures from another agent's
    // half-finished tree as if they were failures here. Ignoring them in
    // .gitignore is not enough; vitest walks the filesystem, not the index.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', '**/.claude/worktrees/**'],
  },
  build: {
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            // Pin the framework runtime into its own chunk.
            //
            // This does not make a cold start download fewer bytes — these
            // are needed to render anything, and Vite emits a modulepreload
            // for the chunk, so it is fetched in parallel with the entry
            // rather than after it. What it changes is what a *deploy* costs.
            //
            // The service worker precaches every built asset and revalidates
            // by hashed filename, so any chunk whose contents move gets
            // re-downloaded on the next visit. Left in the entry chunk, these
            // ~240 kB of never-changing vendor code carried a new hash every
            // time a shell component changed — meaning a one-line fix cost a
            // phone on cell signal the whole framework again. Split out, the
            // vendor chunk's hash only moves when the dependency actually
            // does, and a typical deploy re-downloads app code alone.
            //
            // Grouping is safe here because nothing in this set imports app
            // code, so no chunk cycle can form.
            {
              name: 'vendor-react',
              test: /\/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//,
            },
            {
              name: 'vendor-query',
              test: /\/node_modules\/@tanstack\//,
            },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' + manual registration (see src/components/PwaUpdatePrompt.jsx).
      // 'autoUpdate' activated a new worker and reloaded the page as soon as a
      // deploy landed, and `main` auto-deploys — that could reload an active
      // capture session out from under the athlete mid-routine.
      registerType: 'prompt',
      injectRegister: null,
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
        // No skipWaiting/clientsClaim: a new worker stays in `waiting` until
        // the user accepts the update prompt, so an in-flight session is never
        // swapped underneath.
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
