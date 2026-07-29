# Onboarding

| Field | Value |
|---|---|
| Route id | `onboarding` |
| URL pattern | `/onboarding` |
| Section | **none** — `PUBLIC_ROUTES` entries carry no `section` field (`routeMetadata.js:317`) |
| Shell | `none` |
| Header title | **none** — no `title` field. Each step supplies its own `h1` |
| Activity pill | **none** — no `showActivityPill` field |
| Scroll key | **none** — no `scrollKey` field |
| Preserves nested state | **none** — no `preserveNestedState` field |
| Page component | `src/pages/OnboardingPage.jsx` (33 lines) + `src/components/onboarding/GoalStep.jsx` (28), `PutterStep.jsx` (149), `CalibrationStep.jsx` (63) |
| Blueprint screen | Screen 3 — `OnboardingWizardView` |
| Verified against | `eb9fd2b` |

As with `root` and `login`, the four "none" rows are absent keys rather than `null` values. **Unlike**
those two, this route is wrapped in `ProtectedRoute` directly in `src/App.jsx:57-61` — it is the only
`shell: none` route with a guard, because it needs a session (guest or real) but not the tab bar.

## 1. Purpose

The three-step first-run wizard: pick a focus, provision a first putter, and calibrate units and haptic
feedback. Its load-bearing side effect is creating the default **Practice Stack** bag — the existence of
any bag is what `useOnboardingGate` reads to decide a user has been through onboarding at all, so this
screen is the only thing standing between a new account and an infinite redirect loop.

## 2. Entry and exit

| Direction | Trigger | Mechanism | Notes |
|---|---|---|---|
| In | Never-onboarded user reaches any shell route | `useOnboardingGate` → `navigate('/onboarding', { replace: true })` | Checked **once per app load**, not per navigation. Zero bags means never onboarded (`lib/onboarding.js:49-51`). Fails open on a fetch error, so a network hiccup cannot trap an already-onboarded user |
| In | Guest sign-in succeeds on the splash | `SplashPage.jsx:17` → `navigate('/onboarding')` | Direct, bypassing `/practice` and therefore bypassing the gate |
| In | Guest sign-in succeeds on the sign-in screen | `AuthPage.jsx:107` → `navigate('/onboarding')` | Same |
| In | Direct URL / bookmark | Route match | **No completion guard.** An already-onboarded user can open this URL and re-run the wizard — which then fails at Step 2; see § 6 Interlock |
| Guard | No session | `ProtectedRoute` → `<Navigate to="/login" replace />` | Renders `Loading...` while auth resolves |
| Guard | *not* run | `useOnboardingGate`, `useCrashRecoveryRedirect`, `useActivityNavigationLifecycle` | All three live in `AppShell`, which is not in this route's tree. The gate additionally short-circuits on `location.pathname === '/onboarding'` so it cannot self-trigger |
| Out | `Finish` on Step 3 | `navigate('/practice', { replace: true })` | `replace`, so browser-back does not return to the wizard |
| Out | Session lost mid-wizard | `ProtectedRoute` → `/login` | |

**Back behavior.** There is no back control anywhere: no shell header, and **no in-wizard Back button on
any step**. Step state is a plain `useState` (`OnboardingPage.jsx:16`), not history — so browser back
from Step 2 or Step 3 leaves the page entirely rather than stepping backward, and re-entering restarts at
Step 1. The wizard is strictly one-way. See § 12.

**Tab re-tap.** **N/A** — no `TabBar` on this route.

**Query parameters.** None read. The wizard is deliberately not deep-linkable mid-flow —
`OnboardingPage.jsx:11-12` records the reasoning: a single page with internal step state matches the
blueprint's single progress bar, and there is nothing here worth deep-linking into.

## 3. Layout

### 3a. Frame (illustrative)

Drawn at Step 2, the most complex of the three.

```
+-------------------------------------------------------+
|  [STATUS BAR]                                         |
+-------------------------------------------------------+
|  [████████████████████████░░░░░░░░░░░░]               | <- .onboarding-progress-track/-fill,
|  Step 2 of 3                                          |    width = (step / 3) * 100%
|                                                       |
|  Select your primary putter                           | <- h1, per-step
|  We'll auto-build your instant Practice Stack.        | <- .splash-tagline, reused here
|                                                       |
|  1. Brand                                             | <- <span class="editor-label">, not a <label>
|  [ MVP ]  [ Axiom ]  [ Streamline ]                   | <- ChipGroup, Axiom active by default
|                                                       |
|  2. Mold                                              |
|  +-------------------------------------------------+  |
|  | Envy                              3/3/0/1       |  | <- .mold-radio-card, 56px min-height;
|  +-------------------------------------------------+  |    active card gets an accent border
|  | Proxy                             3/3/0/1       |  |
|  +-------------------------------------------------+  |
|                                                       |
|  3. Weight (grams)                                    |
|  +-------+                     +-------+              |
|  |   −   |        174g         |   +   |              | <- 56x56 steppers, 1g increments,
|  +-------+                     +-------+              |    clamped 150-180
|                                                       |
|  +-------------------------------------------------+  |
|  |            Confirm & Continue                   |  | <- "Setting up..." while saving
|  +-------------------------------------------------+  |
|         Skip setup — I'll configure later             | <- still creates the Practice Stack bag
+-------------------------------------------------------+
|  [HOME INDICATOR]                                     |
+-------------------------------------------------------+
```

