# Root (Splash)

| Field | Value |
|---|---|
| Route id | `root` |
| URL pattern | `/` |
| Section | **none** — `PUBLIC_ROUTES` entries carry no `section` field (`routeMetadata.js:315`) |
| Shell | `none` |
| Header title | **none** — no `title` field; `AppShell` never mounts on this route |
| Activity pill | **none** — no `showActivityPill` field |
| Scroll key | **none** — no `scrollKey` field |
| Preserves nested state | **none** — no `preserveNestedState` field |
| Page component | `src/pages/SplashPage.jsx` (54 lines), or `<Navigate to="/practice" replace />` when a session exists (`src/App.jsx:47-50`) |
| Blueprint screen | Screen 1 — `WelcomeLandingView` |
| Verified against | `eb9fd2b` |

**On the four "none" rows.** These are *absent keys*, not `null` values, and the distinction is
load-bearing. `freeform-active` sets `scrollKey: null` deliberately; `root` has no `scrollKey` key at
all, so `resolveRouteMetadata('/')` returns an object where `.title`, `.section`, `.scrollKey`,
`.showActivityPill`, and `.preserveNestedState` are all `undefined`. Nothing reads them, because the
only consumers are `AppShell` and `GlobalHeader`, and neither mounts here. `PwaUpdatePrompt` does call
`resolveRouteMetadata(pathname)` on this route, but reads only `.shell`.

## 1. Purpose

The signed-out front door. It states the offline-first promise, shows the product name, and offers
exactly three onward moves — create an account, sign in, or start playing immediately as a guest. A user
who already has a session never sees it: the route redirects to `/practice` before `SplashPage` renders.

## 2. Entry and exit

`AppShell` is not in this route's tree, so **none of the four shell guards run here**
(`NAVIGATION_MAP.md` § Guards and interceptors). The route element in `src/App.jsx:47-50` is itself the
only gate, and it is a plain ternary on `useAuth()`:

| `loading` | `user` | Renders |
|---|---|---|
| `true` | — | `null` — a blank screen, not the `Loading...` text `ProtectedRoute` uses |
| `false` | truthy (**including an anonymous guest**) | `<Navigate to="/practice" replace />` |
| `false` | `null` | `<SplashPage />` |

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | Cold start / typed URL / bookmark / home-screen icon | Route match | The PWA start URL; the most common arrival |
| In | Account deletion completes | `window.location.replace('/')` in `DeleteAccountPanel.jsx` | A full document reload, not a router navigation — every provider and open Dexie handle belongs to the deleted user |
| Out | Session already exists | `<Navigate to="/practice" replace />` | `replace`, so `/` is not left in history |
| Out | `cta-start` | `navigate('/login')` | Push, not replace |
| Out | `link-signin` | `<Link to="/login">` | Same destination as `cta-start` |
| Out | `link-guest`, success | `signInAnonymously()` → `navigate('/onboarding')` | See § 6 |
| Out | `link-guest`, failure | `navigate('/login')` | Deliberate: a disabled anonymous provider must not dead-end the tap (`SplashPage.jsx:13-18`) |

**Back behavior.** There is no back control — `GlobalHeader` is shell-owned and does not exist here.
Browser/system back from `/` leaves the app or returns to whatever preceded it in history.

**Tab re-tap.** **N/A** — `TabBar` is shell-owned and does not render on this route.

**Query parameters.** None. This route accepts no parameters and reads none.

## 3. Layout

### 3a. Frame (illustrative)

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|              [ ⚡ OFFLINE-FIRST ENABLED ]             | <- .splash-badge, align-self: center
|                                                       |
|                                                       |
|                        🥏                             | <- .splash-logo, 64px, aria-hidden
|                  Disc Golf App                        | <- h1
|        Elevate your putting & inventory               | <- .splash-tagline
|                                                       |
|                                                       | <- .splash-hero is flex:1, so it
|                                                       |    absorbs all spare height
+-------------------------------------------------------+
|  [ 🔥 142,000+ putts logged this week ]               | <- static module constant, not a query
|                                                       |
|  +-------------------------------------------------+  |
|  |                  Get Started                    |  | <- .btn-primary, --tap-target-min
|  +-------------------------------------------------+  |
|                                                       |
|         Already have an account? Sign in              | <- <Link>, .link-button
|   Play instantly as guest — save progress later       | <- <button>, .link-button
+-------------------------------------------------------+
|  [HOME INDICATOR]                                     |
+-------------------------------------------------------+
```

No header row, no tab bar, and no sheet host appear in this frame because none of them exist on this
route. The whole page is a single `<section class="splash-page">`: `max-width: 480px`, centred,
`min-height: 100%`, `display: flex; flex-direction: column`, `text-align: center` (`App.css:388-397`).
The page is not a scroll region — there is no `ScreenScrollRegion` and the content is sized to fit.

### 3b. Region outline (normative)

```
App-level, outside Routes
  pwa-update ........... PwaUpdatePrompt — fixed-position, renders on this route
                         (it suppresses itself only on ACTIVE-shell routes)
