# Browser E2E

Playwright suite covering the shared shell, route guards, PWA shell, narrow-viewport reflow, and the
activity lifecycle — including live capture sessions driven through the capture screen itself.

```bash
npm run test:e2e            # headless, both viewport projects
npm run test:e2e:ui         # interactive runner
npx playwright test --project=phone -g "notification"   # one spec
```

The config builds the app and serves it with `vite preview`; there is no separate start step.

**Sandboxes and dev containers:** if the pre-provisioned Chromium does not match this Playwright
version's expected build, point at it explicitly rather than downloading a second copy:

```bash
E2E_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e
```

CI leaves that unset and installs the matching Chromium instead.

## How it reaches an authenticated session

Every browser check on this project before 2026-07-28 ran anonymously, so no signed-in screen had
ever been rendered by a test. The obstacle was never Playwright — it was that the app needs Supabase
for both auth and data, and pointing a suite at a live project makes it depend on someone's real rows.

`fixtures/app.js` intercepts the backend instead:

- **Auth** — supabase-js reads its session from `localStorage` before making any network call, so an
  init script seeds `sb-<ref>-auth-token` with a far-future token. The app boots genuinely
  authenticated with no auth server involved.
- **Data** — a route handler over `/rest/v1/**` implements enough of PostgREST's grammar to serve
  per-table fixtures (`supabase.setTable`), stub functions (`supabase.setRpc`), and record writes
  (`supabase.writes`, `supabase.writesTo`). Unseeded tables return `[]`; unstubbed RPCs return a
  loud 404 rather than a silent empty result.

Two fixtures are exposed: `supabase` (the handle above) and `signedInPage` (already signed in and
sitting on the practice hub, which is what most shell specs want).

Because `bags` drives `useOnboardingGate`, the default fixture seeds one bag — otherwise every
authenticated spec would land on the onboarding wizard.

## Seeding activities

Activities reach the app by two different paths, so there are two ways to seed one:

| Activity state | Path | How |
|---|---|---|
| `completed` / `incomplete` | `fetchHistory` selects them from Supabase and hydrates the Dexie mirror | `supabase.setTable('activities', [buildActivity(...)])`, plus a `putt_sessions` row via `buildPuttSession(id)` if the entry should render as more than a bare row |
| `active` / `paused` | never returned by the history query; the shell reads them from the Dexie mirror via `liveQuery` | `await supabase.seedLocalActivity({ state: 'paused', ... })` |

`seedLocalActivity` writes straight to IndexedDB, so two rules apply: call it *after* a navigation
(the app has to have opened the database first), and `page.reload()` afterwards — a raw IndexedDB
write does not fire the Dexie mutation broadcast that `liveQuery` listens to.

Both helpers produce the row shape `createDraftLifecycle` + `createDraft` build, so a seeded activity
is indistinguishable from one the app wrote itself.

## Driving a live capture session

Some lifecycle behaviour cannot be seeded at all. Auto-close, round-replacement confirmation, and
outbox reconnect only happen when a real start command runs through `activityRepository`, which is
issued by `useInstantLaunchSession` → `mirrorInstantLaunchActivity` — never by a route or a row. So
`capture.spec.js` starts a real session: go to `/practice/freeform`, press **Start**, and the capture
canvas (`Made` / `Missed`) is live.

Four things that path needs:

- **`supabase.stubActivityRpcs()`** registers the four functions both outboxes drain through
  (`activity_create_draft`, `activity_transition`, `activity_set_visibility`,
  `activity_correct_practice_details`). Unstubbed RPCs answer 404 on purpose, so a spec that starts a
  session without this watches every flush fail. A later `setRpc` on the same name replaces the stub,
  which is how a spec makes one of them do something — the correction spec has it write the new
  notes/tags back to the seeded `putt_sessions` row, the way the real function does.