Steps 1 and 3 share the frame's top two regions (progress track and label) and replace everything below:
Step 1 is three `.goal-card` buttons plus `Continue`; Step 3 is the haptic pad, an optional honesty line,
a units `ChipGroup`, and `Finish`.

No header, no tab bar, no sheet host. The page is one `<section class="onboarding-page">` on the standard
page block (`max-width: 480px`, `padding: 32px 20px`, `text-align: left` — `App.css:1-32`), and is not a
scroll region.

### 3b. Region outline (normative)

```
App-level, outside Routes
  pwa-update ............... PwaUpdatePrompt — renders on this route
Onboarding section (.onboarding-page)
  prog-track ............... progress bar; fill width = (step / TOTAL_STEPS) * 100%
  prog-label ............... "Step {n} of 3"
  Step 1 — GoalStep ........................ step === 1
    g1-title ............... h1 "What's your main focus?"
    g1-sub ................. "We'll tailor your dashboard around this."
    g1-card ................ one per GOAL_OPTIONS entry (3): title + description
    g1-continue ............ "Continue"; disabled until a goal is chosen
  Step 2 — PutterStep ...................... step === 2
    p2-title ............... h1 "Select your primary putter"
    p2-sub ................. "We'll auto-build your instant Practice Stack."
    p2-brand-label ......... span "1. Brand"
    p2-brand ............... ChipGroup over PUTTER_BRANDS (MVP | Axiom | Streamline)
    p2-mold-label .......... span "2. Mold"
    p2-mold-loading ........ "Loading molds..." while the catalog query is in flight
    p2-mold ................ one card per filtered mold: name + speed/glide/turn/fade
    p2-catalog-error ....... .form-error from the catalog query
    p2-weight-label ........ span "3. Weight (grams)"
    p2-weight-dec .......... "−"
    p2-weight-value ........ "{n}g"
    p2-weight-inc .......... "+"
    p2-error ............... .form-error from provisioning
    p2-confirm ............. "Confirm & Continue" / "Setting up..."
    p2-skip ................ "Skip setup — I'll configure later"
  Step 3 — CalibrationStep ................. step === 3
    c3-title ............... h1 "Sensory calibration"
    c3-sub ................. "Train the thumb for eyes-free scoring."
    c3-pad ................. "📳 Tap to test scoring pulse"
    c3-unsupported ......... honesty line; !supported only
    c3-felt ................ "Felt that? That's your make pulse."; supported && tested only
    c3-units-label ......... span "Units"
    c3-units ............... ChipGroup over UNIT_OPTIONS (Feet | Meters)
    c3-error ............... .form-error from the profile write
    c3-finish .............. "Finish" / "Finishing..."
```

Only one step subtree is mounted at a time. There is no Back leaf on any step — that absence is
normative, not an omission in this outline.

## 4. Element catalog

| id | Type | Label / copy | States | Action | Target | Enable rule |
|---|---|---|---|---|---|---|
| `prog-track` | bar | — | width `(step/3)*100%`, 0.25s ease transition | — | — | always. Plain `<div>`s; no `role="progressbar"` — see § 8 |
| `prog-label` | text | `Step {n} of 3` | 1 / 2 / 3 | — | — | always |
| `g1-card` | button | `Dial In Consistency` · `Bag Management` · `Deep Analytics`, each with a description | selected (`.goal-card-active`) / unselected | `onSelectGoal(option.id)` | **local state only** | always. Single-select. `min-height: var(--tap-target-min)` |
| `g1-continue` | button | `Continue` | default / **disabled** | `setStep(2)` | — | disabled while `goal` is `null` — the only step gate in the wizard |
| `p2-brand` | chips | `MVP` · `Axiom` · `Streamline` | active / inactive | `setBrand` | local state | always. Initial value `DEFAULT_BRAND` = `Axiom`. Changing brand re-runs the mold filter and auto-reselects |
| `p2-mold-loading` | text | `Loading molds...` | present / absent | — | — | `catalog.isLoading` |
| `p2-mold` | button | `{mold_name}` + `{speed}/{glide}/{turn}/{fade}` | active / inactive | `setSelectedMold` | local state | one per result of `filterCatalogMolds(catalog, { manufacturer: brand, category: 'putter' })` — approved molds only, **capped at 20**. A `useEffect` sets `pickDefaultMold(molds)` whenever the list changes: prefers `Envy`, else the first result, else `null` |
| `p2-catalog-error` | text | `catalog.error.message` | present / absent | — | — | catalog query failure. Note the offline snapshot fallback usually prevents this |
| `p2-weight-dec` | button | `−` (U+2212) | default / **disabled at 150** | `clampWeight(w - 1)` | local state | 56×56; `disabled` at `MIN_WEIGHT_GRAMS` |
| `p2-weight-value` | text | `{weight}g` | — | — | — | initial `174`. Grams per `COPY_AND_TERMINOLOGY.md` § 6 |
| `p2-weight-inc` | button | `+` | default / **disabled at 180** | `clampWeight(w + 1)` | local state | 56×56; `disabled` at `MAX_WEIGHT_GRAMS` |
| `p2-error` | text | raw `err.message` from the provisioning sequence | present / absent | — | — | any throw in `provision()` or `createBag` |
| `p2-confirm` | button | `Confirm & Continue` / `Setting up...` | idle / saving | `provision()` then `onNext()` | `bags`, `discs`, `bag_discs`, localStorage | disabled while `saving`. **Provisions the bag even with no mold selected** — `provision()` returns early after `createBag` when `selectedMold` is null |
| `p2-skip` | button | `Skip setup — I'll configure later` | idle / saving | `createBag(...)` then `onNext()` | `bags` | disabled while `saving`. **Not a true skip** — it still creates the Practice Stack bag, because that bag's existence is the onboarding signal (`PutterStep.jsx:70-75`) |
| `c3-pad` | button | `📳 Tap to test scoring pulse` | default / pressed | `vibrateMake()` then `setTested(true)` | `navigator.vibrate` | always — **including when vibration is unsupported**, where the tap produces no feedback at all. `min-height: var(--tap-target-min)` |
| `c3-unsupported` | text | `Your browser doesn't support vibration feedback — scoring still works fine with on-screen taps.` | present / absent | — | — | `!supported`, i.e. `navigator.vibrate` is not a function. This is the shipped honesty fallback required by `SCREEN_SPECS.md` Screen 3 |
| `c3-felt` | text | `Felt that? That's your make pulse.` | present / absent | — | — | `supported && tested` |
| `c3-units` | chips | `Feet` · `Meters` | active / inactive | `setUnits` | local state | always. Initial `feet` |
| `c3-error` | text | raw `err.message` | present / absent | — | — | `upsertProfileFields` failure |
| `c3-finish` | button | `Finish` / `Finishing...` | idle / saving | `upsertProfileFields(userId, { units })` then `navigate('/practice', { replace: true })` | `profiles.units` | disabled while `saving` |

