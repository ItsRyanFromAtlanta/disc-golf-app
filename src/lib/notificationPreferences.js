export const NOTIFICATION_PREFERENCE_CATEGORIES = Object.freeze([
  { id: 'activity', label: 'Activity review', description: 'Reminders to review incomplete activities.' },
  { id: 'lost_disc', label: 'Lost disc', description: 'Recovery-case updates and follow-up reminders.' },
  { id: 'weekly_report', label: 'Weekly report', description: 'Your deterministic Monday–Sunday recap.' },
  { id: 'equipment', label: 'Equipment', description: 'Wear, odometer, and bag maintenance prompts.' },
  { id: 'community_review', label: 'Community review', description: 'Updates on catalog contributions.' },
  { id: 'achievement', label: 'Achievements', description: 'Badge and milestone celebrations.' },
  { id: 'coaching', label: 'Coaching', description: 'Pattern-supported practice suggestions.' },
])

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
