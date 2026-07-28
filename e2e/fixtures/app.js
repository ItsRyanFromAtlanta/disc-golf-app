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

// --- activity lifecycle fixtures -------------------------------------------
//
// Activities reach the app by two different paths, and specs need both:
//
//   * Terminal activities (completed/incomplete) come from Supabase —
//     `fetchHistory` selects them and hydrates the Dexie mirror. Seeding the
//     `activities` table is enough, so `buildActivity` + `setTable` covers
//     history, soft-delete, and restore.
//   * Current activities (active/paused) never appear in that query. The shell
//     reads them from the Dexie mirror via a liveQuery, so they have to be
//     written to IndexedDB directly — that is what `seedLocalActivity` is for.
//
// Both produce the row shape `createDraftLifecycle` + `createDraft` build, so
// a fixture row is indistinguishable from one the app wrote itself.

const ACTIVITY_ID_PREFIX = '00000000-0000-4000-8000-0000000000a'

export function buildActivity(overrides = {}) {
  const recordedAt = overrides.updated_at ?? '2026-07-20T15:00:00.000Z'
  const id = overrides.id ?? `${ACTIVITY_ID_PREFIX}1`
  return {
    id,
    user_id: TEST_USER.id,
    type: 'putting_freeform',
    state: 'completed',
    version: 2,
    has_meaningful_fact: true,
    needs_review: false,
    hidden_at: null,
    metadata: {},
    created_at: '2026-07-20T14:30:00.000Z',
    updated_at: recordedAt,
    create_idempotency_key: `e2e-create-${id}`,
    last_lifecycle_idempotency_key: `e2e-lifecycle-${id}`,
    ...overrides,
  }
}

/**
 * The `putt_sessions` row a freeform activity needs in order to render as
 * anything other than a bare row — `fetchHistory` joins the two by id.
 */
export function buildPuttSession(activityId, overrides = {}) {
  return {
    id: activityId,
    session_date: '2026-07-20',
    notes: null,
    tags: [],
    created_at: '2026-07-20T14:30:00.000Z',
    putt_distance_logs: [
      {
        id: `${activityId}-log-1`,
        distance_feet: 20,
        makes: 7,
        attempts: 10,
        zone: 'circle_1',
        created_at: '2026-07-20T14:35:00.000Z',
      },
    ],
    ...overrides,
  }
}

// The lifecycle and history-recovery outboxes drain through these four
// Postgres functions. An unstubbed RPC answers 404 on purpose (see the route
// handler), which is the right default for a spec that never meant to reach
// the network — but any spec that drives a live capture session, a correction,
// or a reconnect needs all four, so they are registered together.
const ACTIVITY_RPCS = Object.freeze([
  'activity_create_draft',
  'activity_transition',
  'activity_set_visibility',
  'activity_correct_practice_details',
])

// Mirrors `src/lib/instantLaunch/storage.js`. The capture buffer and its
// outbox are read straight out of localStorage by specs that need to know
// whether a capture write is still in flight.
const INSTANT_LAUNCH_STORAGE_KEY = 'discgolf.instantLaunch.v1'

// PostgREST asks for a single object with this Accept header (`.single()` /
// `.maybeSingle()`), and returns 406 rather than an empty array when nothing
// matches. Getting this wrong surfaces as an unhandled error inside the app
// rather than a test failure, so it is worth handling precisely.
const SINGLE_OBJECT_ACCEPT = 'application/vnd.pgrst.object+json'

/**
 * Reads (and optionally writes) one Dexie object store from inside the page.
 *
 * Both directions have to run in the browser — the mirror is IndexedDB, not a
 * file — and a function cannot be handed to `page.evaluate`, so the operation
 * is described by data instead: `put` writes a row, and every call returns the
 * store's full contents afterwards.
 */
async function localStoreRequest(page, { store, put = null }) {
  return page.evaluate(
    async ({ store: storeName, put: row }) => {
      const request = indexedDB.open('DiscGolfAppDB')
      const database = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const rows = await new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, row ? 'readwrite' : 'readonly')
        const objectStore = transaction.objectStore(storeName)
        if (row) objectStore.put(row)
        const query = objectStore.getAll()
        query.onsuccess = () => resolve(query.result)
        transaction.onerror = () => reject(transaction.error)
      })
      database.close()
      return rows
    },
    { store, put },
  )
}