**The absent element.** `g1-card` writes to `OnboardingPage`'s `goal` state and nothing else. That state
is passed to `GoalStep` and read by no other step, no write, and no persistence layer. Step 1's answer is
discarded when the page unmounts. See § 12.

## 5. Data contract

### Reads

| Data | Function | Module | Backing | Kind |
|---|---|---|---|---|
| Signed-in user id | `useAuth()` → `user.id` | `context/AuthContext` | GoTrue session | React context |
| Mold catalog | `useCatalog()` | `lib/repository/catalogRepository` | **Supabase, with a Dexie snapshot fallback** | TanStack Query, `networkMode: 'offlineFirst'` |
| Putter molds for a brand | `filterCatalogMolds(catalog, { manufacturer, category: 'putter' })` | same | — | **pure** |
| Default mold choice | `pickDefaultMold(molds)` | `lib/onboarding` | — | **pure** |
| Vibration capability | `usePuttHaptics()` → `supported` | `hooks/usePuttHaptics` | `typeof navigator.vibrate === 'function'` | React hook |
| Goal / brand / weight / units options | `GOAL_OPTIONS`, `PUTTER_BRANDS`, `UNIT_OPTIONS`, weight bounds | `lib/onboarding` | — | **module constants** |

`readCatalog()` tries the network first, caches the snapshot into Dexie, and on failure falls back to the
cached snapshot — throwing only if the cache is also empty (`catalogRepository.js:73-82`). This is why
the mold list can work offline while the writes below cannot. Signatures in `LIB_API_INDEX.md`.

### Writes

| Mutation | Call | Idempotency key | Local transaction boundary |
|---|---|---|---|
| Create the default bag | `createBag(userId, { name: PRACTICE_STACK_BAG_NAME, is_default: true })` | none | none |
| Create the first putter | `upsertDisc(userId, null, buildPutterDiscFields({ moldId, manufacturer, moldName, weightGrams }))` | none | none |
| Add the putter to the bag | `addDiscToBag(bag.id, disc.id)` | none | none — **and it additionally captures a bag version** (`LIB_API_INDEX.md`), so this one call writes `bag_discs` plus a `bag_versions`/`bag_version_discs` snapshot |
| Record the favourite putter | `updateInstantLaunchState(applySetProfileDefaults, { favoritePutterDiscId })` | n/a | localStorage, synchronous |
| Save units | `upsertProfileFields(userId, { units })` | none | none |

**There is no transaction boundary anywhere in this screen.** `provision()` (`PutterStep.jsx:36-53`) is
four sequential awaits against Supabase with no rollback and no idempotency key. It is not
repository-mediated: `createBag`, `upsertDisc`, and `addDiscToBag` all go straight to
`supabase.from(...)` in `lib/discLocker.js`, and `upsertProfileFields` does the same in `lib/profile.js`.

`PHASE_A_ARCHITECTURE.md` § 14 owns the repository/transaction contract, but it scopes that contract to
*activity lifecycle* transitions — none of these are lifecycle mutations, so § 14 does not strictly bind.
The absence of any boundary is still a real defect, because of the retry trap in § 6.

`buildPutterDiscFields` hardcodes `role: 'primary_putter'` and `status: 'in_locker'`
(`lib/onboarding.js:53-62`); neither is a user choice on this screen.

### Offline

Split behavior, and the split is the interesting part:

- **Reads survive.** `useCatalog()` is `networkMode: 'offlineFirst'` over a Dexie snapshot, so the brand
  chips and mold list render offline for any device that has loaded the catalog once. A device that never
  has gets `p2-catalog-error` and an empty mold list — at which point `p2-confirm` still works, because
  `provision()` tolerates `selectedMold === null` and creates the bag alone.
