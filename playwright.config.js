import { defineConfig, devices } from '@playwright/test'

// The E2E suite runs against the *built* app served by `vite preview`, not the
// dev server: the PWA plugin only emits the manifest and service worker on a
// real build, and Phase A's gate covers PWA behaviour alongside the flows.
const PORT = Number(process.env.E2E_PORT ?? 4173)
const BASE_URL = `http://127.0.0.1:${PORT}`

// Deliberately the same placeholders CI already exports for `npm test`. No
// suite in this repo may reach a real Supabase project — every backend
// response is intercepted in `e2e/fixtures/app.js`, so a real URL here would
// mean a test that silently depends on live data.
const SUPABASE_ENV = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'e2e-test-placeholder',
}

export default defineConfig({
  testDir: './e2e',
  // Throwaway exploration specs are gitignored under the same pattern. They
  // exist to poke at live IndexedDB/outbox state while authoring a real spec,
  // and must never be collected by a suite run.
  testIgnore: /(^|\/|\.)scratch\.spec\.js$/,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    // Sandboxes and dev containers often ship a pre-provisioned Chromium whose
    // build does not match the one this Playwright version would download.
    // Point E2E_CHROMIUM_PATH at it there; leave it unset in CI, where
    // `playwright install chromium` provides the matching build.
    ...(process.env.E2E_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH } }
      : {}),
  },

  projects: [
    // Mobile-first product, so the default profile is a phone rather than a
    // desktop viewport — a passing desktop run would not tell us much.
    {
      name: 'phone',
      testIgnore: /reflow\.spec\.js/,
      use: { ...devices['Pixel 7'] },
    },
    // 320px is the narrowest width the design system commits to. Only the
    // reflow spec runs here; re-running every flow at a second width would
    // double the wall clock for little added signal.
    {
      name: 'narrow-320',
      testMatch: /reflow\.spec\.js/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 640 } },
    },
  ],

  webServer: {
    // `--host 127.0.0.1` is load-bearing, not decoration. Without it `vite
    // preview` binds `localhost`, which on a GitHub runner resolves to ::1
    // first while `url` below is polled over IPv4 — the server comes up
    // healthy and Playwright waits out the full timeout anyway. It passes
    // locally in any environment whose `localhost` resolves to IPv4 first, so
    // a green local run is not evidence this is safe to remove.
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: SUPABASE_ENV,
  },
})
