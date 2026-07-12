import { describe, expect, it } from 'vitest'
import { TAB_PRESS_ACTIONS, resolveTabPressAction } from './tabNavigation'

describe('resolveTabPressAction', () => {
  it('navigates when a different section is tapped', () => {
    expect(resolveTabPressAction({ isTargetActive: false, isAtTop: false, hasRequestedTop: false })).toBe(
      TAB_PRESS_ACTIONS.NAVIGATE,
    )
  })

  it('scrolls the current section to top before returning to its root', () => {
    expect(resolveTabPressAction({ isTargetActive: true, isAtTop: false, hasRequestedTop: false })).toBe(
      TAB_PRESS_ACTIONS.SCROLL_TO_TOP,
    )
  })

  it('returns to root when the current section is already at the top', () => {
    expect(resolveTabPressAction({ isTargetActive: true, isAtTop: true, hasRequestedTop: false })).toBe(
      TAB_PRESS_ACTIONS.RETURN_TO_ROOT,
    )
  })

  it('returns to root on an immediate second tap after a top-scroll request', () => {
    expect(resolveTabPressAction({ isTargetActive: true, isAtTop: false, hasRequestedTop: true })).toBe(
      TAB_PRESS_ACTIONS.RETURN_TO_ROOT,
    )
  })
})
