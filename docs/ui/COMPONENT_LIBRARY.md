# Component Library

Exhaustive inventory of every `.jsx` file under `src/components/` — **62 components** across the
28 top-level shared files and 7 feature subdirectories. Verified against the code on branch
`claude/ui-documents-status-3fphcw` (2026-07-29).

**What this is:** a lookup table so an implementing agent can find an existing component before
writing a new one. Every prop table is inferred from destructuring, defaults, and real call sites
(this is plain JS — there is no TypeScript to read). Every "Consumed by" row was verified with a
repo-wide search, not assumed.

**What this is not:** a design-token reference, a styling guide, or a screen spec.

- **Design tokens (colors, typography, tap-target minimums, border rules) live in
  [`AGENTS.md` § Design system — "Sun-Drenched Topo" (Oswald edition)](../../AGENTS.md) and are
  NEVER restated here.** If you need a hex value, a font, or the 80pt tap-target rule, read that
  section. Any token copied into this file would drift; that is the anti-drift rule for this doc.
- Per-screen status and divergences live in [`SCREEN_SPECS.md`](../../SCREEN_SPECS.md).
- Shell/lifecycle/offline contracts live in [`PHASE_A_ARCHITECTURE.md`](../../PHASE_A_ARCHITECTURE.md).

---

## How to use this document

