import { describe, expect, it } from 'vitest'
import { shouldShowGuestNudge } from './guestNudge'

// D-10 regression: `isGuest` used to have exactly one consumer (AuthPage
// itself) and nothing anywhere navigated a signed-in guest to `/login`, so
// the whole conversion mechanism in AuthContext was unreachable without
// editing the URL bar. This pins the rule that decides where the reachable
// affordance now shows up.
describe('shouldShowGuestNudge', () => {
  it('never shows for a non-guest, regardless of route', () => {
    expect(shouldShowGuestNudge(false, '/practice')).toBe(false)
    expect(shouldShowGuestNudge(false, '/practice/freeform')).toBe(false)
    expect(shouldShowGuestNudge(false, '/onboarding')).toBe(false)
  })

  it('shows for a guest on an ordinary (STANDARD-shell) route', () => {
    expect(shouldShowGuestNudge(true, '/practice')).toBe(true)
    expect(shouldShowGuestNudge(true, '/profile')).toBe(true)
    expect(shouldShowGuestNudge(true, '/bag')).toBe(true)
    expect(shouldShowGuestNudge(true, '/rounds/round-1')).toBe(true)
  })

  it('shows for a guest on the shell-less onboarding route, the first screen after signing in anonymously', () => {
    expect(shouldShowGuestNudge(true, '/onboarding')).toBe(true)
  })

  it('hides on an ACTIVE-shell live-capture route, the same carve-out PwaUpdatePrompt makes', () => {
    expect(shouldShowGuestNudge(true, '/practice/freeform')).toBe(false)
    expect(shouldShowGuestNudge(true, '/practice/regimens/reg-1/run')).toBe(false)
  })

  it('fails open — shows on a route with no metadata at all rather than silently losing the affordance', () => {
    expect(shouldShowGuestNudge(true, '/not-a-route')).toBe(true)
  })
})
