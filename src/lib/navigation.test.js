import { describe, it, expect } from 'vitest'
import { resolveActiveTab } from './navigation'

const TABS = [
  { to: '/practice', label: 'Play' },
  { to: '/bag', label: 'Bags' },
  { to: '/practice/stats', label: 'Stats' },
  { to: '/profile', label: 'Pro' },
]

describe('resolveActiveTab', () => {
  it('matches the exact tab path', () => {
    expect(resolveActiveTab(TABS, '/bag')).toEqual(TABS[1])
  })

  it('matches a plain nested route to its parent tab', () => {
    expect(resolveActiveTab(TABS, '/practice/freeform')).toEqual(TABS[0])
  })

  it('prefers the more specific nested tab over its broader ancestor', () => {
    expect(resolveActiveTab(TABS, '/practice/stats')).toEqual(TABS[2])
    expect(resolveActiveTab(TABS, '/practice/stats/detail')).toEqual(TABS[2])
  })

  it('returns null when nothing matches', () => {
    expect(resolveActiveTab(TABS, '/login')).toBeNull()
  })
})
