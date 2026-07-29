# Corrections — pre-shell screens (`root`, `login`, `onboarding`)

Contradictions found while writing `docs/ui/screens/root.md`, `login.md`, and `onboarding.md`.
**Not applied.** Each entry is a proposed edit to a root or foundation document, to be reconciled in one
reviewed commit.

Filed 2026-07-29 by the session that authored the three pre-shell screen documents. Evidence is against
`eb9fd2b` for code and against the files as they stand on `claude/ui-documents-status-3fphcw` for docs.

Numbering is local to this file and does not continue `screen-specs-and-agents.md`.

---

## C-1 — `SCREEN_SPECS.md` Screen 3 implies the onboarding goal selection is stored

**Where:** `SCREEN_SPECS.md:114-133` (Screen 3), specifically the "build as specified" framing at `:116`
and the NET-NEW line "goal cards" at `:125-126`.

**Claims:** Screen 3 is to be built "as specified — goal cards → brand/mold/weight putter provisioning
with smart default → units + haptic test", listing goal cards among the NET-NEW deliverables with no
qualification. The blueprint the entry defers to (`MASTER_PROJECT_BLUEPRINT.md:218`) states that the goal
cards "tag the user profile in Dexie.js to customize default dashboard layouts."

**Reality:** the selection is never persisted. `src/pages/OnboardingPage.jsx:17` holds it in
`useState(null)`; it is passed to `GoalStep` at `:28` and read nowhere else. `PutterStep` and
`CalibrationStep` do not receive it. No column, table, localStorage key, or repository call takes it —
`src/lib/onboarding.js` exports `GOAL_OPTIONS` and nothing that writes a goal, and `profiles` has no goal
column (`phase_a_profile_schema.sql`). The `goals` table introduced by
`supabase/migrations/20260716220000_phase_d3_goal_report_contracts.sql` is a different concept: Phase D3
measurable targets (`target_rating`, `practice_frequency`, `putting_volume`, `consistency`) owned by the
`goals` screen, whose values do not overlap `GOAL_OPTIONS`.

The wizard therefore asks a question in Step 1, gates `Continue` on the answer, and discards it.

**Proposed edit:** add an explicit divergence line to the `SCREEN_SPECS.md` Screen 3 entry recording that
goal-card *capture* shipped and goal-card *persistence* did not, so no agent reads the entry and assumes
a stored value is available to personalize a dashboard. Full detail in `docs/ui/screens/onboarding.md`
§ 12 open question 1 and § 13.

---

## C-2 — `SCREEN_SPECS.md` Screen 2 lists a sync-status pill that was never built

**Where:** `SCREEN_SPECS.md:102-106` (Screen 2 NET-NEW); the phrase itself is at `:105`.

**Claims:** the `AuthPage.jsx` rewrite delivers "(toggle, 6-digit OTP block component, SSO buttons,
offline-persistence checkbox, **sync-status pill**)". The blueprint wireframe shows it as
`[🟢 CLOUD SYNC: READY]` in the header row (`MASTER_PROJECT_BLUEPRINT.md:175`).

**Reality:** no sync pill exists on this screen. `src/pages/AuthPage.jsx` renders, in order: `h1`, an
optional guest note, two `ChipGroup`s, one of two forms, an optional iOS SSO note, the SSO row, and an
optional guest link. There is no status pill, no `syncStatus` prop, and no import of any sync component.
Nothing in `src/App.css` defines an auth-page pill class. The other four items in the same
parenthetical did ship.

**Proposed edit:** strike "sync-status pill" from the Screen 2 NET-NEW list, or move it to a divergence
line explaining why a pre-session screen has no sync state to report. As written the entry reads as a
shipped-feature inventory and one of its five items is absent.

---

## C-3 — Guest→account conversion ships but has no in-app entry point

**Where:** `SCREEN_SPECS.md:102-106` (Screen 2 NET-NEW), which lists "guest→account conversion
(`updateUser`/`linkIdentity` preserving local progress)" at `:103-104` among the delivered items.

**Claims:** guest conversion is a shipped capability of Screen 2.

**Reality:** the code ships and the UI is unreachable. `AuthContext.jsx:59-62` exports
`convertGuestWithOtp`, `verifyGuestConversion`, and `linkGuestWithOAuth`; `AuthPage.jsx` branches on
`isGuest` at lines 112, 113, 119, 241 to render the `Save Your Progress` variant. But a repo-wide search
finds exactly one consumer of `isGuest` — `AuthPage.jsx` itself — and **nothing in the application
navigates a signed-in user to `/login`**:

- `ProtectedRoute.jsx:8` redirects only when `!user`; a guest *is* a user, so it never fires for them.
- `src/App.jsx:47-50` redirects any session at `/` to `/practice`, guests included.
- The only `to="/login"` / `navigate('/login')` call sites are `SplashPage.jsx:41,45` (signed-out front
  door) and the two guest-failure fallbacks at `SplashPage.jsx:17` and `AuthPage.jsx:107`.
- Neither `SettingsPage.jsx` nor `CareerHubPage.jsx` nor `ProfilePage.jsx` offers a conversion affordance.

So a guest can only reach the conversion screen by editing the URL. Every guest who does not is
permanently a guest.

**Proposed edit:** either add the entry point (a "Save your progress" affordance on `me-root` or
`settings` is the obvious home) or qualify the `SCREEN_SPECS.md` Screen 2 line to say the conversion
mechanism is implemented but not yet surfaced. Tracked as `T-login-6` in `docs/ui/screens/login.md`,
blocked on the placement decision.

