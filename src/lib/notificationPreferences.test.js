import { describe, expect, it } from 'vitest'
import { isOptionalNotificationEnabled, isValidIanaTimezone, preferenceMap } from './notificationPreferences'

describe('notification preferences', () => {
  it('defaults missing categories on and respects an explicit opt-out', () => {
    const rows = [{ category: 'activity', optional_enabled: false }]
    expect(isOptionalNotificationEnabled(rows, 'activity')).toBe(false)
    expect(isOptionalNotificationEnabled(rows, 'weekly_report')).toBe(true)
    expect(preferenceMap(rows).get('activity')).toBe(false)
  })

  it('validates reporting timezones as IANA identifiers', () => {
    expect(isValidIanaTimezone('America/New_York')).toBe(true)
    expect(isValidIanaTimezone('Not/A_Timezone')).toBe(false)
  })
})
