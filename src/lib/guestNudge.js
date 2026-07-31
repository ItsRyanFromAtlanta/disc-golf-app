import { resolveRouteMetadata, SHELL_TYPES } from './routeMetadata'

// D-10: a guest's conversion mechanism (AuthContext's convertGuestWithOtp /
// verifyGuestConversion / linkGuestWithOAuth, and AuthPage's `isGuest`
// branch) was complete but unreachable — nothing anywhere navigated a
// signed-in guest to `/login`, so it only worked if a user typed the URL by
// hand. `ProtectedRoute` wraps every authenticated screen in the app —
// directly for `/onboarding`, and via AppShell for everything else
// (AppShell.jsx:87) — so it is the one place a persistent, low-friction
// affordance reaches a guest regardless of which screen they're on, without
// adding a bespoke entry point to any individual screen.
//
// Pure, and kept out of ProtectedRoute.jsx itself (rather than exported
// alongside the component), for the same Fast-Refresh reason `useAuth` was
// split out of `AuthContext.jsx`: mixing a component export with a
// function export in one module degrades Fast Refresh for every consumer.
//
// A guest sees the nudge everywhere except an ACTIVE-shell (live capture)
// route — the same carve-out `PwaUpdatePrompt` already makes for the same
// reason: an unrelated prompt has no business appearing over a live capture
// screen. A route this table doesn't recognize fails open (shows the
// nudge) rather than silently losing the affordance.
export function shouldShowGuestNudge(isGuest, pathname) {
  if (!isGuest) return false
  return resolveRouteMetadata(pathname)?.shell !== SHELL_TYPES.ACTIVE
}