- **`supabase.readLocalRows(store)`** reads a Dexie store (`activities`, `activityStateEvents`,
  `auditEvents`, `outbox`). Most of the lifecycle contract — a state event's reason, an audit row's
  previous values, whether the outbox drained — is never rendered.
- **`supabase.readCaptureOutbox()`** reads InstantLaunch's separate localStorage queue. Lifecycle
  operations drain first; capture facts are held behind them by the A6 parent foreign key.
- **Waiting on the right signal.** The capture screen renders as soon as the FSM flips, while
  mirroring and flushing continue behind it. Wait for the create RPC to arrive (it can only leave
  after the whole start decision was made) and for the outbox to empty, not for the canvas.

Two app behaviours will trip up a spec that does not expect them: a fresh page load while a capture
buffer is live is redirected back to the capture screen by `useCrashRecoveryRedirect` (end the
session first if the spec needs another route by URL), and leaving the capture screen pauses the
activity via `useActivityNavigationLifecycle`.

## Simulating a disconnect

`context.setOffline` is not sufficient on its own: an intercepted route is fulfilled in-process and
never touches the network stack, so every Supabase call keeps succeeding with the browser "offline".
`supabase.setOffline(true)` aborts inside the route handler instead, which fails writes the way a
lost connection does and — because the abort happens before anything is recorded — guarantees that a
queued write genuinely never reached the backend.

`supabase.writeCounts()` then counts what did arrive, keyed by the identity each write replays under:
an RPC's `p_idempotency_key`, a PostgREST row's client-generated `id`. That is the assertion an
exactly-once claim needs; `writes.length` cannot tell a second legitimate operation from a duplicate.

The reconnect spec deliberately does **not** restore connectivity with `context.setOffline(false)`.
That fires an `online` event, and `handleOnline` in `syncScheduler.js` starts a flush with no
in-flight guard — it can run concurrently with the backoff retry, both flushes read the same queue,
and every queued operation is sent twice (reproduced: two `activity_create_draft`, two
`activity_transition`, two `putt_sessions`, two `putt_events`, all within 6ms). That is an app defect
recorded in `PHASE_A_ARCHITECTURE.md` § 9, not something to assert around; the spec reconnects by
clearing the route abort and letting the app's own backoff retry drive, which is also what a
server-side outage looks like from the client.

## What this does not verify

- **Schema truth.** A fixture will happily return a column Postgres would reject, or accept a write
  RLS would refuse. Query/schema/RLS correctness stays the job of the SQL checks and unit tests.
- **Real network conditions.** Intercepted requests resolve instantly; failure is simulated by
  aborting a route, so timeouts, partial responses, and slow links are still untested.
- **Exactly-once on an `online`-event reconnect.** See above — the app double-sends there, and no
  spec covers it.
- **The confirmed branch of round replacement.** No UI ever passes `confirmRoundReplacement: true`,
  so only the gate (the round is left alone) is reachable from a browser.
- **Real devices.** Chromium with a phone-sized viewport is not iOS Safari. The killed-app recovery,
  safe-area, and standalone-mode checks in `PHASE_A_ARCHITECTURE.md` § 9 still need a real handset.

## Projects

| Project | Runs | Why |
|---|---|---|
| `phone` | everything except `reflow.spec.js` | Pixel 7 profile; the product is mobile-first, so a desktop-only pass would prove little |
| `narrow-320` | `reflow.spec.js` only | 320px is the narrowest width the design system commits to; re-running every flow at a second width doubles wall clock for little signal |

## Adding a spec

Import `test`/`expect` from `./fixtures/app` rather than `@playwright/test` — that is what carries
the backend interception. Seed any table the screen reads *before* the first `goto`, and seed the
session before it too (init scripts only run on load).

Prefer role- and accessible-name selectors. The app has no `data-testid` anywhere, and keeping it
that way means these specs double as an accessibility check: if a control cannot be found by role and
name, that is usually a real finding rather than a selector problem. Note that route titles are short
words that recur in page content, so header assertions scope to the `banner` landmark.
