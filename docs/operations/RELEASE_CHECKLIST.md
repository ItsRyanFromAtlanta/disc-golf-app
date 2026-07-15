# Release Checklist

## Every web/PWA release

- Scope and user-visible changes match the roadmap and changelog.
- Pull request review gates pass; no unrelated changes are bundled.
- Tests, lint, build, browser smoke tests, and `git diff --check` pass.
- Offline/resume and error paths are verified for affected flows.
- Schema changes have reviewed migration/rollback notes and RLS negative tests.
- Secrets, logs, fixtures, generated maps, and source maps contain no sensitive data.
- Documentation, `DEVLOG.md`, `CURRENT_WORK.md`, and backlog status are updated.
- Preview is smoke-tested before merging the protected production branch.

## Native candidate additions

- App identifier, signing, capabilities, icons, splash screens, permissions, deep links, and universal
  links are verified.
- Privacy manifest and third-party SDK manifests/signatures are valid; App Privacy details match actual
  collection and sharing.
- Accessibility declarations are evidence-backed.
- TestFlight/internal testing covers supported devices, upgrades, offline/background behavior, and
  account deletion.
- Store metadata, screenshots, support URL, privacy policy, age rating, export compliance, and review
  notes are complete.