Splash section (.splash-page)
  splash-badge ......... IconBolt + "OFFLINE-FIRST ENABLED"
  Hero (.splash-hero, flex:1)
    hero-logo .......... 🥏, aria-hidden="true"
    hero-title ......... h1, "Disc Golf App"
    hero-tagline ....... "Elevate your putting & inventory"
  Bottom zone (.splash-bottom-zone)
    proof-strip ........ IconFlame + SOCIAL_PROOF_TEXT
    cta-start .......... primary button, "Get Started"
    link-signin ........ Link, "Already have an account? Sign in"
    link-guest ......... button, "Play instantly as guest — save progress later"
```

There is no error region, no loading region, and no status region in this outline — see § 4 and § 8.

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `pwa-update` | banner | `A new version is ready.` + `Reload now` / `Later` | absent / present | `reloadSW(true)` reloads the document | — | Present only after the service worker reports an update; hidden on ACTIVE-shell routes, **not** hidden here |
| `splash-badge` | pill | `OFFLINE-FIRST ENABLED` | static | — | — | always |
| `hero-logo` | text | `🥏` | static | — | — | always; `aria-hidden="true"` |
| `hero-title` | h1 | `Disc Golf App` | static | — | — | always |
| `hero-tagline` | text | `Elevate your putting & inventory` | static | — | — | always |
| `proof-strip` | text | `142,000+ putts logged this week` | static | — | — | always. Module constant `SOCIAL_PROOF_TEXT` (`SplashPage.jsx:7`) — **not a live aggregate**, per `SCREEN_SPECS.md` Screen 1 |
| `cta-start` | button | `Get Started` | default / pressed | `navigate('/login')` | `/login` | always — no disabled or in-flight state |
| `link-signin` | link | `Already have an account? Sign in` | default / pressed / visited | navigate | `/login` | always |
| `link-guest` | button | `Play instantly as guest — save progress later` | default / pressed. **No loading state and no disabled state** | `await signInAnonymously()` then navigate | `/onboarding` on success, `/login` on error | always — repeated taps issue concurrent sign-in calls; see § 12 |

Three of the four interactive elements lead to `/login`. The only branch is `link-guest`, and its error
branch also lands on `/login`.

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Session presence (drives the redirect) | `useAuth()` → `{ user, loading }` | `context/AuthContext` | Supabase GoTrue + localStorage | React context |
| Social-proof string | `SOCIAL_PROOF_TEXT` | `pages/SplashPage.jsx:7` | — | **module constant** |

`SplashPage` itself reads nothing but `signInAnonymously` from context. The session read that decides
whether this page renders at all happens in `src/App.jsx`, not in the page. **No table is queried on
this route.** Signatures in `LIB_API_INDEX.md`.

### Writes

| Mutation | Call | Idempotency key | Local transaction boundary |
|---|---|---|---|
| Create an anonymous auth user | `signInAnonymously()` → `supabase.auth.signInAnonymously()` | none | none — a single GoTrue call, then a `navigate` |

No application table is written. The new anonymous user has no `profiles` row, no `bags` row, and no
`discs` row until onboarding provisions them — which is exactly the signal `useOnboardingGate` reads.

`PHASE_A_ARCHITECTURE.md` § 14 owns the repository/transaction contract; it governs *activity lifecycle*
transitions and does not bind here, because nothing on this route is a lifecycle mutation.

### Offline

The rendered page is fully functional offline: it makes no network read, so it paints identically with
or without connectivity.

Two behaviors that are not obvious:

- **A persisted session still redirects offline.** `AuthProvider` calls `supabase.auth.getSession()`,
  which resolves from localStorage without a network round trip, so an offline returning user is sent
  straight to `/practice`. This is the mechanism behind the "365-Day Offline Guarantee" label on `login`.
- **`link-guest` cannot work offline.** `signInAnonymously()` requires the network. It rejects, and the
  handler routes to `/login` — which also cannot authenticate offline. An offline first-run user is
  therefore unable to get past the front door by any path. Recorded in § 12.

None of the four calm states from `PHASE_A_ARCHITECTURE.md` § 12 (`Saved on Device`, `Syncing`,
`Synced`, `Needs Attention`) is displayed on this screen, and none is applicable — there is no local
work to report on. `S-OFFLINE-READ` is marked "static" for this route in `STATE_MATRIX.md`;
`S-OFFLINE-WRITE`, `S-SYNC`, and `S-STALE` do not apply.

## 6. Flow paths

Shared state behavior is defined in `STATE_MATRIX.md`; this section cites row ids rather than restating
them, per `TEMPLATE.md` § 7.

**Happy path.** Cold start at `/` → `loading` true → `getSession()` resolves to `null` → `SplashPage`
renders → tap `cta-start` → `/login`. Terminal state: the `login` screen, signed out.

The pre-resolution frame is `S-AUTH-BOOT`, and this route is its worse half: `App.jsx:49` renders
**`null`** rather than the `Loading...` paragraph `ProtectedRoute` shows inside the shell. A blank
screen is the first thing every cold start displays.

**Returning user.** Cold start at `/` → `getSession()` resolves a persisted session → the route element
returns `<Navigate to="/practice" replace />` → `AppShell` mounts and `useOnboardingGate` runs there.
Terminal state: `/practice`, or `/onboarding` if the gate finds zero bags. `SplashPage` never mounts.

**First run / empty.** **N/A** — the screen has no data-bearing region. Its content is identical for
every signed-out visitor.

**Error.** `S-ERR-SILENT`, and `STATE_MATRIX.md`'s pre-shell table marks this screen's instance ❌. The
single failure mode is `signInAnonymously()` rejecting or returning an error, and it is **not surfaced**:
the handler discards the error object and navigates to `/login` (`SplashPage.jsx:13-18`). The user
experiences a tap on "Play instantly as guest" that silently produces the sign-in screen instead of the
wizard, with no explanation. Deliberate — the comment argues a dead-end is worse — but the silence is a
real gap. `S-ERR-BLOCK` and `S-ERR-INLINE` do not apply: this screen has no read to fail and no error
region at all. See § 12.

**Offline.** As § 5. The page renders; `link-guest` fails and bounces to `/login`; no offline path exists
past this screen for a user with no persisted session.

**Auth / guard.** No `ProtectedRoute`, no onboarding gate, no crash-recovery redirect, no activity
lifecycle interception — none of those live outside `AppShell`. The route element's own ternary is the
complete guard set, so `S-AUTH-REQUIRED` never fires here. It treats a guest as a signed-in user
(`S-GUEST`) and redirects them away, so a guest can never see this screen again without signing out —
which, per `S-GUEST`, no screen offers them. `S-ONBOARD` fires only *after* the redirect, inside
`AppShell`.

**Interlock.** **N/A** — no cap or constraint is enforced or reachable from this screen.

**Destructive.** **N/A** — nothing on this screen deletes, retires, clears, or discards. The one
destructive flow that *terminates* here is account deletion, which reloads the document to `/` from
`DeleteAccountPanel` on the `settings` screen; the confirmation pattern belongs to that screen.

## 7. Dependencies

### Schema
**None.** This screen reads and writes no application table. `signInAnonymously()` creates a row in
Supabase's managed `auth.users`, which is not part of the app schema in `supabase_schema.sql`.

### Library
`context/AuthContext` (`signInAnonymously`), `lib/routeMetadata` (indirectly, via `PwaUpdatePrompt`).
Signatures in `LIB_API_INDEX.md`.

### Components
`PwaUpdatePrompt` (app-level, not imported by this page). `@tabler/icons-react` `IconBolt` and
`IconFlame`. This page composes **no** component from `src/components/` — it is the only screen in the
app of which that is true. Details in `COMPONENT_LIBRARY.md`.

### Screens
Exits to `login` and `onboarding`; both must accept an arrival with no referrer state. `settings`
reaches this route by document reload after account deletion. Nothing links *into* `/` from inside the
app.

### Contracts and decisions
`PHASE_A_ARCHITECTURE.md` § 12 (presentation and accessibility) is the only binding contract; § 13's
shell boundaries are what make this screen shell-less. No ADR blocks this screen.

## 8. Accessibility

Beyond the `PHASE_A_ARCHITECTURE.md` § 12 baseline:

- The decorative logo is correctly `aria-hidden="true"` (`SplashPage.jsx:28`) and the visible name is
  carried by the `h1`. Good, and the pattern to copy.
- **Gap — no landmark.** The page is a bare `<section class="splash-page">` with no accessible name, so
  it exposes no landmark at all. Every other screen inherits `<main>` from `ScreenScrollRegion`; the
  three shell-less screens inherit nothing. § 12 requires "logical landmarks/focus."
- **Gap — secondary tap targets.** `cta-start` gets `min-height: var(--tap-target-min)` via `.btn-primary`
  (`App.css:433-446`), but `link-signin` and `link-guest` are `.link-button` text links with no minimum
  height (`App.css:455`). § 12 requires 44×44pt secondary targets; `link-guest` in particular is the
  guest-mode entry point for the whole product.
- **Gap — no in-flight feedback.** `link-guest` awaits a network call with no `disabled`, no busy state,
  and no live region. A slow or repeated tap produces concurrent `signInAnonymously()` calls and, on
  failure, an unannounced route change.
- **Known token-level issue, not screen-specific.** `App.css:427-432` documents that the `.btn-primary`
  fill and its best available label token land at ~3.9:1 — short of 4.5:1 for normal text — and that the
  label was bumped to bold/17px to clear the 3:1 large-text allowance instead. `cta-start` inherits this.
  It is a design-token decision recorded in CSS, not a defect of this screen.
- `text-align: center` on the whole section is unusual for the app (every other page block is
  `text-align: left`, `App.css:1-32`) but has no accessibility consequence.

## 9. Events and telemetry

**N/A** — no metric from the `PHASE_A_ARCHITECTURE.md` § 5 registry is emitted, no notification from § 7
is produced or consumed, and no lifecycle event from § 2 is written. The social-proof number is a
hardcoded string, so it is not telemetry in either direction.

## 10. Tests

### Existing coverage

**None.** No test file exercises `SplashPage.jsx`, and — unlike `/login` and `/onboarding`, which are
asserted at `src/lib/routeMetadata.test.js:91-92` — **`/` is not covered by `routeMetadata.test.js` at
all.** The route's shell type and its absence of `section`/`title`/`scrollKey` are unasserted.

`TEST_MAP.md` attributes `src/lib/platform.test.js` to this route. That attribution is about the platform
predicates being *relevant* to the pre-shell surface, not about them testing this page: `SplashPage.jsx`
does not import `lib/platform`. Only `AuthPage.jsx` does.

### Acceptance criteria

1. A signed-out user at `/` sees the splash content, not a redirect.
2. A signed-in user at `/` never renders `SplashPage`; they land on `/practice` with `/` absent from
   history (`replace`).
3. An **anonymous** (guest) user at `/` is redirected exactly like a full account — guest counts as
   signed in.
4. While `loading` is true, the route renders nothing — no flash of splash content before the redirect.
5. `Get Started` and `Already have an account? Sign in` both arrive at `/login`.
6. A successful guest tap lands on `/onboarding` with a session whose `user.is_anonymous` is `true`.
7. A failing guest tap lands on `/login` and shows no error anywhere.
8. `resolveRouteMetadata('/')` returns `{ id: 'root', shell: 'none' }` and no `section`, `title`,
   `scrollKey`, `showActivityPill`, or `preserveNestedState` key.
9. With the network disabled and no persisted session, the page renders completely.

### E2E critical paths

- Signed-out cold start → `Get Started` → `/login`.
- Guest tap → `/onboarding` → complete the wizard → `/practice`, with the same `user.id` throughout.
- Persisted session → cold start offline → redirect to `/practice` without a network call.
- Account deletion → document reload → `/` renders the splash for a now-signed-out visitor.

No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9; `TASK_FORMAT.md` § Verification
commands). These are backlog entries, not existing coverage.

## 11. Tasks

#### T-root-1 — Cover the `/` route contract in `routeMetadata.test.js`

- **Capability:** `pure-logic`
- **Touches:** `src/lib/routeMetadata.test.js`
- **Done when:** A test asserts `resolveRouteMetadata('/')` returns id `root` and `shell`
  `SHELL_TYPES.NONE`, matching the existing assertions for `/login` and `/onboarding`.
- **Verify:** `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=ci-test-placeholder npm test`
- **Commit:** `test: cover the root route in the route metadata contract`

#### T-root-2 — Give the guest button an in-flight and failure state

- **Capability:** `ui-routine`
- **Touches:** `src/pages/SplashPage.jsx`
- **Done when:** Tapping `link-guest` disables it for the duration of the await; a failed
  `signInAnonymously()` shows a visible message before or instead of the silent `/login` bounce; two
  rapid taps issue one sign-in call.
- **Verify:** `npm run lint` plus a new page-level test that rejects `signInAnonymously` once and asserts
  the message renders.
- **Commit:** `fix: surface guest sign-in failure on the splash screen`

#### T-root-3 — Meet the 44×44pt minimum on the two splash text links

- **Capability:** `ui-routine`
- **Touches:** `src/App.css`
- **Done when:** `link-signin` and `link-guest` present at least a 44×44pt hit area at 320px width and
  at 200% text scaling, with unchanged visual weight.
- **Verify:** `npm run build`, then manual measurement at `/` in a 320px viewport.
- **Commit:** `fix: enlarge splash secondary link tap targets`

#### T-root-4 — Add a landmark to the three shell-less screens

- **Capability:** `ui-routine`
- **Touches:** `src/pages/SplashPage.jsx`, `src/pages/AuthPage.jsx`, `src/pages/OnboardingPage.jsx`
- **Done when:** Each pre-shell page exposes a `<main>` landmark, so screen-reader landmark navigation
  works before sign-in as it does after.
- **Verify:** `npm run lint` and a manual VoiceOver rotor pass at `/`, `/login`, `/onboarding`.
- **Commit:** `fix: expose a main landmark on the pre-shell screens`
- **Note:** shared with `T-login-4` and `T-onboarding-6` — land it once, under this id.

## 12. Open questions

1. **Guest sign-in failure is silent.** `SplashPage.jsx:13-18` discards the error and navigates to
   `/login`. The user gets no reason and no retry. The comment justifies avoiding a dead end, not
   avoiding an explanation. Decision needed: show the failure and stay, or keep the bounce and add a
   message on arrival. Blocks `T-root-2`'s exact behavior.
2. **Offline first run has no path forward.** With no persisted session and no network, every exit from
   this screen leads somewhere that also requires the network. Whether the offline-first badge should be
   qualified for a never-signed-in user is a product question, not a bug fix.
3. **The social-proof number is fabricated copy.** `142,000+ putts logged this week` is a module constant
   that no query backs. `SCREEN_SPECS.md` Screen 1 authorizes this "for v1" and calls it illustrative.
   It reads to a user as a live statistic. Whether a static claim of that shape is acceptable to ship is
   an owner decision, not a documentation one — recorded here so it is not mistaken for a real aggregate.
4. **`SCREEN_SPECS.md` Screen 1 lists a "topo-background CSS treatment already used elsewhere" as REUSE.**
   No such treatment exists in `src/` — "Sun-Drenched Topo" is the theme name in `src/index.css:1` and
   nothing renders a topographic background. Logged as C-4 in `_corrections/preshell-screens.md`.

## 13. Blueprint divergence

Blueprint Screen 1 is *Welcome Landing (`WelcomeLandingView`)*, `MASTER_PROJECT_BLUEPRINT.md:117-156`.
`SCREEN_SPECS.md` Screen 1 calls it "build as specified"; the shipped screen is close, with these
differences:

| Blueprint Screen 1 | Shipped |
|---|---|
| Guest tap "initializ[es] an anonymous local Dexie.js shadow database" | Supabase anonymous sign-in — **standing divergence #4**. The guest is a real `auth.users` row with `is_anonymous: true`, which is what makes conversion via `updateUser`/`linkIdentity` preserve progress |
| Guest routes "directly to Screen 3" | Matches on success (`/onboarding`); diverges on failure, where it routes to Screen 2 (`/login`) instead |
| "Dynamic Social Proof Ticker … displaying live aggregated metrics" | Static module constant. Explicitly authorized as illustrative v1 copy by `SCREEN_SPECS.md` Screen 1 |
| Top bar reading `( 🥏 ) DISC GOLF APP  [⚡ OFFLINE ENABLED]` | No top bar. The badge is a standalone centred pill above the hero; the wordmark lives in the hero `h1` |
| "GEOMETRIC TELEMETRY LOGO (Circular Circuit Pattern)" in a bordered container | A 64px `🥏` emoji, `aria-hidden`, with no container |
| CTA copy `GET STARTED ➡️`, "massive 64px height" | `Get Started`, no arrow glyph. Height comes from the `--tap-target-min` token rather than a literal 64px — see `AGENTS.md` § Design system for the value |
| Copy in caps throughout the wireframe (`ELEVATE YOUR PUTTING & INVENTORY`) | Sentence case in the DOM; the display font's `text-transform` handles casing where it applies |
| "anchored strictly in the bottom 40% thumb zone" | `.splash-hero { flex: 1 }` pushes `.splash-bottom-zone` down, which achieves the same placement without a fixed percentage |

Standing divergences #1 (React + Vite, not Expo/NativeWind) and #4 (guest mode) apply; see
`SCREEN_SPECS.md` § Standing divergences. Do not restate them per screen.
