# 0003 — Native GPS and camera capability timeline
Status: proposed
Date: 2026-07-29

## Context

`AGENTS.md` § Not yet decided lists "native GPS/camera integration timeline (Capacitor addition)" as
open. `docs/mobile/IOS_READINESS.md` already states a position — "the current product remains PWA-first;
add Capacitor only after Phase A field flows are stable and a native capability or store-distribution
need justifies the maintenance surface" — but states it as guidance rather than as a decision with a
trigger, so it does not close the question.

What has changed since the question was filed: the 2026-07-27 iOS audit found six PWA defects and fixed
all six without Capacitor (wake lock, audio session, update prompt, storage persistence, OAuth redirect
guidance, in-app account deletion). That is real evidence that the PWA path still has headroom.

What pulls the other way: in-app account deletion exists because Guideline 5.1.1(v) makes it a hard App
Review rejection — the project is already reasoning about store distribution. Lost & Found takes optional
GPS, and `DiscPhotoManager` handles photos, so both capabilities are in use through web APIs today.

The blocking item is unrelated to native: migration `20260727120000_phase_e_account_deletion.sql` is
written but not applied, leaving account deletion a shipped-but-broken surface
(`docs/development/CURRENT_WORK.md` § Open follow-ups).

## Decision

**Recommended, not yet accepted.** Option C: stay PWA-first and convert the existing guidance into an
explicit trigger list, rather than committing to any date.

## Consequences

If accepted as recommended:

- No Capacitor work is scheduled. `ios/` and `android/` shells stay unbuilt.
- Screen documents describe web APIs (`navigator.geolocation`, file input, `navigator.vibrate`) as the
  capability layer, and note where each degrades — vibration no-ops on iOS Safari, for instance.
- The trigger list becomes the thing to check at each phase boundary, so the question stops recurring.
- `AGENTS.md` § Not yet decided loses its third entry.

Proposed triggers, any one of which reopens this ADR: a required capability with no adequate web API;
a decision to distribute through the App Store; the Track 4 sensor-mode platform decision landing; or
field testing showing PWA-specific failures that cannot be fixed in the web layer.

## Alternatives considered

**A. Add Capacitor after Phase E.** A date, not a reason. Rejected: `IOS_READINESS.md` is explicit that
the shells should follow a justified need, and a calendar commitment invites the maintenance surface
before anything requires it.

**B. Add Capacitor now, alongside E2.** Rejected: it widens blast radius during a phase whose stated
goal is hardening existing routes, and the pre-native checklist in `IOS_READINESS.md` — stabilized
route/deep-link, auth redirect, offline/outbox, background/resume, camera/photo, and notification
contracts — is not yet satisfied.

**C. PWA-first with explicit triggers (recommended).** Converts existing guidance into a decision with
falsifiable conditions. Costs nothing and stops the question from being re-asked every phase.

## Supersedes / superseded by

None. Closes the third entry under `AGENTS.md` § Not yet decided when accepted. Does not supersede
`docs/mobile/IOS_READINESS.md`, which remains the operational detail for when a trigger fires.