- **Writes do not.** Every write is a direct Supabase call. Offline, `createBag` rejects and its message
  lands in `p2-error`. **The wizard cannot be completed offline by any path, including Skip.**

The trap this creates: a guest who taps "Play instantly as guest" while offline cannot get a session at
all (see `screens/root.md` § 5), so they never arrive. But a user who *does* have a session and is
bounced here by the gate is stuck on Step 2 until connectivity returns, with no bag and therefore no way
into the app. Mitigating this slightly, `useOnboardingGate` fails open on a `fetchBags` rejection, so an
offline **already-onboarded** user is not redirected here in the first place.

No calm state from `PHASE_A_ARCHITECTURE.md` § 12 (`Saved on Device`, `Syncing`, `Synced`,
`Needs Attention`) is displayed. Given that this screen has queueable-looking writes that are not
actually queued, the absence of a `Saved on Device` indicator is honest rather than a gap — there is
nothing saved on device to report.

## 6. Flow paths

Shared state behavior is defined in `STATE_MATRIX.md`; this section cites row ids rather than restating
them, per `TEMPLATE.md` § 7. The rows that bear on this screen are `S-ONBOARD` (which is what sends users
here), `S-AUTH-REQUIRED`, `S-SAVING`, `S-ERR-INLINE`, `S-RETRY`, `S-OFFLINE-READ`, and
`S-INTERLOCK-CAP`. This document resolves the two `?` cells `STATE_MATRIX.md`'s pre-shell table leaves
open for this route — see the Error and Offline paths below.

**Happy path.**
1. Arrive (gate redirect or guest sign-in). Step 1 renders; `Continue` is disabled.
2. Tap a goal card → `Continue` enables → Step 2.
3. Catalog resolves; `Axiom` is preselected and `pickDefaultMold` selects `Envy` (or the first Axiom
   putter available).
4. Optionally change brand, mold, or weight. `Confirm & Continue`.
5. `provision()` runs: `createBag` → `upsertDisc` → `addDiscToBag` (which also captures a bag version) →
   `updateInstantLaunchState`. Step 3.
6. Optionally tap the haptic pad; pick `Feet` or `Meters`; `Finish`.
7. `upsertProfileFields(userId, { units })` → `navigate('/practice', { replace: true })`.

Terminal state: `/practice` with a default `Practice Stack` bag containing one putter, `profiles.units`
set, and `favoritePutterDiscId` in the InstantLaunch localStorage buffer. `useOnboardingGate` has
already run for this app load and will not run again until the next load — and would find a bag anyway.

**Skip path.** Step 2 → `Skip setup` → `createBag` only → Step 3 → `Finish`. Terminal state: `/practice`
with an **empty** Practice Stack bag, no putter, and no `favoritePutterDiscId`. The bag still exists, so
the gate is satisfied and the wizard does not reappear.

**First run / empty.** This screen *is* the first-run path; every arrival is by definition an empty
account. The only empty *state* inside it is an empty mold list, which renders as a bare gap (no empty
copy) between the brand chips and the weight stepper — there is no "no molds found" string. Worth
knowing: `COPY_AND_TERMINOLOGY.md` § 2 catalogues 27 empty-state strings and none of them belongs to
this screen, because it has none.

**Error.** `S-ERR-INLINE` on all three steps — **this resolves `STATE_MATRIX.md`'s `?` for
`onboarding` / `S-ERR-INLINE` to ✅**: `PutterStep.jsx:118` (catalog), `:139` (provisioning), and
`CalibrationStep.jsx:56` each render `.form-error` beside content that still works. `GoalStep` has no
error path because it makes no call. `S-ERR-BLOCK` never occurs — no step early-returns an error as its
whole body.

Each step catches its own throw and renders the raw `err.message`, leaving every selection intact and the
button re-enabled, so `S-RETRY` is satisfied by re-submitting rather than by an affordance. The user can
retry in place — **except on Step 2 after a partial failure**, which is the trap:

> `provision()` awaits `createBag` first. If `upsertDisc` or `addDiscToBag` then fails, the bag already
> exists. Tapping `Confirm & Continue` again re-runs `createBag`, which now violates the partial unique
> index `bags_one_default_per_user` (`bags_schema.sql:26-28`) and fails with a raw Postgres duplicate-key
> message. The user is left with a bag but no putter and no way to complete Step 2 from this screen. Their
> only escape is that the bag *does* satisfy the gate — so reloading the app lands them in `/practice`
> with an empty bag rather than back here.

**Offline.** As § 5. **This resolves `STATE_MATRIX.md`'s `?` for `onboarding` / `S-OFFLINE-READ`:**
`PutterStep` reads through `useCatalog()` and degrades to the cached Dexie snapshot (✅);
`CalibrationStep` performs **no read at all** — `usePuttHaptics` is a capability check on
`navigator.vibrate` — so `S-OFFLINE-READ` is not applicable to it (➖) rather than unimplemented.
`GoalStep` likewise reads only module constants.

Every write path fails with a raw fetch error and the wizard cannot be completed. There is no
`S-OFFLINE-WRITE` here: none of the four provisioning calls is repository-mediated, so none reaches an
outbox — see § 5 Writes.

