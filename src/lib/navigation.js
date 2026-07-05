// Longest-prefix match: resolves which nav tab should show as active for a
// given pathname. Needed because a nested route (STATS at /practice/stats)
// lives under another tab's own path prefix (PLAY at /practice) — a naive
// "does pathname start with this tab's path" check would match BOTH tabs
// simultaneously; the more specific (longest) match wins.
export function resolveActiveTab(tabs, pathname) {
  const matches = tabs.filter((tab) => pathname === tab.to || pathname.startsWith(`${tab.to}/`))
  if (matches.length === 0) return null
  return matches.reduce((best, tab) => (tab.to.length > best.to.length ? tab : best))
}