**Not a correction to the code's design:** the conversion mechanism itself is correct — same `user.id`
throughout, identity added rather than user recreated, which is exactly what standing divergence #4
promises.

---

## C-4 — `SCREEN_SPECS.md` Screen 1 cites a topo-background CSS treatment that does not exist

**Where:** `SCREEN_SPECS.md:88-89` (Screen 1 REUSE): "Sun-Drenched Topo theme tokens (shipped 2.2a),
`btn-primary` pattern, topo-background CSS treatment already used elsewhere."

**Claims:** a topographic background treatment exists in the codebase and is reusable on Screen 1.

**Reality:** a case-insensitive search for `topo` across `src/` returns exactly one hit —
`src/index.css:1`, the comment `/* Sun-Drenched Topo (Oswald edition) — design tokens. */`. There is no
`.topo-background` class, no topographic SVG or image asset, and no element in `SplashPage.jsx` or
anywhere else that applies one. "Sun-Drenched Topo" is the theme's name; the treatment it implies was
never built. The other two REUSE items (theme tokens, `btn-primary`) are real and are used by this screen.

**Proposed edit:** drop the third REUSE item, or reclassify it as NET-NEW if the treatment is still
wanted. Minor, but an implementing agent will go looking for a class that is not there.

---

## C-5 — `STATE_MATRIX.md`'s pre-shell table leaves two cells unresolved that this batch answers

**Where:** `docs/ui/STATE_MATRIX.md` § 3, "Pre-shell" coverage table, the `onboarding` row.

**Claims:** two cells are marked `?` pending investigation:

- `S-ERR-INLINE`: `? per step component`
- `S-OFFLINE-READ`: `⚠️ PutterStep uses cached catalogRepository; CalibrationStep ?`

**Reality:** both are now determined, from reading the three step components at `eb9fd2b`.

- **`S-ERR-INLINE` is ✅.** All three error surfaces are inline `.form-error` beside content that stays
  usable: `PutterStep.jsx:118` (catalog load failure), `PutterStep.jsx:139` (provisioning failure),
  `CalibrationStep.jsx:56` (profile write failure). `GoalStep` has no error path because it makes no
  call. No step early-returns an error as its whole body, so `S-ERR-BLOCK` is correctly ✅ none.
- **`S-OFFLINE-READ` for `CalibrationStep` is ➖, not ❌.** The step performs no read: `usePuttHaptics()`
  is a synchronous capability check on `typeof navigator.vibrate` (`src/hooks/usePuttHaptics.js:13`), and
  `UNIT_OPTIONS` is a module constant. There is nothing to serve offline, so the cell is not applicable
  rather than unimplemented. `GoalStep` is the same. The `⚠️` on `PutterStep` is right and worth keeping:
  `useCatalog()` is `networkMode: 'offlineFirst'` over a Dexie snapshot, so it degrades on a device that
  has loaded the catalog once and fails outright on one that has not.

**Proposed edit:** replace the two `?` cells with ✅ and a split annotation
(`⚠️ PutterStep cached catalog; ➖ GoalStep/CalibrationStep read nothing`). Evidence and reasoning in
`docs/ui/screens/onboarding.md` § 6, Error and Offline paths.

**Timing note.** `STATE_MATRIX.md` did not exist when this batch began; it landed in `8e9d7f9` while
these three documents were being written. An earlier draft of this file carried a correction reporting it
missing — that correction is withdrawn and replaced by the above. The three pre-shell screen documents
were revised to cite row ids per `TEMPLATE.md` § 7 once the file appeared.

---

## Not corrections

Recorded here so a later reader does not re-file them:

- **Pre-shell routes have no `section`, `title`, `scrollKey`, `showActivityPill`, or
  `preserveNestedState`.** `PUBLIC_ROUTES` (`routeMetadata.js:314-318`) declares only `id`, `match`, and
  `shell`. These are absent keys, not `null` values, and nothing reads them because `AppShell` never
  mounts. `SCREEN_INVENTORY.md`'s pre-shell table correctly omits the columns.
- **`SCREEN_INVENTORY.md:88`'s "`SplashPage`, or redirect to `/practice` when authenticated"** matches
  `src/App.jsx:47-50` exactly, including the guest case.
- **`SCREEN_SPECS.md` standing divergence #4 (email 6-digit OTP, Supabase anonymous guest mode)** is
  accurate against `AuthContext.jsx:44-45` and `OtpInput.jsx:7`. The `OtpInput` default `length` is 6 and
  `AuthPage.jsx:207` gates submission on `otp.length < 6`.
- **`SCREEN_SPECS.md:107`'s framing of the "365-Day Offline Guarantee" as a UX label** over
  `persistSession`/`autoRefreshToken` is correct and is corroborated in code by the comment at
  `src/lib/supabaseClient.js:11-14`. That the checkbox is inert is documented in
  `docs/ui/screens/login.md` § 12 as an open question, not filed as a documentation contradiction — the
  spec already tells the truth about it.
- **`SCREEN_SPECS.md` Screen 3's haptic-fallback requirement is met.** `CalibrationStep.jsx:40-44`
  renders the honesty line whenever `usePuttHaptics().supported` is false. That the pad remains tappable
  and silent in that state is recorded in `docs/ui/screens/onboarding.md` § 8 and § 12, not here.
- **`PHASE_A_ARCHITECTURE.md` § 14's transaction contract is not violated by onboarding's untransacted
  writes.** § 14 scopes itself to activity-lifecycle transitions; bag and profile provisioning are not
  lifecycle mutations. The absence of a boundary is a defect of the screen, tracked as `T-onboarding-2`,
  not a contract breach.