**Auth / guard.** `S-AUTH-REQUIRED` applies here and nowhere else outside the shell: `ProtectedRoute`
wraps this route directly (`App.jsx:57-61`), making it the only `shell: none` route with a guard.
`S-ONBOARD` is the row that *sends* users here, and its documented consequence — an un-onboarded user who
is offline at launch is not redirected, because the gate fails open — is why the offline trap below is
narrower than it first appears. `OnboardingPage` dereferences `user.id` unconditionally when rendering Steps 2 and 3
(`OnboardingPage.jsx:29-30`), which is safe only because of that wrapper. A guest is a full participant
here: `is_anonymous` is never checked, and everything provisioned is owned by the anonymous user id and
survives conversion.

**Interlock.** Two, neither of them the ones `S-INTERLOCK-CAP` catalogues:

- The 35-disc bag capacity (`SCREEN_SPECS.md` standing divergence #6, and the first cap in
  `S-INTERLOCK-CAP`) is unreachable — this screen adds at most one disc.
- `bags_one_default_per_user` is a real, load-bearing interlock and is **not checked app-side**. It fires
  on the retry-after-partial-failure case above, and on a second, simpler one: **an already-onboarded
  user who navigates to `/onboarding` directly.** There is no completion guard on this route, so the
  wizard renders happily and then fails at `Confirm & Continue` with a duplicate-key error. See § 12.

**Destructive.** **N/A** — nothing on this screen deletes, retires, clears, or discards, and no
confirmation pattern is needed. Two adjacent notes: `Skip setup` sounds non-committal but writes a
durable row, and there is no way to undo Step 2's provisioning from within the wizard.

## 7. Dependencies

### Schema
- `bags` — `name`, `is_default`, `user_id`. The partial unique index `bags_one_default_per_user`
  (`bags_schema.sql:26-28`) is the constraint this screen collides with.
- `bag_discs` — the membership row; `addDiscToBag` also writes `bag_versions` / `bag_version_discs`
  (`AGENTS.md` § Data model: immutable bag metadata/membership snapshots).
- `discs` — `mold_id`, `manufacturer`, `mold`, `weight_grams`, `role`, `status`. Never drop the
  `discs.mold_id` FK to `disc_molds` (`docs/development/CURRENT_WORK.md` § Standing decisions).
- `disc_molds` — read-only here, via the catalog snapshot. Filtered to `category = 'putter'` and
  `catalog_status = 'approved'`.
- `profiles.units` — added by `phase_a_profile_schema.sql:16` with
  `check (units in ('feet','meters'))`, defaulting to `'feet'`. The `UNIT_OPTIONS` values match the
  constraint exactly; a mismatch would surface as a raw check-violation string in `c3-error`.
- **No column records the Step-1 goal.** The `goals` table from
  `supabase/migrations/20260716220000_phase_d3_goal_report_contracts.sql` is a different concept —
  measurable Phase D3 targets owned by the `goals` screen — and this wizard does not write to it.

### Library
`lib/onboarding` (all eight exports), `lib/discLocker` (`createBag`, `upsertDisc`, `addDiscToBag`),
`lib/profile` (`upsertProfileFields`), `lib/repository/catalogRepository` (`useCatalog`,
`filterCatalogMolds`), `lib/instantLaunch/storage` (`updateInstantLaunchState`),
`lib/instantLaunch/stateReducer` (`applySetProfileDefaults`), `hooks/usePuttHaptics`. Signatures in
`LIB_API_INDEX.md`.

### Components
`ChipGroup` (×3 — brand, units, and nothing else; the goal cards and mold cards are bespoke),
`GoalStep`, `PutterStep`, `CalibrationStep`. Details in `COMPONENT_LIBRARY.md`.

### Screens
`root` and `login` both route guests here directly. Every shell route can redirect here through
`useOnboardingGate`. Exits to `play-root`. Downstream consumers of what this screen creates:
`discs-root` and `bag-manage` (the Practice Stack bag), `disc-detail` (the provisioned putter),
`profile-details` (the `units` field), and both capture screens (`favoritePutterDiscId` seeds the putter
picker).

### Contracts and decisions
`PHASE_A_ARCHITECTURE.md` § 12 (presentation and accessibility), § 13 (why this route is shell-less),
§ 14 (transaction contract — cited for context; it scopes to lifecycle transitions and does not bind
these writes). `SCREEN_SPECS.md` Screen 3 for the mold-default and haptic-fallback divergences.
`COPY_AND_TERMINOLOGY.md` T-4 is an open copy question this screen depends on but must not resolve. No
blocking ADR.

## 8. Accessibility

Beyond the `PHASE_A_ARCHITECTURE.md` § 12 baseline:

- **Good — the haptic fallback ships and is honest.** `CalibrationStep.jsx:40-44` renders the explanatory
  line whenever `usePuttHaptics().supported` is false, which is exactly what `SCREEN_SPECS.md` Screen 3
  demands ("never a dead haptic pad"). iOS Safari does not implement `navigator.vibrate` at all, so this
  is the common case on the target device, not an edge case.
- **Gap — the pad is still silent when tapped on an unsupported browser.** `c3-pad` remains enabled;
  `handleTest` calls a no-op `vibrateMake()` and sets `tested`, but `c3-felt` requires `supported &&
  tested`, so the tap produces no vibration, no visual change, and no announcement. The *reason* is
  stated up front, which satisfies the letter of the contract; the control itself is inert.
