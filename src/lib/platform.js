// Platform and display-mode detection.
//
// Every function takes its inputs explicitly so the decision logic stays pure
// and unit-testable in this repo's no-jsdom vitest setup. The thin browser
// wrappers at the bottom are the only parts that touch globals.

// iOS reports itself in a few shapes: classic iPhone/iPad/iPod user agents,
// and iPadOS 13+ which claims to be desktop Safari but reports touch points.
export function isIosLike({ userAgent = '', platform = '', maxTouchPoints = 0 } = {}) {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true
  // iPadOS desktop-mode: Macintosh UA with a touch screen.
  return platform === 'MacIntel' && maxTouchPoints > 1
}

// True when the app is running from a home-screen icon rather than a browser
// tab. iOS exposes the legacy `navigator.standalone`; everyone else uses the
// display-mode media query.
export function isStandaloneDisplay({ displayModeStandalone = false, navigatorStandalone = false } = {}) {
  return Boolean(displayModeStandalone || navigatorStandalone)
}

// An installed iOS PWA cannot reliably complete a third-party OAuth redirect:
// the provider hand-off leaves the standalone context, and iOS commonly
// returns the callback in Safari instead, where the newly-created session is
// invisible to the app. The in-app email code flow has no such hand-off, so
// it is the dependable path there.
export function oauthRedirectLeavesApp({ ios = false, standalone = false } = {}) {
  return ios && standalone
}

export function readPlatformContext(nav = globalThis.navigator, win = globalThis.window) {
  const userAgent = nav?.userAgent ?? ''
  const platform = nav?.platform ?? ''
  const maxTouchPoints = nav?.maxTouchPoints ?? 0
  const navigatorStandalone = nav?.standalone === true
  const displayModeStandalone =
    typeof win?.matchMedia === 'function' && win.matchMedia('(display-mode: standalone)').matches

  const ios = isIosLike({ userAgent, platform, maxTouchPoints })
  const standalone = isStandaloneDisplay({ displayModeStandalone, navigatorStandalone })
  return { ios, standalone, oauthLeavesApp: oauthRedirectLeavesApp({ ios, standalone }) }
}
