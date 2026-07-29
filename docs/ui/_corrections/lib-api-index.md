# Corrections — LIB_API_INDEX

Contradictions found between existing root documents and the code while writing
`docs/ui/LIB_API_INDEX.md`. Logged, not fixed in place (`docs/ui/README.md` § Working rules 5).

Each entry: the claim, the evidence, and the correct fact.

---

## 1. `SCREEN_SPECS.md` cites `searchMolds` from `src/lib/discLocker.js`; no such export exists

**Claim — two places:**

- `SCREEN_SPECS.md:120` — Screen 3 (Onboarding Wizard) REUSE list:
  > `src/lib/discLocker.js` (`searchMolds`, `upsertDisc`, `fetchBags`, `createBag`, `addDiscToBag`)
- `SCREEN_SPECS.md:163` — Screen 5 (Bag & Locker hub) REUSE list:
  > `src/lib/discLocker.js` (`searchMolds`, `fetchBagDiscs`, `fetchUserDiscs`)

**Evidence:**

- `src/lib/discLocker.js` exports exactly: `fetchUserDiscs`, `fetchDisc`, `upsertDisc`,
  `buildDiscCopies`, `createDiscCopies`, `updateDiscRole`, `updateDiscWear`, `fetchBags`,
  `createBag`, `updateBag`, `deleteBag`, `setDefaultBag`, `fetchBagDiscs`, `fetchDiscBagIds`,
  `addDiscToBag`, `removeDiscFromBag`. No `searchMolds`.
- `grep -rn "searchMolds" src/` returns nothing.
- `git log -S"searchMolds" -- src/lib/discLocker.js` → last touched in `6c88410`
  ("feat: add offline catalog repository"), which removed it.

**Correct fact:** mold search now lives at
`src/lib/repository/catalogRepository.js:86` — `filterCatalogMolds(catalog, { query, manufacturer,
category })`, backed by the offline catalog snapshot from `useCatalog()`
(`catalogRepository.js:100`). Both screens the spec names already consume it:

- `src/components/onboarding/PutterStep.jsx:28` — `filterCatalogMolds(catalog.data, { manufacturer: brand, category: 'putter' })`
- `src/components/MoldPicker.jsx:8` and `src/components/discUniverse/UniverseBrowser.jsx:15` — `filterCatalogMolds(catalog.data, { query })`

**Suggested resolution:** in `SCREEN_SPECS.md`, move `searchMolds` out of the `discLocker.js` REUSE
entries on lines 120 and 163 and replace it with
`src/lib/repository/catalogRepository.js` (`filterCatalogMolds`, `useCatalog`).

---

## 2. `AGENTS.md` heading marks gamification "planned"; it is shipped

**Claim:** `AGENTS.md:260` — heading reads `## Gamification (planned, Layer 5)`, and the body
describes the module as something that "land[s]" in future tense.

**Evidence:** `src/lib/gamification/` ships nine modules with the exact API the section forecasts —
`xp.js` (`calculateXpForLevel`, `1000 × 1.15^(level-1)`, matching the stated formula),
`constants.js`, `badgeCatalog.js` (25 badges), `metrics.js`, `evaluateBadges.js`, `playerStats.js`,
`celebration.js`, `trophyRoom.js`, and `badgeEvaluatorService.js` (the "BadgeEvaluatorService" the
section names). Covered by `src/lib/gamification/gamification.test.js`. The Trophy Room route is live
(`src/lib/routeMetadata.js:293`, id `trophy-room`).

**Correct fact:** the content of the section is accurate; only its `(planned, Layer 5)` status
qualifier is stale.

**Suggested resolution:** retitle to `## Gamification` (or `(shipped, Layer 5)`) and switch the body
to present tense. Low severity — an agent reading it gets correct API facts either way.

---

*No other divergence found.* A mechanical cross-check of every backticked identifier in
`SCREEN_SPECS.md`, `AGENTS.md`, `PHASE_A_ARCHITECTURE.md`, and `PRODUCT_ROADMAP.md` against the real
export set of `src/` produced only item 1 above; every other unmatched token was a database
table/column name, a lifecycle enum string value, or a third-party API (`supabase.auth.linkIdentity`,
`updateUser`, workbox `skipWaiting`/`clientsClaim`).