- **Gap — the progress bar is invisible to assistive tech.** `.onboarding-progress-track` and
  `-fill` are plain `<div>`s with no `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, or
  `aria-valuemax`. The adjacent `Step {n} of 3` text carries the same information, so nothing is
  conveyed by visuals alone — but a progress semantic that costs three attributes is missing.
- **Gap — step transitions are not announced and do not move focus.** Changing step swaps the entire
  subtree including the `h1`, with no live region and no programmatic focus move. A screen-reader user who
  taps `Continue` gets no indication that the page content changed.
- **Gap — selection is class-only on both bespoke card groups.** `.goal-card` / `.goal-card-active` and
  `.mold-radio-card` / `.mold-radio-card-active` are plain `<button type="button">` with no
  `aria-pressed`, no `role="radio"`, and no `role="radiogroup"` — despite "radio" being in the second
  one's class name. `COMPONENT_LIBRARY.md` records the same for `ChipGroup`, so the whole screen conveys
  selection through CSS class and border color. This is the app-wide pattern, not a local regression.
- **Gap — the three step labels are not labels.** `1. Brand`, `2. Mold`, `3. Weight (grams)`, and `Units`
  are `<span class="editor-label">` elements. They are not `<label>`s (there is no form control to
  associate with a chip group) and not headings, so a screen-reader user navigating by heading or by form
  control gets an unlabelled group of buttons.
- **Gap — the weight stepper has no accessible name or live value.** The `−` (U+2212 MINUS SIGN) and `+`
  buttons have no `aria-label`, and `p2-weight-value` is not in a live region — so changing weight
  announces nothing. `COMPONENT_LIBRARY.md` flags the same.
- **Gap — errors are not announced.** Every `.form-error` on this screen is a plain `<p>` with no
  `role="alert"`. Same shortfall as `login`.
- **Gap — no landmark.** A bare `<section class="onboarding-page">` with no accessible name. Shared with
  `root` and `login`; tracked as `T-root-4`.
- **Tap targets are good.** `.goal-card` and `.haptic-test-pad` use `min-height: var(--tap-target-min)`;
  `.mold-radio-card` is 56px minimum; `.weight-stepper button` is 56×56. Only `p2-skip`, a `.link-button`,
  lacks a minimum — and it is the control that writes a durable row.
- **Zero text inputs.** The blueprint's "without invoking an OS keyboard" goal is fully met: nothing on
  any of the three steps opens a keyboard. This is the screen's strongest accessibility property and
  should not be regressed.

## 9. Events and telemetry

**N/A** — no metric from the `PHASE_A_ARCHITECTURE.md` § 5 registry is emitted, no notification from § 7
is produced or consumed, and no lifecycle event from § 2 is written. `updateInstantLaunchState(
applySetProfileDefaults, { favoritePutterDiscId })` writes the InstantLaunch profile-defaults buffer in
localStorage; that is application state consumed by the capture screens' putter picker, not telemetry.

The onboarding funnel is therefore unmeasurable: nothing records which goal was chosen (it is discarded
entirely — § 12), how many users skip putter setup, or where the wizard is abandoned.

## 10. Tests

### Existing coverage

`src/lib/onboarding.test.js` — 9 cases over the pure helpers: `pickDefaultMold` (named default present,
absent, empty/null list), `clampWeight` (below, above, in range), `needsOnboarding` (empty, null, one
bag), and `buildPutterDiscFields` (exact payload shape including `role: 'primary_putter'`).

`src/lib/routeMetadata.test.js:92` asserts `/onboarding` resolves to id `onboarding` with
`SHELL_TYPES.NONE`.

Coverage is entirely at the pure-helper layer, and it is good coverage of that layer.
**Nothing tests the three step components, the page, or the provisioning sequence.** Specifically
untested: that `Continue` is gated on a goal; that Skip still creates a bag; that `provision()` calls its
four writes in order; that a mid-sequence failure leaves the bag orphaned; that `Finish` writes `units`
and navigates with `replace`. `useOnboardingGate` is also untested — only the `needsOnboarding` predicate
it calls is.

### Acceptance criteria

1. Step 1's `Continue` is disabled until a goal card is selected, and enabled immediately after.
2. Step 2 preselects brand `Axiom` and mold `Envy` when `Envy` is in the catalog; the first Axiom putter
   otherwise.
3. Changing brand re-filters the mold list and reselects a default for the new brand.
4. The weight stepper is bounded at 150 and 180 with the boundary button disabled, in 1g steps.
5. `Confirm & Continue` creates one bag named `Practice Stack` with `is_default: true`, one disc with
   `role: 'primary_putter'` and `status: 'in_locker'`, one `bag_discs` row, and one
   `favoritePutterDiscId` entry.
6. **`Skip setup` also creates the Practice Stack bag** — a user who skips is not sent back to the wizard
   on next launch.
7. `Finish` writes `profiles.units` and navigates to `/practice` with `replace: true`, so browser-back
   does not return to the wizard.
8. On a browser without `navigator.vibrate`, Step 3 shows the fallback line and never shows
   `Felt that? That's your make pulse.`
