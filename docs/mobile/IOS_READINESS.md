# iOS and Mobile Readiness

The current product remains PWA-first. Add Capacitor only after Phase A field flows are stable and a
native capability or store-distribution need justifies the maintenance surface.

## Fixed 2026-07-27 (web/PWA, ahead of any native work)

An audit of the iOS story found six defects in the shipped PWA. **Five are fixed; the sixth is fixed in
the UI only and is still an open App Review blocker — see the corrected bullet below.** None required
Capacitor. (Corrected 2026-07-29; this sentence previously read "All are fixed", which contradicted
`docs/development/CURRENT_WORK.md` in the same repository. Was
`docs/ui/_corrections/me-screens.md` C-3.)

- Apple/Google sign-in cannot reliably complete in an installed iOS PWA — the redirect leaves the
  standalone context and commonly returns in Safari, where the new session is invisible to the app.
  The sign-in screen now says so and steers to the in-app email code.
- The service worker used `autoUpdate` + `skipWaiting` on an auto-deploying branch, so a deploy could
  reload an active capture session. Updates now wait for an explicit tap.
- No screen wake lock existed; iOS auto-locked mid-routine. Active putting capture now holds one.
- Web Audio was muted by the iOS ring switch with no fallback, and stayed suspended after
  backgrounding. A playback audio session is declared and the context is resumed.
- `navigator.storage.persist()` was never called, leaving the unsynced outbox evictable.
- ⚠️ **STILL OPEN.** There was no in-app account deletion — a hard App Review rejection under
  Guideline 5.1.1(v). The **user interface** was added on 2026-07-27: `SettingsPage.jsx:56` renders
  `<DeleteAccountPanel />`, which implements the typed-`DELETE` confirmation and server-first purge
  ordering (`DeleteAccountPanel.jsx:22-48`). The **capability** was not. The RPC it calls does not
  exist in the deployed database — `AuthContext.jsx:39` calls `supabase.rpc('delete_own_account')`, and
  `supabase/migrations/20260727120000_phase_e_account_deletion.sql:34` creates it but **is not
  applied** (`docs/development/CURRENT_WORK.md:104-108`, where it is the #1 owner action). Tapping
  `Permanently delete` today renders `Account not deleted: <undefined function>`
  (`DeleteAccountPanel.jsx:98`). **Do not submit to App Review on the strength of this line.** The
  failure is at least fail-safe: server-first ordering means `purgeDeviceData` never runs when the RPC
  fails, so no local data is destroyed by the failed attempt. Applying the migration makes this bullet
  true; a migration contract test is also missing (the repo has that pattern for two earlier
  migrations). Registered as `T-settings-2` / `T-settings-3`.

## Before adding native projects

- Stabilize route/deep-link, auth redirect, offline/outbox, background/resume, camera/photo, and
  notification contracts in the web app.
- Decide bundle identifiers, minimum OS/device support, signing ownership, environments, and release
  channels.
- Keep `ios/` and `android/` generated shells thin; business rules and repositories stay testable in
  shared source code.

## iOS release requirements

- Maintain `PrivacyInfo.xcprivacy` for collected data and required-reason APIs, including behavior from
  third-party SDKs.
- Reconcile App Store privacy details with actual app/server/SDK data flows on every release.
- Use only necessary permission strings and request access at the point of user intent.
- Test through TestFlight before production, including upgrade, account deletion, offline/background,
  photo permissions, Dynamic Type, VoiceOver, Voice Control, and reduced motion.
- Track icons, launch assets, screenshots, support/privacy URLs, review notes, accessibility claims, and
  SDK privacy/signature requirements in the release checklist.

Native watch, BLE, sensor fusion, and acoustic/CV capture remain roadmap items until explicit product
triggers are met.