1. Before creating **any** new component, search this file by intent using the
   [Reuse map](#reuse-map) — chip group, bottom sheet, flight chart, picker, empty state,
   confirmation, and so on are all already served by something.
2. If nothing in the Reuse map fits, scan the [Shared primitives](#shared-primitives) section by
   name. A near-match with an extra prop is almost always cheaper than a 63rd component.
3. If you still need something new, check [Gaps and duplication](#gaps-and-duplication) first — it
   lists patterns that are already hand-rolled in more than one place and are the right target for
   extraction rather than yet another one-off.
4. If you add or delete a component, update this file in the same change. It is the ground truth
   other agents read.

---

## Shared primitives

Top-level `src/components/`. These are the reusable ones — grouped by role for scanning, but every
file is listed.

### Shell and navigation

#### AppShell — `src/components/AppShell.jsx`

The application shell: wraps every authenticated route with header, scroll region, tab bar, sheet
host, and toast host, and switches to a chrome-free layout for ACTIVE-shell routes.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| — | — | — | — | Takes no props; renders `<Outlet />` from React Router. |

**Variants / modes:** two shells, chosen by `resolveRouteMetadata(pathname).shell`.
`SHELL_TYPES.ACTIVE` renders bare `.app-shell-active` + `.active-activity-shell` (no header, no tab
bar) so live capture owns the screen; anything else renders the standard chrome.

**State / side effects:** wraps itself in `ProtectedRoute`; `useCrashRecoveryRedirect()` (one-shot
PWA relaunch recovery), `useOnboardingGate()` (zero-bag users to onboarding), `useActiveActivity`,
`useActivityNavigationLifecycle`, `useNotifications` (badge count). Keeps per-route scroll offsets
in a ref keyed by `route.scrollKey` and restores them in `useLayoutEffect`. Owns the `sheet` state
that `SheetHost` renders; the notification bell opens a `NotificationSheet` into it and marks
notifications read via `notificationRepository.setStatus`.

**Consumed by:** `src/App.jsx` (as the `element` of the authenticated route group).

**Accessibility:** sets `aria-hidden` on `.app-shell-standard-content` while a sheet is open, so the
open dialog is the only exposed content.

---

#### GlobalHeader — `src/components/GlobalHeader.jsx`

The standard-shell top bar: title, optional back button, optional "resume active practice" pill, and
the notification bell with unread badge.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | string | yes | — | Header title text (`<h1>`). |
| `showBack` | boolean | no | `undefined` | Renders the back arrow button when truthy. |
| `onBack` | function | no | — | Back button handler. Required in practice whenever `showBack`. |
| `onNotifications` | function | no | — | Bell tap handler. |
| `notificationCount` | number | no | `0` | Unread/needs-attention count; `0` hides the badge. |
| `showActivityPill` | boolean | no | `undefined` | Enables the resume pill (from route metadata). |
| `activeActivity` | object \| null | no | — | Active activity record; pill renders only if present. |
| `activeHref` | string \| null | no | — | Route the pill links to; pill renders only if present. |

**Variants / modes:** back-arrow present/absent; resume pill present/absent (requires all three of
`showActivityPill`, `activeActivity`, `activeHref`); badge shown/hidden, clamped to `99+`.

**State / side effects:** none — fully controlled. Uses `@tabler/icons-react`
(`IconArrowLeft`, `IconBell`).

**Consumed by:** `src/components/AppShell.jsx`.

**Accessibility:** `aria-label="Back"` on the icon-only back button; the bell's `aria-label` is
count-aware (`Notifications, N needs attention`); all icons `aria-hidden`.

---

#### TabBar — `src/components/TabBar.jsx`

Four-tab bottom navigation (Play / Discs / Courses / Me) with iOS-style re-tap behavior.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `isAtTop` | boolean | yes | — | Whether the scroll region is currently at the top. |
| `hasRequestedTop` | boolean | yes | — | Whether a scroll-to-top was already requested for this tab press cycle. |
| `onScrollToTop` | function | yes | — | Invoked when the press resolves to SCROLL_TO_TOP. |

**Variants / modes:** the tab list is a module-level `TABS` constant (`play`, `discs`, `courses`,
`me`) — not configurable by props. Press behavior is delegated to
`resolveTabPressAction()` in `src/lib/tabNavigation.js`, which returns NAVIGATE, SCROLL_TO_TOP, or
a reset-to-section-root navigate.

**State / side effects:** reads `useLocation()`/`useNavigate()`; derives the active tab from
`resolveRouteMetadata(pathname).section`.

**Consumed by:** `src/components/AppShell.jsx`.

**Accessibility:** `<nav aria-label="Primary navigation">`; active tab carries `aria-current="page"`
and a heavier icon stroke.

---

#### ScreenScrollRegion — `src/components/ScreenScrollRegion.jsx`

The single scrolling `<main>` for standard-shell screens. A `forwardRef` wrapper so `AppShell` can
read/write `scrollTop` directly.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `children` | node | yes | — | Screen content (`<Outlet />` in practice). |
| `onScroll` | function | no | — | Scroll handler; `AppShell` uses it to persist per-route offsets. |
| *ref* | ref | no | — | Forwarded to the underlying `<main>` element. |

**Variants / modes:** none.

**State / side effects:** none.

**Consumed by:** `src/components/AppShell.jsx`.

**Accessibility:** `tabIndex={-1}` on `<main>` so it can be programmatically focused after
navigation without entering the tab order.

---

#### ProtectedRoute — `src/components/ProtectedRoute.jsx`

Auth gate: renders children only for a signed-in user, otherwise redirects to `/login`.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `children` | node | yes | — | Content to render when authenticated. |

**Variants / modes:** three states — loading (`<p className="loading">`), unauthenticated
(`<Navigate to="/login" replace />`), authenticated (children).

**State / side effects:** `useAuth()` from `src/context/AuthContext`.

**Consumed by:** `src/App.jsx` (wraps the onboarding route directly) and
`src/components/AppShell.jsx` (wraps the whole shell).

---

#### PwaUpdatePrompt — `src/components/PwaUpdatePrompt.jsx`

Explicit "a new version is ready" prompt for service-worker updates; deliberately never auto-reloads.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| — | — | — | — | Takes no props. |

**Variants / modes:** hidden entirely while an `SHELL_TYPES.ACTIVE` route is on screen (so a deploy
cannot reload the page mid-capture); otherwise shows Reload now / Later.

**State / side effects:** dynamically imports `virtual:pwa-register` and calls `registerSW({
immediate: true, onNeedRefresh })`; stores the returned updater in state via a setter callback.
Failure to import (dev server, unsupported browser) is swallowed and the prompt never appears.
Tapping Reload calls `reloadSW(true)`, which reloads the page.

**Consumed by:** `src/App.jsx`.

**Accessibility:** container is `role="status"` so the availability of an update is announced.

---

#### SheetHost — `src/components/SheetHost.jsx`

The app's single bottom-sheet host. Renders a modal dialog with a drag handle, title, close button,
and arbitrary content.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `sheet` | `{ title: string, content: node }` \| null | yes | — | `null` renders nothing; anything else opens the sheet. |
| `onClose` | function | yes | — | Called on backdrop pointer-down and on the close button. |

**Variants / modes:** open/closed only. Content is caller-supplied, so any panel can be a sheet.

**State / side effects:** none — the open sheet lives in `AppShell` state. Backdrop pointer-down
closes; the sheet body stops propagation so inner taps do not.

**Consumed by:** `src/components/AppShell.jsx`.

**Accessibility:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby="sheet-host-title"`;
backdrop is `role="presentation"`; close button has `aria-label="Close {title}"`. Note: it does not
trap focus itself — `AppShell` instead `aria-hidden`s the background content.

---

#### ToastHost — `src/components/ToastHost.jsx`

Polite live region for transient messages.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `toast` | node \| null | yes | — | Rendered inside the live region; `null` renders nothing. |

**Variants / modes:** none.

**State / side effects:** none.

**Consumed by:** `src/components/AppShell.jsx` — but currently mounted as `<ToastHost toast={null} />`
(`AppShell.jsx:123`), i.e. there is no toast queue wired up yet. See
[Gaps and duplication](#gaps-and-duplication).

**Accessibility:** `role="status"` + `aria-live="polite"`.

---

### Zero-typing input primitives

#### ChipGroup — `src/components/ChipGroup.jsx`

**The** shared zero-typing primitive: a horizontal row of tappable chips used for both single-select
(filters, pickers, segmented controls) and multi-select (tags). The caller decides which by how it
implements `isActive`. This is the most-reused component in the codebase.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `options` | array&lt;any&gt; | yes | — | Items to render. Strings, numbers, or objects — `getKey`/`getLabel` adapt them. |
| `isActive` | `(option) => boolean` | no | `() => false` | Marks a chip `chip-active`. Return true for multiple options to get multi-select. |
| `onSelect` | `(option) => void` | yes | — | Tap handler; receives the whole option, not an index. |
| `getKey` | `(option) => string \| number` | no | `(o) => o` | React key extractor. |
| `getLabel` | `(option) => node` | no | `(o) => o` | Chip label. |

**Variants / modes:** single-select (exactly one `isActive`), multi-select (several), and
action-only (no `isActive` at all — e.g. `QuickModPresetPills`). Markup is always
`.chip-row` > `.chip` / `.chip-active`.

**State / side effects:** none — fully controlled.

**Consumed by:**
- Components: `src/components/NotesTagsEditor.jsx`, `src/components/onboarding/CalibrationStep.jsx`,
  `src/components/onboarding/PutterStep.jsx`, `src/components/putterLineup/PutterLineup.jsx`,
  `src/components/puttingCanvas/CanvasContextBar.jsx`,
  `src/components/puttingCanvas/CanvasToolbar.jsx`, `src/components/puttingCanvas/PutterPicker.jsx`,
  `src/components/puttingCanvas/QuickModPresetPills.jsx`,
  `src/components/routineBuilder/StageCard.jsx`
- Pages: `src/pages/AuthPage.jsx`, `src/pages/BagLockerPage.jsx`, `src/pages/BagPage.jsx`,
  `src/pages/HistoryPage.jsx`, `src/pages/PracticeMenuPage.jsx`, `src/pages/ProfilePage.jsx`

**Accessibility:** plain `<button type="button">` per chip. It does **not** emit `aria-pressed`,
`role="radiogroup"`, or `role="tablist"` — selection is conveyed by class only. Callers that need a
pressed state currently hand-roll their own chips (see Gaps).

---

#### OtpInput — `src/components/OtpInput.jsx`

Six-box one-time-code entry with large tap targets, auto-advance, backspace-back, and paste-fills-all.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `length` | number | no | `6` | Number of digit boxes. |
| `value` | string | yes | — | Current code (controlled). |
| `onChange` | `(value: string) => void` | yes | — | Receives the full concatenated code. |

**Variants / modes:** box count via `length`.

**State / side effects:** `useRef` array of the input elements; imperatively moves focus forward on
entry, backward on backspace, and to the last-filled box after a paste. Non-digits are stripped.

**Consumed by:** `src/pages/AuthPage.jsx`.

**Accessibility:** `inputMode="numeric"`; `autoComplete="one-time-code"` on the first box only (a
platform hint for iOS Mail-style code suggestion — not the SMS-only WebOTP API, since this is email
OTP); each box has `aria-label="Digit N"`.

---

#### MoldPicker — `src/components/MoldPicker.jsx`

Search-and-select for a disc mold from the shared `disc_molds` catalog, with a compact "selected"
state that offers Change.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `selectedMold` | mold object \| null | yes | — | When set, renders the selected summary instead of the search UI. |
| `onSelect` | `(mold \| null) => void` | yes | — | Called with the chosen mold, or `null` from Change. |

**Variants / modes:** two — search mode (empty selection) and selected-summary mode.

**State / side effects:** local `query` state; `useCatalog()` from
`src/lib/repository/catalogRepository` (TanStack Query + IndexedDB snapshot fallback) with
`filterCatalogMolds`. Renders nothing in the result list until the query is non-empty. Surfaces
`catalog.isLoading` and `catalog.error`.

**Consumed by:** `src/pages/DiscFormPage.jsx`.

**Accessibility:** the search input is labelled by an explicit `<label htmlFor="mold-search">`.
Results are a plain `<ul>` of buttons — no combobox/listbox roles, no keyboard arrow navigation.

---

#### NotesTagsEditor — `src/components/NotesTagsEditor.jsx`

Notes textarea + multi-select tag chips + free-text custom tag entry, with its own save button and
saved/saving state.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `initialNotes` | string \| null | no | `''` | Seeds the textarea; not re-synced after mount. |
| `initialTags` | string[] \| null | no | `[]` | Seeds the selected tags. |
| `onSave` | `({ notes, tags }) => Promise` | yes | — | Awaited; a thrown error renders as `.form-error`. `notes` is trimmed to `null` when empty. |

**Variants / modes:** none. Button label cycles Save notes & tags → Saving... → Saved.

**State / side effects:** local `notes`, `tags`, `customTag`, `saving`, `saved`, `error`. Because
`initialNotes`/`initialTags` are only initial values, `SessionReport` remounts it with a composite
`key` when the underlying record changes. Custom tags go through `normalizeTag()` from
`src/lib/insights`; starter tags come from `STARTER_TAGS`. Uses `ChipGroup` for the tag row.

**Consumed by:** `src/components/sessionReport/SessionReport.jsx` (and therefore, transitively,
`FreeformLogPage`, `RegimenRunPage`, `HistoryDetailPage`).

**Accessibility:** notes textarea has a real `<label htmlFor="notes">`. The custom-tag input has a
placeholder only, no label. Enter submits the custom tag.

---

#### EditableSection — `src/components/EditableSection.jsx`

View/edit toggle wrapper for a titled profile-style section. Render-prop based, so it is agnostic to
the fields inside.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | string | yes | — | Section heading. |
| `values` | object | yes | — | Current committed values; also the draft's reset source. |
| `onSave` | `(draft) => Promise` | yes | — | Awaited; a throw keeps edit mode open and shows `.form-error`. |
| `renderView` | `(values) => node` | yes | — | Read-only rendering. |
| `renderEdit` | `(draft, setDraft) => node` | yes | — | Edit-mode rendering; owns its own inputs. |

**Variants / modes:** view mode (heading + Edit link) and edit mode (fields + Save/Cancel).

**State / side effects:** local `editing`, `draft`, `saving`, `error`. A `useEffect` resyncs `draft`
from `values` whenever not editing, so external refreshes do not clobber an in-progress edit.

**Consumed by:** `src/pages/ProfilePage.jsx`, `src/pages/DiscDetailPage.jsx`.

**Accessibility:** heading is a plain `<h2>`; the Edit affordance is a `.link-button`. No focus
management on the view↔edit transition.

---

### Cards and charts

#### DiscCard — `src/components/DiscCard.jsx`

Disc summary card: thumbnail (or stability-colored fallback), nickname/mold, manufacturer, flight
numbers, status badge, and an optional caller-supplied action slot.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `disc` | disc object with `moldInfo` | yes | — | Uses `nickname`, `mold`, `manufacturer`, `photo_url`, `status`, `moldInfo`. |
| `variant` | `'grid' \| 'list'` | no | `'grid'` | Drives `.disc-card-grid` / `.disc-card-list` layout (both exist in `App.css`). |
| `to` | string | no | — | When set the whole card is a `<Link>`; otherwise a plain `<div>`. |
| `action` | node | no | — | Rendered after the body — used for per-card buttons (add/remove). |
| `flair` | boolean | no | `false` | Enables the rarity-tier flair variant (`discTier` / `discFlairSignal`). |

**Variants / modes:** grid vs list; link vs static; flair on/off (adds
`disc-card-flair disc-card-flair-{tier}` and a Tier/Signal `<dl>`).

**State / side effects:** none. Pure derivation via `effectiveFlightNumbers`, `stabilityClass`,
`stabilityColor`, `discTier`, `discFlairSignal`.

**Consumed by:** `src/pages/BagLockerPage.jsx` (three call sites, all passing `variant={viewMode}`
and `flair={flairEnabled}`).

**Accessibility:** thumbnail `<img>` uses `alt=""` (decorative — the title text carries the name).
The flair `<dl>` is labelled `aria-label="{tier} tier"`. Non-`to` cards are not focusable, which is
correct since the action slot supplies the interactive element.

---

#### FlightChart — `src/components/FlightChart.jsx`

Small SVG scatter of speed (x) vs turn+fade (y) for a set of discs, with axes, a zero line, and a
`<title>` tooltip per point.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `points` | `Array<{ x, y, disc, mold }>` | yes | — | Shape produced by `flightChartPoints()` in `src/lib/bags.js`. |

**Variants / modes:** none. Fixed 320×220 viewBox with a 28px pad; domains auto-expand around the
`[1, 14]` / `[-5, 6]` fallbacks.

**State / side effects:** none.

**Consumed by:** **nothing.** No file in `src/` imports it. Its data feeder
`flightChartPoints()` (`src/lib/bags.js:64`) likewise has no non-test caller. `BagPage` renders
`FlightSpectrum` instead. See [Gaps and duplication](#gaps-and-duplication) and
`_corrections/component-library.md`.

**Accessibility:** `role="img"` with `aria-label="Flight chart: speed by turn+fade"`; per-point
`<title>` elements.

---

#### FlightSpectrum — `src/components/FlightSpectrum.jsx`

The shipped bag-level flight chart: speed × stability scatter with overlap clustering, capacity-neutral
"ghost" desired slots, an Official/Current toggle, a legend, and a linked list of plotted discs.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `discs` | array | no | `[]` | Discs (with `moldInfo`) to plot. |
| `ghostSlots` | array | no | `[]` | Persisted desired flight gaps; rendered as diamonds, never counted against capacity. |

**Variants / modes:** `FLIGHT_SPECTRUM_MODES.CURRENT` ("Current reality" — wear/override adjusted)
vs `FLIGHT_SPECTRUM_MODES.OFFICIAL` (manufacturer numbers), toggled internally. Single-disc points
render as circles; ≥2 co-located discs render as a numbered cluster.

**State / side effects:** local `mode` state; memoized `buildFlightSpectrum()` from
`src/lib/flightSpectrum`. Deep-links each plotted disc to `/bag/discs/{id}`.

**Consumed by:** `src/pages/BagPage.jsx`.

**Accessibility:** `role="img"` with a count-bearing `aria-label`; the mode toggle is a
`role="group"` of `aria-pressed` buttons; the detail list is `aria-label="Plotted physical discs"`
and gives every point a text equivalent (this is what makes the SVG non-essential).

---

#### SkillRadar — `src/components/SkillRadar.jsx`

Five-axis career radar (pentagon grid + filled value polygon) with a text legend.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `axes` | `Array<{ key, label, score }>` | yes | — | Exactly 5 entries expected — geometry is hardcoded to fifths of a circle. `score` is 0–100 or `null`. |

**Variants / modes:** none. A `null` score plots at the center and reads "Insufficient data" in the
legend.

**State / side effects:** none.

**Consumed by:** `src/pages/CareerHubPage.jsx`.

**Accessibility:** `role="img"` + `aria-label="Five-axis career skill radar"`; the `<ul>` legend
carries the actual numbers, so the SVG is decorative.

---

#### ModeCard — `src/components/ModeCard.jsx`

Icon + title + description + chevron navigation card for a card-list menu.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `to` | string | yes | — | Router destination. |
| `icon` | component | yes | — | Destructured as `icon: Icon`; rendered `<Icon size={24} stroke={1.75} />` (Tabler icon). |
| `title` | string | yes | — | Card title. |
| `description` | string | yes | — | One-line description. |

**Variants / modes:** none.

**State / side effects:** none.

**Consumed by:** **nothing.** No file imports it. `src/pages/PracticeMenuPage.jsx:239-244`
hand-writes `.mode-card` / `.mode-card-body` / `.mode-card-title` / `.mode-card-description` /
`.mode-card-chevron` markup inline (and omits the icon). See
[Gaps and duplication](#gaps-and-duplication) and `_corrections/component-library.md`.

---

### Domain panels

#### BagResonance — `src/components/BagResonance.jsx`

Transparent bag flight-balance score (0–100) broken into coverage / speed-ladder / separation bars,
with a weighting-preset selector and an explicit weights footnote.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `discs` | array | no | `[]` | Discs in the bag. |
| `ghostSlots` | array | no | `[]` | Desired gaps; surfaced as labels, never counted against capacity. |
| `capacity` | number | no | `35` | Bag capacity for the `n/capacity` readout. |

**Variants / modes:** preset selection from `RESONANCE_PRESETS` (`balanced` is the initial state) —
each preset reweights the three components.

**State / side effects:** local `presetId`; memoized `buildBagResonance()` from
`src/lib/bagResonance`.

**Consumed by:** `src/pages/BagPage.jsx`.

**Accessibility:** `aria-labelledby="bag-resonance-title"`; the score has an explicit
`aria-label="Resonance score N out of 100"`; the preset row is a `role="group"` of `aria-pressed`
buttons; the bar tracks are `aria-hidden` because the numbers are already in text.

---

#### MissTendencyGrid — `src/components/MissTendencyGrid.jsx`

Miss-direction heat grid per distance band, with capture-coverage honesty text and small-sample
caveats. Diagnostic (real-time) misses only.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `report` | object | yes | — | `{ totalMisses, zonedMisses, captureCoverage, bands[] }`; each band is `{ start, label, zonedMisses, totalMisses, dominantZones[], zones[] }`. Produced by the insights layer. |

**Variants / modes:** three render states — no real-time misses, misses but no zones captured, and
the full band list (bands with zero zoned misses are filtered out).

**State / side effects:** none. Reads `WILSON_MIN_N_FOR_HIDING` from `src/lib/insights` to decide
when to print the small-sample caveat.

**Consumed by:** `src/pages/ConfidenceMapPage.jsx`.

**Accessibility:** `aria-labelledby="miss-tendency-title"`; each heat cell has an
`aria-label="{zone}: {count}"` and each grid an `aria-label="{band} miss heat grid"`, so heat
opacity is never the only channel.

---

#### PutterComparison — `src/components/PutterComparison.jsx`

Head-to-head physical-putter performance: overall make %, a shared-distance adjusted delta, Wilson
intervals under the sample threshold, and a collapsible per-band evidence list.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `report` | object | yes | — | `{ totalRealTimeAttempts, attributedAttempts, attributionCoverage, comparisonReady, rows[] }`; each row `{ putterDiscId, disc, makes, attempts, pct, interval, distanceAdjustedDelta, sharedBandAttempts, bands[] }`. |

**Variants / modes:** empty (no real-time attempts), not-ready (fewer than two selected putters),
and the full comparison list.

**State / side effects:** none. Reads `PUTTER_COMPARISON_MIN_SHARED_ATTEMPTS` and
`WILSON_MIN_N_FOR_HIDING` from `src/lib/insights`.

**Consumed by:** `src/pages/ConfidenceMapPage.jsx`.

**Accessibility:** `aria-labelledby="putter-comparison-title"`; per-row evidence uses native
`<details>/<summary>`, which is keyboard-operable for free.

---

#### ExperimentMarkerPanel — `src/components/ExperimentMarkerPanel.jsx`

Create and review "new putter" experiment markers, with before/after attributed make % and the delta.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `userId` | string | yes | — | Owner of the marker row. |
| `discs` | array | no | `[]` | Candidate discs; filtered to exclude `lost`/`retired`/`sold`. |
| `experiments` | array | no | `[]` | Computed experiment results to render. |
| `onCreated` | function | no | — | Optional callback after a successful insert (caller refetches). |

**Variants / modes:** each experiment card renders either the evidence-ready before/after/delta trio
or a "needs N attempts per side" note.

**State / side effects:** local form state (`discId`, `effectiveAt`, `label`, `notes`, `saving`,
`error`). **Writes directly to Supabase** — `supabase.from('practice_experiment_markers').insert(...)`
with a client-generated `crypto.randomUUID()` id and idempotency key. This is one of the few
components that is not repository-mediated.

**Consumed by:** `src/pages/ConfidenceMapPage.jsx`.

**Accessibility:** `aria-labelledby="experiment-marker-title"`; every field is wrapped in a `<label>`.

---

#### DataExportPanel — `src/components/DataExportPanel.jsx`

Settings panel that builds and downloads a deterministic CSV-in-ZIP export of the signed-in user's
synced account data.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| — | — | — | — | Takes no props; reads the user from `AuthContext`. |

**Variants / modes:** status machine `idle → working → complete | error`.

**State / side effects:** `useAuth()`; refuses to run when `navigator.onLine` is false (a partial
device cache must never be exported); calls
`dataExportRepository.collectUserExport(user.id)`, `buildDataExportArchive`, then
`downloadDataExport` — which triggers a browser file download.

**Consumed by:** `src/pages/SettingsPage.jsx`.

**Accessibility:** `aria-labelledby="data-export-title"`; the status paragraph switches between
`role="alert"` (error) and `role="status"` (progress/success).

---

#### DeleteAccountPanel — `src/components/DeleteAccountPanel.jsx`

Irreversible in-app account deletion behind a type-the-word confirmation. This is the codebase's only
typed-confirmation pattern.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| — | — | — | — | Takes no props; reads `deleteAccount`/`signOut` from `AuthContext`. |

**Variants / modes:** collapsed (single danger button) → confirming (type `DELETE`, then
Permanently delete / Cancel). The confirm phrase is the module constant `CONFIRM_PHRASE = 'DELETE'`.

**State / side effects:** on success, awaits the server RPC, then `purgeDeviceData({ storage:
localStorage, database: db })` to clear Dexie + localStorage, then a best-effort `signOut()`, then
`window.location.replace('/')` — a full reload, because every provider and open Dexie handle in
memory still belongs to the deleted user. Deliberately **not** a soft delete.

**Consumed by:** `src/pages/SettingsPage.jsx`.

**Accessibility:** `aria-labelledby="delete-account-title"`; the phrase input has a real `<label>`
and `aria-describedby`; the error is `role="alert"`. Submit stays disabled until the phrase matches
exactly.

---

#### DiscOdometerManager — `src/components/DiscOdometerManager.jsx`

Lifetime disc telemetry: totals, cosmetic tier + next milestone, quick +1/+10/+25/correction chips, a
manual event form, and a collapsible event history.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `userId` | string | yes | — | Used for outbox flush and event ownership. |
| `disc` | disc object | yes | — | Reads `id`, `total_throws`, `total_chain_hits`, `total_airballs`, `cosmeticUnlocks`. |
| `onDiscUpdate` | `(disc) => void` | yes | — | Called with the optimistically-updated disc. |
| `onError` | `(message: string) => void` | yes | — | Error sink; the component does not render load errors itself. |

**Variants / modes:** a negative delta switches the source to `manual_correction` and reveals a
required reason field.

**State / side effects:** on mount and after every save, `flushDiscOdometerOutbox(userId)` then
`loadDiscOdometer(disc.id)`. Writes go through `recordDiscOdometerEvent`, which may return
`queued: true` (offline) — surfaced as "Saved on this device…". History is capped at 30 rendered
rows.

**Consumed by:** `src/pages/DiscDetailPage.jsx`.

**Accessibility:** every form control has an explicit `<label htmlFor>`; the milestone chip row is
`aria-label="Cosmetic tier milestones"`; history uses `<details>/<summary>`.

---

#### DiscPhotoManager — `src/components/DiscPhotoManager.jsx`

Three-slot private disc photo manager with offline-queued uploads, delete, and 30-day restore.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `userId` | string | yes | — | Upload owner; used for the flush call. |
| `discId` | string | yes | — | Photo owner. |
| `legacyPhotoUrl` | string \| null | no | `null` | Pre-slot photo, shown in the `front` slot when no current front photo exists. |
| `onError` | `(message: string) => void` | yes | — | Error sink. |

**Variants / modes:** per-slot (`DISC_PHOTO_SLOTS`) empty / legacy / current; plus a "Recently
removed" restore block when any soft-deleted photo is still recoverable.

**State / side effects:** signs storage URLs via `signedDiscPhotoUrl` (failures degrade to no
image); registers a `window.addEventListener('online', …)` listener that calls
`flushDiscPhotoUploads(userId)` and refreshes, and removes it on unmount. Uploads are queued
(`queueDiscPhotoUpload`) and may report `queued: true`.

**Consumed by:** `src/pages/DiscDetailPage.jsx`.

**Accessibility:** `aria-labelledby="disc-photos-heading"`; photos have descriptive `alt` text; the
file input is wrapped in a `<label>` styled as a button (so the visible control is the label); the
status message is `role="status"`.

---

#### DiscProfileContext — `src/components/DiscProfileContext.jsx`

Two read-only sections for a disc detail page: contextual performance stats (putting %, round holes,
average score, last used) and a lifecycle/history list.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `discId` | string | yes | — | Disc to load context for. |
| `onError` | `(message: string) => void` | yes | — | Error sink. |

**Variants / modes:** loading (`<p className="loading">`), then the two sections. Missing values
render the literal string "Insufficient data" rather than a zero.

**State / side effects:** `loadDiscProfileContext(discId)` from
`src/lib/repository/discProfileRepository` on mount. History capped at 50 rendered rows.

**Consumed by:** `src/pages/DiscDetailPage.jsx`.

---

#### NotificationSheet — `src/components/NotificationSheet.jsx`

List of unresolved notifications with a category icon and either a Review action (when a destination
route exists) or a resolve checkmark.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `userId` | string \| undefined | yes | — | Passed to `useNotifications`. |
| `onOpen` | `(notification, destination) => void` | yes | — | Review handler; caller marks read and navigates. |
| `onResolve` | `(notification) => void` | yes | — | Checkmark handler for notifications with no destination. |

**Variants / modes:** empty state (`.sheet-empty-state`, "You're all caught up.") vs list. Per-row:
unread styling (`.notification-row-unread`), and Review vs resolve depending on
`notificationDestination(notification)`.

**State / side effects:** subscribes via the `useNotifications(userId)` hook; filters out anything
with `resolved_at`. Does not write — both mutations are delegated upward.

**Consumed by:** `src/components/AppShell.jsx` (rendered into `SheetHost` from the bell) and
`src/pages/NotificationsPage.jsx` (rendered as a full page). This dual use is why it is a plain list
with no chrome of its own.

**Accessibility:** `<ul aria-label="Notifications">`; the icon-only resolve button has
`aria-label="Resolve {title}"`; category icons are `aria-hidden`.

---

## Feature-scoped components

### `src/components/discUniverse/` (1)

#### UniverseBrowser — `src/components/discUniverse/UniverseBrowser.jsx`

Search-driven two-tier accordion (Manufacturer → Mold → plastic rows) over the shared `disc_molds`
catalog, prefixed by ghost-slot gap cards derived from the user's own discs.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `discs` | array | yes (may be nullish) | — | Owned discs; `?? []` internally. Only used for `stabilityGaps()`. |

**Variants / modes:** results only appear once the query is non-empty; each tier independently
open/closed. Molds with no normalized plastics fall back to a single `Standard` row.

**State / side effects:** local `query`, `openManufacturer`, `openMoldId`; `useCatalog()` +
`filterCatalogMolds` (IndexedDB snapshot fallback when offline); `stabilityGaps()` from
`src/lib/wishlist`. Each plastic row deep-links to
`/bag/discs/new?mold={id}&plastic={name}`.

**Consumed by:** `src/pages/BagPage.jsx` (UNIVERSE tab).

**Accessibility:** accordion headers are `<button type="button">` but carry no `aria-expanded` /
`aria-controls`; the search input has a placeholder but no label.

---

### `src/components/onboarding/` (3)

All three are steps of `src/pages/OnboardingPage.jsx` and share the `.onboarding-step` wrapper.

#### GoalStep — `src/components/onboarding/GoalStep.jsx`

Single-select card list of practice goals.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `goal` | string \| null | yes | — | Currently selected goal id. |
| `onSelectGoal` | `(id) => void` | yes | — | Selection handler. |
| `onNext` | `() => void` | yes | — | Continue; the button is disabled until `goal` is set. |

**Variants / modes:** options come from `GOAL_OPTIONS` in `src/lib/onboarding`.

**State / side effects:** none — fully controlled by `OnboardingPage`.

**Consumed by:** `src/pages/OnboardingPage.jsx`.

**Accessibility:** uses bespoke `.goal-card` buttons (title + description) rather than `ChipGroup`;
selection is class-only, with no `aria-pressed` or radiogroup semantics.

---

#### PutterStep — `src/components/onboarding/PutterStep.jsx`

Brand chips → mold radio cards → weight stepper, then provisions the default "Practice Stack" bag
and (optionally) the first putter.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `userId` | string | yes | — | Owner for the created bag/disc. |
| `onNext` | `() => void` | yes | — | Advance to the next step, on both confirm and skip. |

**Variants / modes:** Confirm & Continue (creates bag + disc + bag membership) vs Skip setup (creates
the empty Practice Stack bag only — that bag's existence is the signal `useOnboardingGate` reads, so
skipping must not skip it or the wizard loops forever).

**State / side effects:** local `brand`, `selectedMold`, `weight`, `saving`, `error`. `useCatalog()`
filtered to `{ manufacturer: brand, category: 'putter' }`; a `useEffect` auto-picks a default mold
whenever the brand changes. Writes: `createBag`, `upsertDisc`, `addDiscToBag`, plus
`updateInstantLaunchState(applySetProfileDefaults, { favoritePutterDiscId })` into localStorage.
Weight is clamped by `clampWeight` between `MIN_WEIGHT_GRAMS`/`MAX_WEIGHT_GRAMS`.

**Consumed by:** `src/pages/OnboardingPage.jsx`.

**Accessibility:** brand row uses `ChipGroup`; mold selection uses bespoke `.mold-radio-card`
buttons despite the name (no radio roles); the ± weight stepper buttons are unlabelled beyond their
`−`/`+` glyphs.

---

#### CalibrationStep — `src/components/onboarding/CalibrationStep.jsx`

Haptic test pad + units chip selection, then persists units and finishes onboarding.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `userId` | string | yes | — | Profile to update. |
| `onFinish` | `() => void` | yes | — | Called after `upsertProfileFields` resolves. |

**Variants / modes:** three feedback states — unsupported vibration (explanatory note), supported +
untested, supported + tested ("Felt that? That's your make pulse.").

**State / side effects:** `usePuttHaptics()` → `vibrateMake()` fires a real device vibration;
`upsertProfileFields(userId, { units })` writes the profile. Units options come from `UNIT_OPTIONS`.

**Consumed by:** `src/pages/OnboardingPage.jsx`.

**Accessibility:** the haptic pad is a large button; the unsupported-vibration case is surfaced as
visible text rather than silently degrading.

---

### `src/components/putterLineup/` (2)

#### FlightCurve — `src/components/putterLineup/FlightCurve.jsx`

Two exports. **Default** `FlightCurve`: a 120×160 SVG overlaying a disc's factory-stock flight path
against its wear-adjusted current path. **Named** `FlightCurveOverlay`: the same viewBox with N
current-reality paths in caller-chosen colors, for comparison views.

`FlightCurve` props:

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `disc` | disc object | yes | — | Uses `wear_score` and any per-disc flight overrides. |
| `mold` | mold object \| null | yes | — | Supplies the stock path; a null mold renders no stock line. |
| `className` | string | no | `''` | Appended to `.flight-curve`. |

`FlightCurveOverlay` props:

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `entries` | `Array<{ disc, color }>` | no | `[]` | Each disc's `moldInfo` is used for its curve; `color` becomes the inline stroke. |

**Variants / modes:** stock-vs-current (default export) or multi-disc overlay (named export). Paths
that cannot be computed are simply omitted.

**State / side effects:** none. `flightPath` + `wearAdjustedFlightNumbers` from
`src/lib/flightCurve`; `effectiveFlightNumbers` from `src/lib/discs`.

**Consumed by:** default export — `src/components/putterLineup/PutterLineup.jsx`; named
`FlightCurveOverlay` — `src/pages/DiscComparePage.jsx`.

**Accessibility:** both are `role="img"` with descriptive `aria-label`s. Overlay identity is carried
only by stroke color plus a `data-disc-id` attribute, so callers must supply their own legend.

---

#### PutterLineup — `src/components/putterLineup/PutterLineup.jsx`

Role-based swimlane view of every in-locker putter: flight curve, role chips, wear slider, odometer
alert with a one-tap wear step, and Retire.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `userId` | string | yes | — | Whose locker to load. |

**Variants / modes:** four swimlanes from the module-level `ROLES` constant (Primary, Backup,
Situational, Standard); render states are error-without-data, loading, empty locker, and the lanes.
Each lane shows an "Empty" placeholder.

**State / side effects:** self-fetching — `fetchUserDiscs(userId)` on mount and after every
mutation, filtered to `status === 'in_locker'` and `speedClass(speed) === 'putter'`. Mutations:
`updateDiscRole`, `updateDiscWear`, `upsertDisc(..., { status: 'retired' })`. The odometer alert
fires at `ODOMETER_ALERT_THRESHOLD` chain hits and proposes `proposeWearStepDown(...)`.

**Consumed by:** `src/pages/BagPage.jsx` (PUTTERS tab).

**Accessibility:** role selection uses `ChipGroup`; the wear slider is a native `<input type="range">`
inside a `<label>` with a live numeric readout. Retire is destructive with **no confirmation**.

---

### `src/components/puttingCanvas/` (19)

The live-capture surface. `PuttingCanvas` is the slot-based shell; `RegimenRunPage` and
`FreeformLogPage` compose the rest into it.

#### PuttingCanvas — `src/components/puttingCanvas/PuttingCanvas.jsx`

Generic ACTIVE_SESSION shell. Knows nothing about regimen vs. freeform — every region is a slot.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `contextBar` | node | no | — | Top zone; in practice a `CanvasContextBar`. |
| `toolbar` | node | no | — | Mid-round adjustments; in practice a `CanvasToolbar`. |
| `ghostPace` | node | no | — | Ghost-pace card slot. |
| `stackTracker` | node | no | — | Rendered inside `.putting-canvas-body`. |
| `gestureZone` | node | no | — | The scoring surface — `TapZone`, `GestureZone`, or `PanicZone`. |
| `batchRibbon` | node | no | — | Batch-entry surface. |

**Variants / modes:** all slots optional; omitting one renders nothing (kept backward compatible for
the Screen 8 additions).

**State / side effects:** `useWakeLock(true)` — the screen is held awake for the entire mount. This
lives here rather than in each page so every capture mode inherits it; rounds deliberately do not
take a wake lock.

**Consumed by:** `src/pages/RegimenRunPage.jsx`, `src/pages/FreeformLogPage.jsx`.

---

#### CanvasContextBar — `src/components/puttingCanvas/CanvasContextBar.jsx`

Top zone: stage progress, distance/volume, sound + diagnostic toggles, input-mode chips, session
factor chips, sync pill, and exit.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `stageLabel` | string | yes | — | Stage name. |
| `stageIndex` | number | yes | — | 1-based index shown as `Stage i / n`. |
| `stageCount` | number | yes | — | Total stages. |
| `distanceFt` | number | yes | — | Current distance readout. |
| `makes` | number | yes | — | Current stage makes. |
| `attempts` | number | yes | — | Current stage attempts. |
| `volumePlanned` | number | yes | — | Planned attempts for the stage. |
| `silenced` | boolean | yes | — | Sound state; toggles chip label Sound on / Silenced. |
| `onToggleSilence` | function | yes | — | Sound toggle. |
| `diagnosticMode` | boolean | yes | — | Diagnostic (miss-zone capture) state. |
| `onToggleDiagnostic` | function | yes | — | Diagnostic toggle. |
| `inputMode` | `'tap' \| 'gesture' \| 'panic'` | no | — | Input-mode chips render only when both this and `onChangeInputMode` are present. |
| `onChangeInputMode` | `(key) => void` | no | — | Input-mode handler. |
| `syncStatus` | `'synced' \| 'pending' \| 'syncing' \| 'error-retrying' \| 'failed'` | yes | — | Drives the pill's label and `canvas-sync-{status}` class; anything else renders an empty pill. |
| `onExit` | function | yes | — | Exit-session handler. |
| `externalFactors` | string[] | no | `[]` | Selected session factors. |
| `onToggleFactor` | `(factor) => void` | no | — | Factor chips render only when this is present. |
| `matchModeEnabled` | boolean | no | `false` | Shows a static "Match Mode" chip. |

**Variants / modes:** input-mode row and factor row are independently optional; Match Mode indicator
on/off.

**State / side effects:** none — purely presentational; the page/hook layer owns all state.

**Consumed by:** `src/pages/RegimenRunPage.jsx`, `src/pages/FreeformLogPage.jsx`.

**Accessibility:** the exit button has `aria-label="Exit session"`; the factor row has
`aria-label="Session factors"`. Input-mode chips use `ChipGroup`; the sound/diagnostic/factor chips
are hand-rolled `.chip` buttons with no `aria-pressed`.

---

#### CanvasToolbar — `src/components/puttingCanvas/CanvasToolbar.jsx`

Mid-round adjustments: ad-hoc putter swap drawer, weather drawer (condition chips + wind mph), an
Edit shortcut, and the weather→backup swap suggestion banner.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `userId` | string | yes | — | Forwarded to `PutterPicker`. |
| `activePutterDiscId` | string \| null | yes | — | Current selection. |
| `activePutterLabel` | string \| null | yes | — | Chip label; falls back to "No putter". |
| `onSelectPutter` | `(discId) => void` | yes | — | Swap handler; closes the drawer. |
| `weatherCondition` | string \| null | yes | — | One of `clear`, `headwind`, `tailwind`, `crosswind`, `rain`. |
| `windMph` | number \| null | yes | — | Wind speed; the input only appears for non-clear conditions. |
| `onSetWeather` | `({ condition, windMph }) => void` | yes | — | Weather handler; selecting `clear` nulls the wind. |
| `suggestedSwapDisc` | disc object \| null | no | — | Renders the swap banner when present. |
| `onAcceptSwap` | function | no | — | Banner "Yes, swap". |
| `onDismissSwap` | function | no | — | Banner "Ignore". |
| `onEdit` | function | no | — | Renders the 📝 Edit shortcut when present. |

**Variants / modes:** two independently toggled drawers plus the optional banner.

**State / side effects:** local `showSwapDrawer`, `showWeatherDrawer` only.

**Consumed by:** `src/pages/RegimenRunPage.jsx`, `src/pages/FreeformLogPage.jsx`.

**Accessibility:** drawer toggles are plain chips with no `aria-expanded`/`aria-controls`; the wind
input is inside a `<label>`.

---

#### SessionLauncher — `src/components/puttingCanvas/SessionLauncher.jsx`

READY_DEFAULT pre-session view: prediction card, quick-mod preset pills, putter picker, and the
Match Mode voice toggle.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `userId` | string | yes | — | Forwarded to `PutterPicker`. |
| `title` | string | yes | — | Forwarded to `SmartPredictionCard`. |
| `regimenName` | string | no | — | "Last time: …" line. |
| `suggestion` | object | no | — | `suggestNextSession()` output. |
| `presets` | array | no | — | Quick-mod presets. |
| `favoritePutterId` | string \| null | no | — | Pre-selected putter. |
| `onSelectPutter` | `(discId) => void` | yes | — | Putter selection. |
| `onSelectPreset` | `(preset) => void` | yes | — | Preset selection. |
| `onStart` | function | yes | — | Start handler. |
| `starting` | boolean | no | — | Disables Start and swaps the label. |
| `matchModeEnabled` | boolean | no | — | Toggle state. |
| `onToggleMatchMode` | function | no | — | Toggle renders only when present. |

**Variants / modes:** Match Mode toggle optional; child components self-hide when they have nothing
to show.

**State / side effects:** none — pure orchestration.

**Consumed by:** `src/pages/RegimenRunPage.jsx`, `src/pages/FreeformLogPage.jsx`.

**Accessibility:** the Match Mode chip is one of the few chips in the codebase that does set
`aria-pressed`.

---

#### SmartPredictionCard — `src/components/puttingCanvas/SmartPredictionCard.jsx`

Pre-session hero card: title, optional last-regimen line, optional suggested distance and current
form, and the Start button.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | string | yes | — | Card heading. |
| `regimenName` | string | no | — | Renders "Last time: {name}". |
| `suggestion` | object | no | — | `{ suggestedDistanceFt?, currentFormPct? }`; each line renders only if its field is non-null. |
| `onStart` | function | yes | — | Start handler. |
| `starting` | boolean | no | — | Disables the button, label becomes "Starting...". |

**Variants / modes:** each optional line independently present/absent (`RegimenRunPage` omits the
suggested distance because the regimen's sets already fix distances).

**State / side effects:** none.

**Consumed by:** `src/components/puttingCanvas/SessionLauncher.jsx`.

---

#### QuickModPresetPills — `src/components/puttingCanvas/QuickModPresetPills.jsx`

Thin `ChipGroup` wrapper over the user's saved quick-mod presets. Renders nothing when there are none.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `presets` | `Array<{ label, … }>` \| null | yes | — | `null`/empty renders `null`. Keyed and labelled by `preset.label`. |
| `onSelect` | `(preset) => void` | yes | — | Receives the whole preset. |

**Variants / modes:** action-only chips — no active state.

**State / side effects:** none.

**Consumed by:** `src/components/puttingCanvas/SessionLauncher.jsx`.

---

#### PutterPicker — `src/components/puttingCanvas/PutterPicker.jsx`

Chip row of the user's in-locker putters. Self-hides when the locker has none, so it never blocks
starting a session.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `userId` | string | yes | — | Whose locker to load. |
| `selectedId` | string \| null | yes | — | Currently selected disc id. |
| `onSelect` | `(discId) => void` | yes | — | Receives the disc **id**, not the disc. |

**Variants / modes:** error (`.form-error`), null (no putters / still loading), or the chip row.

**State / side effects:** self-fetching — `fetchUserDiscs(userId)` on mount, filtered to
`status === 'in_locker'` and `speedClass(speed) === 'putter'`.

**Consumed by:** `src/components/puttingCanvas/CanvasToolbar.jsx`,
`src/components/puttingCanvas/SessionLauncher.jsx`.

---

#### TapZone — `src/components/puttingCanvas/TapZone.jsx`

The default scoring surface: a fixed 50/50 split MADE / MISSED tap area with an undo link and a
streak readout.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `onMake` | function | yes | — | Made handler. |
| `onMiss` | function | yes | — | Missed handler. |
| `onUndo` | function | yes | — | Undo handler. |
| `consecutiveMakes` | number | no | `0` | `>0` shows "🔥 Streak: n". |

**Variants / modes:** none. Unlike `GestureZone` the zone does **not** grow with streak — the
blueprint specifies a literal 50/50 split for tap targets.

**State / side effects:** a 220 ms accept-flash timer (`ACCEPT_FLASH_MS`) cleared on re-fire.

**Consumed by:** `src/pages/RegimenRunPage.jsx`, `src/pages/FreeformLogPage.jsx`.

**Accessibility:** Made/Missed are real buttons with text labels (not gesture-only), which is what
makes tap mode the accessible default.

---

#### GestureZone — `src/components/puttingCanvas/GestureZone.jsx`

Single continuous swipe surface — up = make, down = miss, left = undo — with a streak-responsive
visual make territory and an explicit undo button.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `onMake` | function | yes | — | Make handler. |
| `onMiss` | function | yes | — | Miss handler. |
| `onUndo` | function | yes | — | Undo handler (also wired to the corner button). |
| `makeTerritoryPct` | number | no | `0` | Raw streak value from `sessionReducer`, **not** a height. |
| `growthCap` | number | no | `GESTURE_CONFIG.ZONE_GROWTH_CAP_PCT` | Cap the raw value is normalized against. |

**Variants / modes:** the make sub-area interpolates from a 50% baseline to a 60% cap
(`BASELINE_MAKE_ZONE_PCT` → `MAKE_ZONE_CAP_PCT`) as the streak approaches `growthCap`, so a fresh
stage still renders an evenly split, usable zone. Accept flash 220 ms, reject flash 260 ms.

**State / side effects:** `useGesturePointer(zoneRef, …)` owns pointer classification; local
`feedback` state plus a cleared flash timer.

**Consumed by:** `src/pages/RegimenRunPage.jsx`, `src/pages/FreeformLogPage.jsx`.

**Accessibility:** the Make/Miss labels are `aria-hidden` visual territory, not separate targets —
the corner Undo button is the only real control. Gesture mode is therefore not an accessible
substitute for `TapZone`; it is an opt-in alternative.

---

#### PanicZone — `src/components/puttingCanvas/PanicZone.jsx`

Low-battery / cold-hands mode: the whole canvas is one high-contrast zone — tap = made, hold = missed.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `onMake` | function | yes | — | Fired on pointer-up before the long-press threshold. |
| `onMiss` | function | yes | — | Fired at `LONG_PRESS_MS` (500 ms) while held. |

**Variants / modes:** none. Deliberately has **no undo affordance**.

**State / side effects:** a long-press timer cleared on pointer-up and pointer-leave; a 220 ms
accept flash.

**Consumed by:** `src/pages/RegimenRunPage.jsx`, `src/pages/FreeformLogPage.jsx`.

**Accessibility:** the whole zone is a `<div>` with pointer handlers — not a button, so it is not
keyboard- or screen-reader-operable. Acceptable only because it is an explicitly opted-into field
mode with `TapZone` as the default.

---

#### StackTracker — `src/components/puttingCanvas/StackTracker.jsx`

Geometric pip array representing the remaining discs in the physical stack — diamonds mark the
pressure-putt slot, circles mark standard putts.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `volumePlanned` | number | yes | — | Total planned attempts for the stage. |
| `events` | array | yes | — | Real-time putt events, used to distinguish gesture-logged from batch-filled pips. |
| `attemptsTotal` | number | yes | — | Attempts logged so far. |
| `hasPressureLast` | boolean | no | `false` | Marks the final pip as the pressure slot. |

**Variants / modes:** pip state classes come entirely from `stackPips()` in `src/lib/scoringCanvas`.

**State / side effects:** none.

**Consumed by:** `src/pages/RegimenRunPage.jsx`, `src/pages/FreeformLogPage.jsx`.

**Accessibility:** `role="img"` with `aria-label="{n} of {total} putts logged"`.

---

#### BatchRibbon — `src/components/puttingCanvas/BatchRibbon.jsx`

Manual (non-gesture) entry surface. Chooses `BatchGrid` or `BatchCarousel` by remaining volume,
shows a confirmation, then auto-advances.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `volumePlanned` | number | yes | — | **Remaining** attempts, not the stage's original total. `<= 0` renders `null`. |
| `historicalAvgMakePct` | number \| null | no | — | Forwarded to the carousel for smart-centering. |
| `onComplete` | `(makes, attempts) => void` | yes | — | Fires immediately on tap. |
| `onAdvance` | function | no | — | Fires ~3 s (`AUTO_ADVANCE_MS`) after a completion. Page-specific meaning. |

**Variants / modes:** `volumePlanned <= GRID_MAX_VOLUME` (10) → `BatchGrid`; otherwise
`BatchCarousel`. A third state — the "Logged m/n. Moving on..." confirmation — is checked *before*
the `volumePlanned <= 0` early return, because one tap always accounts for the full remaining volume
and would otherwise hide the confirmation on the same render.

**State / side effects:** local `confirmed` state driving a `window.setTimeout` cleared on unmount.
Per the data-split rule, batch entry writes straight into the stage tally and **never** synthesizes
`putt_events` rows (see `sessionReducer.js`'s `BATCH_COMPLETE`).

**Consumed by:** `src/pages/RegimenRunPage.jsx`, `src/pages/FreeformLogPage.jsx`.

---

#### BatchGrid — `src/components/puttingCanvas/BatchGrid.jsx`

Static 0..n grid for stages with ≤10 remaining attempts. One tap picks makes; misses are auto-filled
as the complement and never asked for separately.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `volumePlanned` | number | yes | — | Remaining attempts; renders `volumePlanned + 1` cells (0..n). |
| `onComplete` | `(makes, attempts) => void` | yes | — | Called with `(n, volumePlanned)`. |

**Variants / modes:** none.

**State / side effects:** none.

**Consumed by:** `src/components/puttingCanvas/BatchRibbon.jsx`.

---

#### BatchCarousel — `src/components/puttingCanvas/BatchCarousel.jsx`

Horizontally scroll-snapping 0..n scrub carousel for larger remaining volumes, smart-centered on the
historical average.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `volumePlanned` | number | yes | — | Remaining attempts; renders `volumePlanned + 1` cells. |
| `historicalAvgMakePct` | number \| null | yes | — | Drives both centering and the predictive anchor; `null` centers on the midpoint and shows no anchor. |
| `onComplete` | `(makes, attempts) => void` | yes | — | Called with `(n, volumePlanned)`. |

**Variants / modes:** the `0` and max cells get `.batch-carousel-cell-edge`; the
`round(historicalAvgMakes * 1.25)` cell gets `.batch-carousel-cell-predicted` — an optimistic nudge,
not a hard suggestion.

**State / side effects:** a mount-only `useEffect` calling `scrollIntoView({ inline: 'center' })`.
Deliberately does not re-center on later renders (it would fight the user's own scrubbing) — the
exhaustive-deps lint rule is suppressed for exactly that reason.

**Consumed by:** `src/components/puttingCanvas/BatchRibbon.jsx`.

---

#### EditTallyDrawer — `src/components/puttingCanvas/EditTallyDrawer.jsx`

Ad-hoc correction drawer: set the *correct* total makes/attempts for the current stage; the component
computes the delta.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `currentMakes` | number | yes | — | Seeds the makes field and the delta baseline. |
| `currentAttempts` | number | yes | — | Seeds the attempts field and the delta baseline. |
| `onApply` | `(makesDelta, attemptsDelta) => void` | yes | — | Deltas may be negative; the caller feeds them through the same `BATCH_COMPLETE` action batch entry uses. |
| `onCancel` | function | yes | — | Dismiss. |

**Variants / modes:** Apply is disabled while `makes < 0 || attempts < 0 || makes > attempts`, with
an inline `.form-error`.

**State / side effects:** local `makes`/`attempts` only.

**Consumed by:** `src/pages/RegimenRunPage.jsx`, `src/pages/FreeformLogPage.jsx`.

**Accessibility:** both number inputs are wrapped in `<label>` elements.

---

#### DiagnosticZonePicker — `src/components/puttingCanvas/DiagnosticZonePicker.jsx`

Full-overlay "where did it miss?" grid, shown only in diagnostic mode after a miss.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `onSelectZone` | `(zoneId) => void` | yes | — | Finalizes the deferred `putt_events` row with a zone. |
| `onDismiss` | function | yes | — | Skip — finalizes with `missZone = null`. |

**Variants / modes:** none. Cells come from `MISS_ZONES` in `src/lib/gestureEngine/missZones`.

**State / side effects:** none, but the timing contract matters: sound/haptic feedback for the miss
already fired immediately (feel must not wait on this), while the event row is deferred until this
resolves — recording with `missZone=null` and patching later would mutate a row that may already be
mid-sync.

**Consumed by:** `src/pages/RegimenRunPage.jsx`, `src/pages/FreeformLogPage.jsx`.

**Accessibility:** an overlay with no `role="dialog"`, no focus trap, and no labelled region — it
relies on being the only thing on screen.

---

#### FatigueCheckin — `src/components/puttingCanvas/FatigueCheckin.jsx`

1–5 fatigue rating prompt triggered by a miss pattern or an accuracy drop.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `reason` | `'trailing_misses' \| string` | yes | — | `'trailing_misses'` → "A miss pattern appeared."; anything else → "Accuracy dropped from earlier stages." |
| `onRespond` | `(rating: number \| null) => void` | yes | — | `null` when skipped. |

**Variants / modes:** two prompt copies as above.

**State / side effects:** none.

**Consumed by:** `src/pages/RegimenRunPage.jsx`, `src/pages/FreeformLogPage.jsx`.

**Accessibility:** `role="dialog"` + `aria-labelledby`; the rating row has `aria-label="Fatigue
rating"`. No `aria-modal` and no focus management.

---

#### GhostPaceCard — `src/components/puttingCanvas/GhostPaceCard.jsx`

Live comparison against the athlete's best previous run — putts ahead/behind, time ahead/behind, and
makes at the same attempt count.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `profile` | object \| null | yes | — | `{ sourceScore, eventCount }`; `null` renders `null`. |
| `comparison` | object \| null | no | — | `{ ready, attemptsNeeded, attemptDelta, timeDeltaMs, makeDelta, currentAttempts }`. |

**Variants / modes:** not-ready ("N more real-time attempts to compare", defaulting to 3) vs the
three-metric row.

**State / side effects:** none.

**Consumed by:** `src/pages/RegimenRunPage.jsx` **only** — not used by `FreeformLogPage`.

**Accessibility:** `aria-live="polite"` so pace changes are announced without stealing focus.

---

#### ClutchTimerPanel — `src/components/puttingCanvas/ClutchTimerPanel.jsx`

Clutch-simulator countdown to a server-persisted deadline, with optional system notification
permission.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `dueAt` | timestamp | yes | — | The saved deadline; leaving and returning never rerolls it. |
| `distanceFt` | number | yes | — | Eyebrow readout. |
| `onReady` | function | yes | — | Fired exactly once when the timer reaches `putt_now` (guarded by a ref). |
| `onExit` | function | yes | — | End run. |

**Variants / modes:** notification permission states `default` (offers Enable system alert),
`denied`, `unsupported`, and `granted` (no extra UI).

**State / side effects:** a 1 s `setInterval` plus a `visibilitychange` listener that re-ticks on
foreground (both cleaned up on unmount); `requestClutchNotificationPermission()` from
`src/lib/clutchTimer` triggers the real browser permission prompt.

**Consumed by:** `src/pages/RegimenRunPage.jsx` **only**.

**Accessibility:** `aria-live="polite"` on the panel and an `aria-label` on the countdown carrying
the formatted remaining time.

---

### `src/components/routineBuilder/` (1)

#### StageCard — `src/components/routineBuilder/StageCard.jsx`

One stage of a custom routine: distance chips, putt-count chips, and a pressure-last-putt toggle.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `index` | number | yes | — | 0-based; displayed as `Stage {index + 1}`. |
| `stage` | `{ distanceFt, putts, pressure }` | yes | — | Current stage values. |
| `onChange` | `(nextStage) => void` | yes | — | Receives a full patched stage object, not a partial. |
| `onDelete` | function | yes | — | Delete handler. |
| `canDelete` | boolean | yes | — | Hides the delete button when false (last remaining stage). |

**Variants / modes:** delete affordance present/absent; pressure toggle on/off. Options come from
`DISTANCE_OPTIONS` / `PUTT_OPTIONS` in `src/lib/routineBuilder`.

**State / side effects:** none — fully controlled. Uses `ChipGroup` for both steppers (the
blueprint's "segmented horizontal steppers" are single-select chip grids here, not dropdowns).

**Consumed by:** `src/pages/RoutineBuilderPage.jsx`.

**Accessibility:** the icon-only delete button has `aria-label="Delete stage {n}"`. The pressure
toggle is a hand-rolled `.chip` with no `aria-pressed`.

---

### `src/components/sessionReport/` (3)

#### SessionReport — `src/components/sessionReport/SessionReport.jsx`

The unified post-session / history-detail report. One component, three entry points, so a
just-finished session and the same session viewed later never tell two different stories. All data is
precomputed by the caller — this only renders.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | string | yes | — | Report heading; also part of the `NotesTagsEditor` remount key. |
| `headerAction` | node | no | — | Slot beside the title. |
| `at` | timestamp | yes | — | Rendered as a long-form date. |
| `lifecycleState` | `'completed' \| string` | no | — | Renders a Completed/Incomplete badge. |
| `syncState` | `'pending' \| 'needs_attention' \| 'synced'` | no | — | Renders the sync badge. |
| `completed` | boolean \| null | no | — | Renders the Completed/Abandoned badge inline with the date. |
| `totalScore` | number \| null | no | — | Points readout in the hero. |
| `hero` | `{ makes, attempts, longestStreak? }` | yes | — | Drives the hero scoreboard and its progress bar. |
| `rows` | `Array<{ label, detail, makes, attempts, cleanSet?, pointsEarned? }>` | yes | — | The Breakdown list. |
| `putterRows` | `Array<{ putterDiscId, label, makes, attempts, pct }>` | no | — | Putter-performance section; hidden when empty. |
| `dropOffRows` | `Array<{ label, todayMakes, todayAttempts, todayPct, baselinePct, warn }>` | no | — | 30-day baseline section; hidden when empty. |
| `celebrationEvents` | array | no | `[]` | Forwarded to `CelebrationOverlay`. |
| `notes` | string \| null | no | — | Seeds `NotesTagsEditor`. |
| `tags` | string[] | no | — | Seeds `NotesTagsEditor`. |
| `externalFactors` | string[] | no | `[]` | Forwarded to `SessionContextSummary`. |
| `perceivedEffort` | number \| null | no | — | Forwarded to `SessionContextSummary`. |
| `contextEditable` | boolean | no | `false` | Makes the context summary editable. |
| `onChangeContext` | `({ factors, effort }) => void` | no | — | Context change handler. |
| `weatherCondition` | string \| null | no | — | Weather line. |
| `windMph` | number \| null | no | — | Weather line. |
| `onSaveNotesTags` | function | no | — | Presence is what renders `NotesTagsEditor` at all. |
| `onHide` | function | no | — | Renders "Hide from History". |
| `onRetrySync` | function | no | — | Renders "Retry sync" beside the sync badge. |
| `onReplay` | function | no | — | Renders 🔄 Replay in the footer. |
| `onDashboard` | function | no | — | Renders 🏠 Dashboard in the footer. |

**Variants / modes:** effectively handler-driven — almost every optional section appears only if its
callback/data prop is supplied, which is how the post-session and history-detail variants differ.

**State / side effects:** none of its own. Remounts `NotesTagsEditor` via a composite
`key={title}-{notes}-{tags}` so an externally-refreshed record re-seeds the editor.

**Consumed by:** `src/pages/FreeformLogPage.jsx`, `src/pages/RegimenRunPage.jsx`,
`src/pages/HistoryDetailPage.jsx`.

**Accessibility:** the status cluster has `aria-label="Activity status"`. Section headings are `<h2>`
inside a `<section>` that already contains an `<h1>`.

---

#### SessionContextSummary — `src/components/sessionReport/SessionContextSummary.jsx`

Session factors + perceived effort, in either read-only or editable form.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `factors` | string[] | no | `[]` | Selected factors from the module-level `SESSION_FACTORS` list. |
| `effort` | number \| null | no | — | 1–10 perceived effort. |
| `editable` | boolean | no | `false` | Switches to chips + range slider. |
| `onChange` | `({ factors, effort }) => void` | yes when editable | — | Emits the whole next state. |

**Variants / modes:** read-only (a single joined sentence) vs editable. Returns `null` entirely when
not editable and there is nothing to show.

**State / side effects:** none.

**Consumed by:** `src/components/sessionReport/SessionReport.jsx`.

**Accessibility:** the effort slider is inside a `<label>` with a live value readout. Factor chips
are hand-rolled `.chip` buttons with no `aria-pressed`.

---

#### CelebrationOverlay — `src/components/sessionReport/CelebrationOverlay.jsx`

Banner list for XP/level-up celebration events.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `events` | `Array<{ message }>` \| null | yes | — | Empty/nullish renders `null`. |

**Variants / modes:** none. Kept as a real component (rather than inline in `SessionReport`) so the
gamification layer only has to start passing real events, not build new UI —
`src/lib/gamification/celebration.js` documents the `{ message }` shape it emits.

**State / side effects:** none.

**Consumed by:** `src/components/sessionReport/SessionReport.jsx`.

**Accessibility:** no live region — celebration text is not announced.

---

### `src/components/trophyRoom/` (5)

All five are composed by `src/pages/TrophyRoomPage.jsx`.

#### XpLevelBar — `src/components/trophyRoom/XpLevelBar.jsx`

RPG progression card: current level, XP bar, XP-to-next line, and a Ledger button.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `xp` | number | yes | — | **Lifetime** XP total. Level is recomputed from it, not read from the `profiles.level` cache. |
| `onOpenLedger` | function | yes | — | Opens `XpLedgerModal`. |

**Variants / modes:** normal progression vs level cap (`levelSpan === 0` → "Max level — N XP").

**State / side effects:** none; derived entirely from `xpProgressInLevel(xp)` in
`src/lib/gamification/xp` — so the bar stays correct even when the cached level column lags.

**Consumed by:** `src/pages/TrophyRoomPage.jsx`.

---

#### XpLedgerModal — `src/components/trophyRoom/XpLedgerModal.jsx`

Read-only slide-up audit of the last 30 days of XP events, plus the multiplier guide.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `ledger` | `Array<{ id, source_type, created_at, amount }>` | yes | — | Empty array renders "No XP earned in the last 30 days." |
| `onClose` | function | yes | — | Backdrop click and Close button. |

**Variants / modes:** empty vs list. `source_type` is mapped through `SOURCE_LABELS`
(`regimen_run`, `session`, `badge`, `import`) with a raw-value fallback. Read-only by design —
`xp_events` is an immutable ledger.

**State / side effects:** none. Reads `XP_PER_MAKE` / `XP_PER_CLEAN_STAGE` from
`src/lib/gamification/constants`.

**Consumed by:** `src/pages/TrophyRoomPage.jsx`.

**Accessibility:** `role="dialog"` + `aria-label="XP ledger"` on `.modal-sheet`. No `aria-modal`, no
focus trap, and the backdrop is a click-handling `<div>` rather than `role="presentation"` — weaker
than `SheetHost`. See Gaps.

---

#### TrophyWall — `src/components/trophyRoom/TrophyWall.jsx`

Filtered badge grid with a segmented All / Unlocked / In progress / Locked bar showing live counts.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `badges` | `Array<{ id, name, icon, tier, status, progress }>` | yes | — | Already filtered by the caller; empty renders "Nothing here yet." |
| `filter` | one of `TROPHY_FILTERS` | yes | — | Currently selected filter. |
| `counts` | `Record<filter, number>` | yes | — | Count shown beside each filter label. |
| `onFilterChange` | `(filter) => void` | yes | — | Filter handler. |
| `onInspect` | `(badge) => void` | yes | — | Opens `BadgeInspectDrawer`. |

**Variants / modes:** per-square status — `in_progress` adds an inline progress bar, `unlocked` adds
a ✓, `locked` is dimmed by class.

**State / side effects:** none; filter state lives in `TrophyRoomPage`. Filter list comes from
`TROPHY_FILTERS` in `src/lib/gamification/trophyRoom`.

**Consumed by:** `src/pages/TrophyRoomPage.jsx`.

**Accessibility:** the filter bar is `role="tablist"` with `role="tab"` + `aria-selected` children —
the only tablist in the component tree. Note the tabs do not reference `tabpanel` ids, and the badge
grid is not marked as the panel.

---

#### BadgeInspectDrawer — `src/components/trophyRoom/BadgeInspectDrawer.jsx`

Modal detail for one badge: icon, tier, description, and either the unlock date or a progress bar
plus a launch-drill shortcut.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `badge` | `{ name, icon, tier, description, status, progress, earnedAt, criteria }` | yes | — | The inspected badge. |
| `onLaunch` | `(distanceFt \| null) => void` | yes | — | Distance derived via `pursuitDistanceFor(badge.criteria)`; `null` when the badge implies none. |
| `onClose` | function | yes | — | Backdrop click and Close button. |

**Variants / modes:** `status === 'unlocked'` (unlock date, no drill button) vs in-progress/locked
(progress bar + Launch pursuit drill).

**State / side effects:** none.

**Consumed by:** `src/pages/TrophyRoomPage.jsx`.

**Accessibility:** `role="dialog"` + `aria-label={badge.name}`; badge icon is `aria-hidden`. Same
weaker-than-`SheetHost` modal semantics as `XpLedgerModal`.

---

#### ActivePursuits — `src/components/trophyRoom/ActivePursuits.jsx`

Carousel of the badges closest to unlocking, each with a one-tap "Launch pursuit drill" into the
freeform canvas preconfigured to a relevant distance.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `pursuits` | `Array<{ id, name, icon, description, progress, criteria }>` | yes | — | Empty array renders `null` (no empty state). |
| `onLaunch` | `(distanceFt \| null) => void` | yes | — | Same `pursuitDistanceFor` derivation as the drawer. |

**Variants / modes:** the distance suffix on the launch button appears only when the badge implies a
distance.

**State / side effects:** none.

**Consumed by:** `src/pages/TrophyRoomPage.jsx`.

**Accessibility:** badge icons are `aria-hidden`; progress is carried in text (`{n}%`) beside the bar.

---

## Reuse map

Look up by intent, not by name. **Use the listed component — do not build a new one.**

| UI need | Use this | Notes |
| --- | --- | --- |
| Chip group / segmented control / filter row / tag toggles | `ChipGroup` (`src/components/ChipGroup.jsx`) | Single- or multi-select via `isActive`. Already used in 15 other files. |
| Multi-select tags with free-text entry + save | `NotesTagsEditor` | Wraps `ChipGroup`; owns its own save state. |
| Bottom sheet / modal | `SheetHost` via `AppShell`'s `sheet` state | Best a11y in the codebase (`aria-modal`, backdrop role, background `aria-hidden`). `trophyRoom`'s `.modal-sheet` is the weaker legacy pattern. |
| Full-screen decision overlay during capture | `DiagnosticZonePicker` (miss zone) / `FatigueCheckin` (rating) | Both are capture-specific; neither is a general modal. |
| Flight chart — bag-level scatter | `FlightSpectrum` | Shipped and wired. `FlightChart` is the dead older version. |
| Flight chart — single disc curve | `FlightCurve` (default export) | Stock vs wear-adjusted current path. |
| Flight chart — multiple discs overlaid | `FlightCurveOverlay` (named export of the same file) | Caller supplies colors and legend. |
| Radar / multi-axis score chart | `SkillRadar` | Hardcoded to exactly 5 axes. |
| Picker — disc mold from the catalog | `MoldPicker` | Search + selected-summary states. |
| Picker — the user's putters | `PutterPicker` (`puttingCanvas/`) | Self-fetching, self-hiding; emits the disc **id**. |
| Picker — browse the whole catalog | `UniverseBrowser` (`discUniverse/`) | Accordion, deep-links to the add-disc form. |
| Picker — a count 0..n | `BatchGrid` (≤10) / `BatchCarousel` (>10), or `BatchRibbon` to pick automatically | Always prefer `BatchRibbon`. |
| Disc summary tile | `DiscCard` | `variant='grid' \| 'list'`, optional `to` link, `action` slot, `flair` mode. |
| Navigation card (icon + title + description + chevron) | `ModeCard` | Exists but currently unimported — see Gaps. |
| View/edit toggle for a settings-style section | `EditableSection` | Render-prop based; works for any field set. |
| Confirmation — destructive, irreversible | `DeleteAccountPanel`'s typed-phrase pattern | The only typed-confirmation UI. There is no shared confirm dialog. |
| Confirmation — ordinary destructive | `window.confirm(...)` | What `BagManagePage`, `GoalsPage`, `HistoryDetailPage` do today. Not a component. |
| Empty state | No shared component | `.empty-state` (CSS) is hand-rolled in 4 pages; `.sheet-empty-state` in `NotificationSheet`; `.trophy-empty` in `TrophyWall`. See Gaps. |
| Progress bar | No shared component | At least 6 track/fill pairs exist (`BagResonance`, `SessionReport` hero, `ActivePursuits`, `BadgeInspectDrawer`, `TrophyWall` square, `XpLevelBar`). See Gaps. |
| Toast / transient message | `ToastHost` | Mounted but currently fed `toast={null}` — no queue exists yet. |
| Loading state | No shared component | Convention is `<p className="loading">…</p>`. |
| Inline error | No shared component | Convention is `<p className="form-error">{message}</p>`, `role="alert"` on the important ones. |
| Screen chrome (header, scroll, tabs) | `AppShell` + route metadata | Never re-implement a header or tab bar; register the route in `src/lib/routeMetadata.js` instead. |
| Live-capture screen | `PuttingCanvas` slots | Composition only — do not fork the shell. |
| Post-session / history report | `SessionReport` | Deliberately one component, three entry points. |

---

## Gaps and duplication

Evidence-based only. Each item cites the file (and line where it matters).

### Dead components — exist, imported by nothing

1. **`FlightChart` (`src/components/FlightChart.jsx`) has zero importers.** A repo-wide search for
   `FlightChart` matches only its own definition. Its data feeder
   `flightChartPoints()` (`src/lib/bags.js:64`) likewise has no non-test caller — only
   `src/lib/bags.test.js`. `BagPage` renders `FlightSpectrum` (`src/pages/BagPage.jsx:6,216`), which
   supersedes it with clustering, ghost slots, and an Official/Current toggle. **Do not extend
   `FlightChart`; extend `FlightSpectrum`.**
2. **`ModeCard` (`src/components/ModeCard.jsx`) has zero importers**, yet
   `src/pages/PracticeMenuPage.jsx:239-244` hand-writes the exact `.mode-card` /
   `.mode-card-body` / `.mode-card-title` / `.mode-card-description` / `.mode-card-chevron` markup
   the component produces (dropping the icon and substituting a literal `›` for the Tabler chevron).
   This is a one-instance duplication of a component built for exactly this purpose.

### Near-duplicate components

3. **`TapZone` vs `GestureZone` vs `PanicZone`** (`src/components/puttingCanvas/`) are three
   implementations of "a full-bleed make/miss capture surface with an accept flash." All three
   define their own `ACCEPT_FLASH_MS = 220`. This is *intentional* — `TapZone`'s file comment records
   the signed-off Screen 8 divergence (fixed 50/50 tap split as the default, gesture retained as an
   alternative, panic as the low-battery fallback) — but a fourth capture mode should extend one of
   these, not become a fourth copy of the flash timer.
4. **`BadgeInspectDrawer` and `XpLedgerModal`** (`src/components/trophyRoom/`) are structurally
   identical: `.modal-backdrop` > `.modal-sheet` with `onClick={onClose}` on the backdrop,
   `stopPropagation` on the sheet, `role="dialog"` + `aria-label`, and a `.practice-header` with a
   `.link-button` Close. Neither sets `aria-modal`, traps focus, nor closes on Escape. Meanwhile
   `SheetHost` (`src/components/SheetHost.jsx`) implements the same idea correctly
   (`aria-modal="true"`, `aria-labelledby`, `role="presentation"` backdrop, and `AppShell`
   `aria-hidden`s the background at `AppShell.jsx:86`). These are the only two `.modal-sheet` users
   in the app; migrating them to `SheetHost` would delete the weaker pattern entirely.

### Duplicated data, not components

5. **`SESSION_FACTORS` is defined twice, verbatim.**
   `src/components/puttingCanvas/CanvasContextBar.jsx:10` and
   `src/components/sessionReport/SessionContextSummary.jsx:1` both declare
   `['indoor', 'outdoor', 'tired', 'new-putter', 'pre-tournament', 'experimenting']` as a
   module-local constant, and both render it as hand-rolled `.chip` buttons inside a
   `.factor-chip-row`. Every other option list in the codebase (`GOAL_OPTIONS`, `UNIT_OPTIONS`,
   `DISTANCE_OPTIONS`, `PUTT_OPTIONS`, `MISS_ZONES`, `TROPHY_FILTERS`, `RESONANCE_PRESETS`) lives in
   `src/lib/`. This one should too, and the two chip rows should be one component.

### Common needs with no shared component

6. **No empty-state component.** Four pages hand-roll `.empty-state` blocks
   (`src/pages/CourseDetailPage.jsx:49`, `src/pages/RoundsPage.jsx:61`,
   `src/pages/CoursesPage.jsx:46`, `src/pages/RoundStartPage.jsx:131`), while
   `NotificationSheet.jsx:13` uses `.sheet-empty-state` and `TrophyWall.jsx:36` uses
   `.trophy-empty`. Three CSS idioms for one concept.
7. **No progress-bar component.** Six independent track/fill pairs:
   `.bag-resonance-track` (`BagResonance.jsx:41`), `.hero-scoreboard-bar-track`
   (`SessionReport.jsx:88`), `.pursuit-bar-track` (`ActivePursuits.jsx:27` **and**
   `BadgeInspectDrawer.jsx:34` — the same class reused across files),
   `.trophy-square-bar-track` (`TrophyWall.jsx:51`), and `.xp-bar-track` (`XpLevelBar.jsx:19`). All
   are `<div style={{ width: '{pct}%' }}>` inside a track.
8. **No confirmation dialog.** Three pages call `window.confirm()` directly —
   `src/pages/BagManagePage.jsx:103`, `src/pages/GoalsPage.jsx:38`,
   `src/pages/HistoryDetailPage.jsx:111` — which is an unstyled OS dialog that violates the design
   system by construction, and is not available in a Capacitor/WKWebView context the same way.
   `DeleteAccountPanel` implements a proper in-app confirmation but only for account deletion.
   Meanwhile `PutterLineup`'s Retire action (`PutterLineup.jsx:133`) is destructive with **no**
   confirmation at all.
9. **`ToastHost` is wired but inert.** `AppShell.jsx:123` renders `<ToastHost toast={null} />` — a
   hardcoded `null` with no state, context, or queue behind it. Anything that needs a transient
   confirmation today either invents its own inline `.success-message` (`DiscPhotoManager.jsx:128`,
   `DiscOdometerManager.jsx:111`) or a local confirmed-state banner
   (`BatchRibbon.jsx:36`). A toast queue is the missing piece, not a new component.

### Accessibility gap that will cause duplication

10. **`ChipGroup` emits no selection semantics.** It renders plain `<button>` elements with a
    `chip-active` class and no `aria-pressed`, `role="radio"`, or `role="tab"`. Every component that
    needed real semantics therefore bypassed it: `BagResonance.jsx:32` and `FlightSpectrum.jsx:39`
    hand-roll `aria-pressed` buttons inside a `role="group"`; `TrophyWall.jsx:22-32` hand-rolls a
    `role="tablist"`; `SessionLauncher.jsx:28-35` hand-rolls a single `aria-pressed` chip;
    `GoalStep.jsx:11-20` and `PutterStep.jsx:103-114` hand-roll selectable cards. Adding an optional
    semantics prop to `ChipGroup` would collapse five hand-rolled variants; adding a sixth
    hand-rolled chip row would not.