9. A user who completes the wizard is not redirected back to `/onboarding` on the next app load.
10. With no network, Step 2 still renders molds from the cached catalog snapshot, and `Confirm &
    Continue` fails with a visible message rather than silently.
11. The Step-1 goal is persisted somewhere durable (**currently fails** — see § 12).
12. Retrying `Confirm & Continue` after a partial provisioning failure completes the setup (**currently
    fails** — see § 6 Error).

### E2E critical paths

`TEST_MAP.md` § E2E backlog item 6 — *"Never-onboarded user → onboarding gate → completes → default bag
exists"* — is the priority-2 entry for this screen. Beyond it:

- Guest from splash → full wizard → `/practice` → the Practice Stack bag appears on `/bag`.
- Skip path → `/practice` → next cold start does **not** return to `/onboarding`.
- Complete the wizard, then navigate directly to `/onboarding` and press `Confirm & Continue` → assert
  the duplicate-default-bag behavior is whatever the § 12 decision settles on.
- Offline Step 2 → confirm the catalog renders and the write fails visibly.

No automated browser E2E suite exists (`PHASE_A_ARCHITECTURE.md` § 9; `TASK_FORMAT.md` § Verification
commands). These are backlog entries, not existing coverage.

## 11. Tasks

#### T-onboarding-1 — Persist or remove the Step-1 goal

- **Capability:** `schema`
- **Touches:** a new migration adding a goal column (or table), `src/pages/OnboardingPage.jsx`,
  `src/components/onboarding/GoalStep.jsx`
- **Done when:** Selecting a goal either writes a durable record readable after reload, or Step 1 is
  removed and the wizard is honestly two steps. Either outcome removes the silent discard.
- **Verify:** `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=ci-test-placeholder npm test`
  with a case asserting the persisted value, plus a manual reload check.
- **Commit:** `feat: persist the onboarding focus selection`
- **Blocked by:** § 12 open question 1 — whether the goal should influence anything is a product decision,
  and appending a column for a value nothing reads is not an improvement.

#### T-onboarding-2 — Make Step 2 provisioning retry-safe

- **Capability:** `data-access`
- **Touches:** `src/components/onboarding/PutterStep.jsx`, `src/lib/discLocker.js`
- **Done when:** A failure in `upsertDisc` or `addDiscToBag` leaves the user able to press
  `Confirm & Continue` again and succeed — `provision()` reuses an existing default bag instead of
  attempting a second insert that violates `bags_one_default_per_user`.
- **Verify:** `npm test` with a case that rejects `upsertDisc` once, then asserts the retry completes
  with exactly one bag.
- **Commit:** `fix: make onboarding putter provisioning retry-safe`

#### T-onboarding-3 — Guard the route against an already-onboarded user

- **Capability:** `ui-routine`
- **Touches:** `src/pages/OnboardingPage.jsx`
- **Done when:** A user who already has a bag and navigates to `/onboarding` is redirected to `/practice`
  rather than being shown a wizard that will fail at Step 2.
- **Verify:** `npm run dev`, complete onboarding, navigate to `/onboarding`, observe the redirect.
- **Commit:** `fix: redirect an already-onboarded user away from the wizard`
- **Blocked by:** § 12 open question 3 — a redirect and a re-runnable wizard are both defensible.

#### T-onboarding-4 — Add a Back control to Steps 2 and 3

- **Capability:** `ui-routine`
- **Touches:** `src/pages/OnboardingPage.jsx`, the three step components
- **Done when:** A user on Step 2 or Step 3 can return to the previous step with their selections intact.
  Step 3 back must not un-provision the bag; state whether it is allowed at all.
- **Verify:** `npm run lint` plus a manual pass through all three steps and back.
- **Commit:** `feat: allow stepping back in the onboarding wizard`

#### T-onboarding-5 — Give the progress bar and card groups real semantics

- **Capability:** `ui-routine`
- **Touches:** `src/pages/OnboardingPage.jsx`, `src/components/onboarding/GoalStep.jsx`,
  `src/components/onboarding/PutterStep.jsx`
- **Done when:** The progress bar exposes `role="progressbar"` with `aria-valuenow`/`min`/`max`; goal
  cards and mold cards expose their selected state to assistive tech; the weight stepper buttons have
  accessible names and the value is announced on change. Visual behavior is unchanged.
- **Verify:** `npm run lint` and a manual VoiceOver pass through all three steps.
- **Commit:** `fix: expose onboarding wizard state to assistive tech`

#### T-onboarding-6 — Add a landmark to the pre-shell screens

- **Capability:** `ui-routine`
- **Touches:** see `T-root-4`
- **Done when:** as `T-root-4`.
- **Verify:** as `T-root-4`.
- **Commit:** `fix: expose a main landmark on the pre-shell screens`
- **Note:** the same change as `T-root-4` and `T-login-4`; land once.

## 12. Open questions

1. **The Step-1 goal is discarded.** `OnboardingPage.jsx:17` holds `goal` in component state, passes it
   to `GoalStep`, and never reads it again. No write, no column, no consumer. The blueprint's intent
   ("tag the user profile … to customize default dashboard layouts") is unimplemented, and
   `SCREEN_SPECS.md` Screen 3 lists goal cards as shipped NET-NEW without noting the tag is dropped —
   an agent reading that entry would reasonably assume the value is stored. Logged as C-1 in
   `_corrections/preshell-screens.md`. Blocks `T-onboarding-1`.
