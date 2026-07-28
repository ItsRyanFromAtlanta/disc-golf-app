# Browser E2E

Playwright suite covering the shared shell, route guards, PWA shell, and narrow-viewport reflow.

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

## What this does not verify

- **Schema truth.** A fixture will happily return a column Postgres would reject, or accept a write
  RLS would refuse. Query/schema/RLS correctness stays the job of the SQL checks and unit tests.
- **Real network conditions.** Intercepted requests resolve instantly and never fail. The offline
  spec exercises service-worker precache, not the InstantLaunch outbox or reconnect behaviour.
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
