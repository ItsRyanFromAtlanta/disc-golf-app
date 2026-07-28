import { test as base, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Why this file exists
//
// Every browser check performed on this project before now ran against an
// anonymous session, so no authenticated screen had ever been rendered in an
// automated test (PHASE_A_ARCHITECTURE.md § 9). The blocker was always the
// backend: the app talks to Supabase for auth *and* data, and pointing E2E at
// a live project would make the suite depend on someone's real rows.
//
// So the backend is intercepted instead. Two halves:
//
//   1. Auth — supabase-js reads its session from localStorage before it makes
//      any network call, so seeding that key with a far-future token produces
//      a genuinely authenticated app without an auth server.
//   2. Data — PostgREST has a small, predictable URL grammar. A route handler
//      over `/rest/v1/**` serves per-table fixtures and records writes.
//
// The result is deterministic and offline. What it deliberately does NOT
// verify is that our queries match the real schema — a fixture will happily
// return a column Postgres would reject. Schema truth stays the job of the
// SQL/RLS checks; this suite covers browser behaviour.
// ---------------------------------------------------------------------------

export const SUPABASE_URL = 'https://example.supabase.co'

// supabase-js derives its storage key from the project ref — the first
// hostname label. Mirrored here rather than hardcoded so that changing the
// placeholder URL in playwright.config.js cannot silently break seeding.
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0]
export const AUTH_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`

export const TEST_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'e2e@example.test',
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
  phone: '',
  is_anonymous: false,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

// A year out. supabase-js refreshes when a token is near expiry, and a
// short-lived fixture would turn into a flaky network call mid-test.
const EXPIRES_AT = Math.floor(Date.parse('2027-01-01T00:00:00.000Z') / 1000)

function buildSession(user = TEST_USER) {
  return {
    access_token: 'e2e-access-token',
    refresh_token: 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 31_536_000,
    expires_at: EXPIRES_AT,
    user,
  }
}

// The onboarding gate (useOnboardingGate) bounces any user with zero bags to
// /onboarding before the shell renders, so a signed-in fixture needs at least
// one bag or every shell test would land on the wizard instead.
export const TEST_BAG = {
  id: '00000000-0000-4000-8000-0000000000b1',
  user_id: TEST_USER.id,
  name: 'Practice Stack',
  description: null,
  bag_type: 'practice',
  is_default: true,
  capacity: 35,
  created_at: '2026-01-01T00:00:00.000Z',
}

const DEFAULT_TABLES = {
  bags: [TEST_BAG],
}

// PostgREST asks for a single object with this Accept header (`.single()` /
// `.maybeSingle()`), and returns 406 rather than an empty array when nothing
// matches. Getting this wrong surfaces as an unhandled error inside the app
// rather than a test failure, so it is worth handling precisely.
const SINGLE_OBJECT_ACCEPT = 'application/vnd.pgrst.object+json'

function parseRestPath(url) {
  const { pathname, searchParams } = new URL(url)
  const rest = pathname.replace(/^.*\/rest\/v1\//, '')
  const [head, ...tail] = rest.split('/')
  return { isRpc: head === 'rpc', name: head === 'rpc' ? tail.join('/') : head, searchParams }
}

/**
 * Installs the Supabase interception layer on a page and returns a handle for
 * per-test fixtures and write assertions.
 */
async function installSupabaseBackend(page) {
  const tables = { ...DEFAULT_TABLES }
  const rpcHandlers = {}
  const writes = []

  const backend = {
    /** Seed rows for a table. Unseeded tables return [] rather than erroring. */
    setTable(name, rows) {
      tables[name] = rows
      return backend
    },
    /** Stub a Postgres function. Handler receives the parsed JSON body. */
    setRpc(name, handler) {
      rpcHandlers[name] = handler
      return backend
    },
    /** Every non-GET request that reached the REST layer, in order. */
    get writes() {
      return writes
    },
    writesTo(name) {
      return writes.filter((write) => write.table === name)
    },
    /**
     * Seeds an authenticated session. Must be called before the first
     * navigation — it installs an init script, which only runs on page load.
     */
    async signIn(user = TEST_USER) {
      const session = buildSession(user)
      await page.addInitScript(
        ([key, value]) => {
          window.localStorage.setItem(key, value)
        },
        [AUTH_STORAGE_KEY, JSON.stringify(session)],
      )
      return session
    },
  }

  // --- auth ---------------------------------------------------------------
  await page.route('**/auth/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()

    if (url.pathname.endsWith('/logout')) {
      return route.fulfill({ status: 204, body: '' })
    }
    if (url.pathname.endsWith('/user') && method === 'GET') {
      return route.fulfill({ json: TEST_USER })
    }
    if (url.pathname.endsWith('/token')) {
      return route.fulfill({ json: buildSession() })
    }
    // OTP request, anonymous sign-in, and anything else the auth client pokes
    // at: an empty 200 keeps the client from treating it as a hard failure.
    return route.fulfill({ json: {} })
  })

  // --- data ---------------------------------------------------------------
  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const { isRpc, name, searchParams } = parseRestPath(request.url())
    const wantsSingle = (request.headers()['accept'] ?? '').includes(SINGLE_OBJECT_ACCEPT)

    let body = null
    try {
      body = request.postDataJSON()
    } catch {
      body = null
    }

    if (isRpc) {
      const handler = rpcHandlers[name]
      writes.push({ table: `rpc:${name}`, method, body })
      if (!handler) {
        // An unstubbed RPC is a test-authoring mistake, not app behaviour.
        // Fail loudly in the response so it shows up as an app-visible error
        // rather than a silent empty result.
        return route.fulfill({
          status: 404,
          json: { message: `e2e: no stub registered for rpc "${name}"`, code: 'E2E_NO_RPC_STUB' },
        })
      }
      return route.fulfill({ json: (await handler(body, searchParams)) ?? null })
    }

    const rows = tables[name] ?? []

    if (method === 'GET' || method === 'HEAD') {
      if (wantsSingle) {
        return rows.length
          ? route.fulfill({ json: rows[0] })
          : route.fulfill({
              status: 406,
              json: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
            })
      }
      return route.fulfill({
        json: rows,
        headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
      })
    }

    writes.push({ table: name, method, body, params: Object.fromEntries(searchParams) })

    // Echo the payload back the way `.insert().select()` expects. Not a real
    // database: no defaults are filled in, no constraints are checked.
    const echoed = Array.isArray(body) ? body : [body ?? {}]
    if (method === 'DELETE') return route.fulfill({ status: 204, body: '' })
    return route.fulfill({ status: method === 'POST' ? 201 : 200, json: wantsSingle ? echoed[0] : echoed })
  })

  // Private photo objects — no binaries in this suite.
  await page.route('**/storage/v1/**', (route) => route.fulfill({ json: [] }))

  return backend
}

// Playwright names a fixture's second argument `use` by convention; it is
// renamed `provide` here because oxlint's rules-of-hooks reads a bare `use(...)`
// call as React's `use` hook and errors. The name is arbitrary to Playwright.
export const test = base.extend({
  supabase: async ({ page }, provide) => {
    const backend = await installSupabaseBackend(page)
    await provide(backend)
  },

  /**
   * A page that is already signed in and sitting on the practice hub. Most
   * shell-level specs want exactly this and nothing more.
   */
  signedInPage: async ({ page, supabase }, provide) => {
    await supabase.signIn()
    await page.goto('/practice')
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
    await provide(page)
  },
})

export { expect }