2. **Is "Practice Stack" a proper noun or a synonym for any bag?** `PRACTICE_STACK_BAG_NAME` is a literal
   bag name here, while Step 2's subtitle ("We'll auto-build your instant Practice Stack") and
   `SCREEN_SPECS.md` Screen 3 both read like a product concept. Two live empty states say
   `You don't have a bag yet.` and `You don't have any bags yet.` **This is `COPY_AND_TERMINOLOGY.md`
   T-4 / decision 4 and is explicitly owner-arbitrated — recorded here, not decided here.**
3. **Re-entering `/onboarding` after completion fails on the database.** There is no completion guard, so
   the wizard renders and then dies at `Confirm & Continue` against `bags_one_default_per_user` with a raw
   Postgres message. Redirect away, or make the wizard idempotent? Blocks `T-onboarding-3`.
4. **A partial provisioning failure is unrecoverable in place.** See § 6 Error. The user's only escape is
   to reload, which lands them in the app with an empty bag they did not intend. Blocks `T-onboarding-2`.
5. **The wizard is strictly one-way.** No Back control on any step and no history integration, so a
   mis-tapped goal or brand cannot be revisited without abandoning the page. Blocks `T-onboarding-4`.
6. **`Skip setup — I'll configure later` writes a row.** The label promises deferral; the handler creates
   the default bag. The reason is sound and documented in code (`PutterStep.jsx:70-75`), but the copy
   does not say so, and this is the only button in the app whose label understates its effect.
7. **The haptic pad is tappable when vibration is unsupported.** The honesty line is present, which
   satisfies `SCREEN_SPECS.md` Screen 3, but the tap itself gives nothing back. Disable the pad, or add a
   visual pulse as the non-haptic equivalent?
8. **Nothing enforces that `UNIT_OPTIONS` matches the `profiles.units` check constraint.** They agree
   today (`feet` / `meters` in both), but the coupling is implicit and a change to either side surfaces as
   a raw check-violation string on `Finish`.

## 13. Blueprint divergence

Blueprint Screen 3 is *3-Step Zero-Typing Onboarding Wizard (`OnboardingWizardView`)*,
`MASTER_PROJECT_BLUEPRINT.md:212-261`. `SCREEN_SPECS.md` Screen 3 says "build as specified" with one
declared divergence (the default mold) and one requirement (the haptic fallback). Shipped reality:

| Blueprint Screen 3 | Shipped |
|---|---|
| Auto-defaults to the **Axiom Cosmic Pilot (174g)** | `DEFAULT_BRAND = 'Axiom'`, `DEFAULT_MOLD_NAME = 'Envy'`, `DEFAULT_WEIGHT_GRAMS = 174`. **Declared** — no Cosmic Pilot exists in the seeded `disc_molds` catalog; Envy was chosen as the closer analogue, user-confirmed 2026-07-05 (`lib/onboarding.js:13-18`), exactly as `SCREEN_SPECS.md` Screen 3 instructed |
| "initializes a **10-disc** 'Practice Stack' bag in local storage" | Creates the bag with **one** disc, or zero on Skip. No 10-disc initialization exists anywhere. `SCREEN_SPECS.md` describes only "default-bag genesis on confirm", so this diverges from the blueprint alone. The bag also lives in Supabase, not local storage — standing divergence #2 |
| Step 1 goal cards "tag the user profile in Dexie.js to customize default dashboard layouts" | **Not built.** The selection is held in component state and discarded. See § 12 open question 1 |
| Haptic pad "fires `navigator.vibrate([50, 50, 50])`" (also blueprint TASKS 2.5) | Fires `usePuttHaptics().vibrateMake()`, which is a single 15ms pulse (`hooks/usePuttHaptics.js:6-10`). Arguably better — it trains the *actual* make pulse the user will feel during capture — but it is an undeclared divergence from both the wireframe and the task list |
| Step 2 checkbox `[ ✓ ] SET AS PRIMARY PUTTER & CREATE STACK` above the CTA | Not built. `role: 'primary_putter'` is hardcoded in `buildPutterDiscFields`; there is no choice to make |
| Mold cards show plastic variants — `COSMIC PILOT (Electron)`, `ENVY (Electron Firm / Plasma)` | Mold cards show the mold name and its four flight numbers. Plastic selection is not part of onboarding; it lives on `disc-new` |
| Progress bar in the header row, `STEP 2 OF 3` at the right | Progress track and `Step 2 of 3` label are the first two elements of the page body. Visually equivalent; there is no header to put them in |
| Three sub-views implied by "3-Step … Wizard" | One route with internal step state. Documented as intentional at `OnboardingPage.jsx:11-12` — nothing mid-wizard is worth deep-linking. Not a defect |
| "in under 60 seconds **without invoking an OS keyboard**" | Fully met — zero text inputs across all three steps |
| Copy in caps throughout the wireframe | Sentence case in the DOM; `text-transform` handles casing where the display font applies it |

Standing divergences #1 (React + Vite, not Expo/NativeWind), #2 (staged Dexie adoption — the bag is
Supabase-backed, not local-first), and #3 (append-only additive schema on the existing Supabase schema)
apply; see `SCREEN_SPECS.md` § Standing divergences. Do not restate them per screen.
