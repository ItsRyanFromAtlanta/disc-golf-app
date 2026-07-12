# iOS and Mobile Readiness

The current product remains PWA-first. Add Capacitor only after Phase A field flows are stable and a
native capability or store-distribution need justifies the maintenance surface.

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
