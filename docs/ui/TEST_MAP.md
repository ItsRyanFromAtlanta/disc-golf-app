# Test Map

Screen-to-test coverage, and the E2E backlog. Verified against `eb9fd2b`.

## The headline

**All 74 test files live under `src/lib/`. There are zero component tests and zero page tests.**

```
find src -name "*.test.js*" ! -path "*/lib/*"   →   (no results)
```

Every test in this repo exercises a pure function, a repository, or a reducer. Nothing asserts that a
page composes those pieces correctly, that a button is wired to the function it names, or that a screen
renders. That is not a criticism of the coverage — the library layer is well tested, and the project's
convention of putting derived stats in `lib/insights/` as tested pure functions is exactly why. It does
mean **screen-level regressions are currently invisible to CI.**

Combined with the absent browser E2E suite (`PHASE_A_ARCHITECTURE.md` § 9 requires one; it was never
built), the verification gap is precisely: *everything between a tested function and a shipped pixel.*

## How to read the mapping

Mapping is by domain, derived from imports and module names. It answers "which tests would likely break
if I change this screen's logic," not "which tests cover this screen" — no test names a screen.

Each screen document's **Tests → Existing coverage** section should confirm its row by reading the
imports of the page component, and correct it here if the inference is wrong.

## PLAY

| Route id | Related tests | Notes |
|---|---|---|
| `play-root` | `dashboardHero`, `playLaunch`, `insights/insights` | `heroCardState` and `quickPlayOptions`/`resolveQuickPlayRegimen` are the launchpad logic |
| `freeform-active` | `instantLaunch/*` (8 files), `scoringCanvas`, `gestureEngine/classify`, `fatigueCheckin` | The FSM, session reducer, crash recovery, and backoff all sit under this screen |
| `regimen-select` | `repository/regimenRepository` | |
| `routine-builder` | `routineBuilder`, `regimenScoring`, `drillEngine` | 100-putt ceiling and stage validation |
| `regimen-active` | `instantLaunch/*`, `scoringCanvas`, `gestureEngine/classify`, `regimenScoring`, `clutchTimer`, `ghostPacing`, `matchModeCoach`, `drillEngine`, `fatigueCheckin` | Most heavily covered surface in the app |
| `practice-history` | `history`, `repository/historyRecoverySync`, `localPurge` | |
| `practice-history-deleted` | `history`, `localPurge` | Recently Deleted visibility is a tunable policy, `PHASE_A_ARCHITECTURE.md` § 15 |
| `practice-history-detail` | `history`, `insights/putterComparison`, `insights/missTendency`, `insights/experimentComparison` | |
| `practice-stats` | `insights/insights`, `insights/missTendency`, `insights/putterComparison` | |
| `notifications` | `notifications`, `notificationPreferences`, `repository/notificationRepository` | |

## DISCS

| Route id | Related tests | Notes |
|---|---|---|
| `discs-root` | `bags`, `bagHistory`, `bagResonance`, `wishlist`, `flightCurve` | `wishlist.stabilityGaps` is the ghost-slot detection; `flightCurve` covers `PutterLineup` |
| `disc-collection` | `discFilters`, `discLocker`, `discFlair` | |
| `bag-manage` | `bags`, `bagHistory` | |
| `disc-compare` | `discCompare`, `discCompareCohorts`, `flightSpectrum`, `flightCurve` | |
| `lost-found` | `lostFound` | |
| `disc-new` | `discLocker`, `repository/catalogRepository` | Mold search is catalog-backed |
| `disc-detail` | `discs`, `discLocker`, `discTaxonomy`, `discOdometer`, `discPhotos`, `discProfile`, `repository/discOdometerRepository` | Confirmed by reading imports — see `screens/disc-detail.md` |

## COURSES

| Route id | Related tests | Notes |
|---|---|---|
| `courses-root` | **none** | |
| `courses-new` | **none** | Quick-course creation is untested |
| `course-detail` | **none** | |
| `rounds-root` | `rounds` | |
| `round-start` | `rounds` | |
| `round-scorecard` | `rounds` | `roundTotal`, `parTotal`, `relativeToPar`, `formatRelativeToPar` only |
| `round-summary` | `rounds` | |

