export const TAB_PRESS_ACTIONS = Object.freeze({
  NAVIGATE: 'navigate',
  SCROLL_TO_TOP: 'scroll-to-top',
  RETURN_TO_ROOT: 'return-to-root',
})

// Keeps the tap behavior independent of React and DOM scroll APIs. A second
// current-tab tap after requesting a top scroll returns to the section root,
// even if smooth scrolling has not fully settled yet.
export function resolveTabPressAction({ isTargetActive, isAtTop, hasRequestedTop }) {
  if (!isTargetActive) return TAB_PRESS_ACTIONS.NAVIGATE
  if (hasRequestedTop) return TAB_PRESS_ACTIONS.RETURN_TO_ROOT
  if (!isAtTop) return TAB_PRESS_ACTIONS.SCROLL_TO_TOP
  return TAB_PRESS_ACTIONS.RETURN_TO_ROOT
}