/**
 * The identity a write replays under, which is what an exactly-once assertion
 * has to count: an RPC carries its own `p_idempotency_key`, and a PostgREST
 * row is deduplicated by the client-generated `id` it upserts under.
 */
function writeIdentity(write) {
  const key = write.body?.p_idempotency_key ?? write.body?.id
  return key ? `${write.table}:${key}` : null
}

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
  let offline = false

  const backend = {
    /** Seed rows for a table. Unseeded tables return [] rather than erroring. */
    setTable(name, rows) {
      tables[name] = rows
      return backend
    },
    /** The rows currently seeded for a table, after any RPC stub mutated them. */
    getTable(name) {
      return tables[name] ?? []
    },
    /** Stub a Postgres function. Handler receives the parsed JSON body. */
    setRpc(name, handler) {
      rpcHandlers[name] = handler
      return backend
    },
    /**
     * Registers no-op stubs for the four activity RPCs the outboxes drain
     * through. Call before driving any live capture, correction, or reconnect
     * flow; a later `setRpc` for the same name replaces the stub, which is how
     * a spec makes one of them do something more interesting.
     */
    stubActivityRpcs() {
      for (const name of ACTIVITY_RPCS) rpcHandlers[name] = () => null
      return backend
    },
    /**
     * Cuts the backend off without touching the rest of the app.
     *
     * `context.setOffline` alone is not enough here: an intercepted route is
     * fulfilled in-process and never reaches the network stack, so every
     * Supabase call would keep succeeding with the browser "offline". Aborting
     * inside the handler is what actually makes a write fail.
     *
     * Add `context.setOffline` only when a spec specifically wants
     * `navigator.onLine` or the `online` event — restoring it fires that event,
     * which currently starts an unguarded second flush (see the reconnect spec
     * in `capture.spec.js` and PHASE_A_ARCHITECTURE.md § 9).
     */
    setOffline(next) {
      offline = next
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
     * How many times each distinct write actually reached the backend, keyed
     * by the identity it would replay under (see `writeIdentity`). This is the
     * shape an exactly-once assertion wants: a bare `writes.length` cannot
     * tell a legitimate second operation from a duplicated retry.
     */
    writeCounts() {
      const counts = {}
      for (const write of writes) {
        const identity = writeIdentity(write)
        if (identity) counts[identity] = (counts[identity] ?? 0) + 1
      }
      return counts
    },
    /**
     * Rows currently in a Dexie store — `activities`, `activityStateEvents`,
     * `auditEvents`, or `outbox`. The lifecycle contract is only partly
     * visible on screen (a state event's reason, an audit row's previous
     * values, a drained outbox), so specs assert against the mirror directly
     * as well as against the UI.
     */
    async readLocalRows(store) {
      return localStoreRequest(page, { store })
    },
    /**
     * The InstantLaunch capture outbox, which lives in localStorage and is a
     * different queue from the Dexie one above: lifecycle operations drain
     * first, capture facts follow. A spec that simulates a restart has to wait
     * for this to empty too, or it sees a legitimate at-least-once resend of a
     * row whose acknowledgement never got persisted.
     */
    async readCaptureOutbox() {
      return page.evaluate((key) => {
        try {
          return JSON.parse(localStorage.getItem(key))?.outbox ?? null
        } catch {
          return null
        }
      }, INSTANT_LAUNCH_STORAGE_KEY)
    },
    /**
     * Writes an activity straight into the Dexie mirror, which is where the
     * shell reads current (active/paused) activities from — they never come
     * back from the history query, so `setTable` cannot reach them.
     *
     * Call this *after* a navigation (the app has to have opened the database
     * first) and reload afterwards: a raw IndexedDB write does not fire the
     * Dexie mutation broadcast that liveQuery listens to.
     */
    async seedLocalActivity(overrides = {}) {
      const activity = buildActivity({ state: 'paused', version: 3, ...overrides })
      await localStoreRequest(page, { store: 'activities', put: activity })
      return activity
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
    // A simulated disconnect fails the request the way a lost connection does
    // — before anything is recorded, so an aborted write is genuinely a write
    // the backend never saw.
    if (offline) return route.abort('internetdisconnected')

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