**The COURSES section is the least-covered part of the app.** `src/lib/roundLog.js` exports **9
functions and has no test file at all** — it owns every course and round query in the app
(`DEVELOPMENT_PLAN.md` § J1). The only coverage in this entire section is `rounds.test.js` against four
pure functions: `roundTotal`, `parTotal`, `relativeToPar`, `formatRelativeToPar`.

So the four tested functions compute totals, and the nine untested ones do all the reading and writing.
E2 is "audit and harden the existing course/layout and offline round routes" — this is the strongest
available argument for where that audit should start.

## ME

| Route id | Related tests | Notes |
|---|---|---|
| `me-root` | `careerSummary` | |
| `profile-details` | **none** | No `profile.test.js` exists |
| `settings` | `dataExport`, `repository/dataExportRepository`, `storagePersistence`, `localPurge`, `notificationPreferences` | Account deletion is untested and its migration is unapplied |
| `goals` | `goals`, `repository/goalRepository` | |
| `weekly-reports` | `weeklyReport`, `repository/weeklyReportRepository` | |
| `trophy-room` | `gamification/gamification` | |

## Pre-shell

| Route id | Related tests | Notes |
|---|---|---|
| `root` | `platform` | `isIosLike`, `isStandaloneDisplay`, `oauthRedirectLeavesApp` |
| `login` | `platform` | **No auth flow test.** OTP, SSO, and anonymous sign-in are untested |
| `onboarding` | `onboarding` | |

## Cross-cutting

Not attributable to one screen; a change here can break many.

| Test | Covers |
|---|---|
| `routeMetadata` | The route contract every screen document's identity block is drawn from |
| `navigation`, `tabNavigation` | `resolveActiveTab`, `resolveTabPressAction` — the three-state tab press |
| `activityLifecycle/activityLifecycle`, `repository/activityRepository`, `repository/activitySync` | Lifecycle engine and sync |
| `repository/offlineFirstRepository`, `db/dexieDb` | Offline substrate |
| `metrics/registry` | Metric registry, `PHASE_A_ARCHITECTURE.md` § 5 |
| `a10Equivalence` | Offline/crash equivalence — the gate that blocks optional Phase A work |
| `phaseD2Migration`, `phaseD3ContractsMigration` | Migration contracts |
| `instantLaunch/installationId`, `backoff`, `errorClassification`, `crashRecovery` | Sync plumbing shared by both capture screens |

## Running the suite

```bash
VITE_SUPABASE_URL=https://example.supabase.co \
VITE_SUPABASE_ANON_KEY=ci-test-placeholder \
npm test
```

Without the placeholders, 13 files fail at import with a config error that looks like a regression and is
not. CI sets them inline. Green baseline: 497 tests across 74 files.

## E2E backlog

`PHASE_A_ARCHITECTURE.md` § 9 requires automated browser E2E and § 16 lists it among two required items
that "closed without being met." `docs/development/CURRENT_WORK.md` staged action 6 is to either build a
Playwright baseline or amend the contract. Nothing here is built — these are candidate specs.

Chromium and Playwright are preinstalled in the Claude Code web environment
(`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`), so the tooling barrier is zero.

**Priority 1 — flows where a silent break loses user data**

1. Start a regimen, record putts, kill the tab, relaunch → crash recovery resumes the session.
2. Record putts offline → reconnect → outbox flushes exactly once, no duplicates.
3. Finalize an activity → it appears in history with matching totals.

**Priority 2 — flows with no unit coverage at all**

4. Quick-course create → start round → enter scores → finalize; totals match `rounds.test.js` expectations.
5. Sign in with email OTP → land on `/practice`.
6. Never-onboarded user → onboarding gate → completes → default bag exists.

**Priority 3 — cross-screen contracts**

7. Tab press three-state behavior against a real scroll region.
8. Back control returns to section root from a nested route.
9. Notification sheet: open → mark read → navigate to destination.

Per-screen E2E paths accumulate in each screen document's **Tests → E2E critical paths** section. This
list is the aggregate view; the screen documents are where the detail belongs.

## Proposed coverage rule

Not yet adopted — proposed for the UI definition-of-done in `docs/operations/RELEASE_CHECKLIST.md`:

> A screen with zero related tests may not gain new behavior without at least one test on the pure logic
> it introduces. Screens in the COURSES section are exempt only until the E2 audit closes.
