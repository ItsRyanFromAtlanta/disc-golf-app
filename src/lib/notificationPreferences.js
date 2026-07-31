// `produced` records whether anything in the app actually emits this category
// today. Found while fixing DEFECT_REGISTER D-11, which reported that the weekly
// report has no producer — the same is true of five more of these.
// `notificationProducers.js` emits exactly two things: `activity_review` (the
// ACTIVITY category) and `sync_review` (the SYNC category, which is critical and
// therefore not an optional preference at all). Every other row below is a
// switch wired to nothing.
//
// The preferences are NOT removed, for two reasons: the stored rows are the
// user's expressed intent and deleting them destroys it, and whether these
// notifications should exist is a product decision rather than a defect. What is
// a defect is a settings screen silently promising control it does not have — so
// the flag exists to let the UI say so, and to fail loudly here the moment a
// producer lands and someone forgets to flip it.
export const NOTIFICATION_PREFERENCE_CATEGORIES = Object.freeze([
  { id: 'activity', label: 'Activity review', description: 'Reminders to review incomplete activities.', produced: true },
  { id: 'lost_disc', label: 'Lost disc', description: 'Recovery-case updates and follow-up reminders.', produced: false },
  { id: 'weekly_report', label: 'Weekly report', description: 'Your deterministic Monday–Sunday recap.', produced: false },
  { id: 'equipment', label: 'Equipment', description: 'Wear, odometer, and bag maintenance prompts.', produced: false },
  { id: 'community_review', label: 'Community review', description: 'Updates on catalog contributions.', produced: false },
  { id: 'achievement', label: 'Achievements', description: 'Badge and milestone celebrations.', produced: false },
  { id: 'coaching', label: 'Coaching', description: 'Pattern-supported practice suggestions.', produced: false },
])

// The categories a user can currently be notified about at all. Kept as a
// derived list rather than a second hand-maintained array so the two cannot
// disagree.
export const PRODUCED_NOTIFICATION_CATEGORIES = Object.freeze(
  NOTIFICATION_PREFERENCE_CATEGORIES.filter((category) => category.produced).map((category) => category.id),
)

export function preferenceMap(rows = []) {
  return new Map(rows.map((row) => [row.category, row.optional_enabled]))
}

export function isOptionalNotificationEnabled(rows, category) {
  return preferenceMap(rows).get(category) ?? true
}

export function isValidIanaTimezone(value) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}
