import { describe, expect, it } from 'vitest'
import { ACTIVITY_SOURCES, ACTIVITY_STATES } from '../activityLifecycle'
import {
  METRIC_CAPTURE_REQUIREMENTS,
  METRIC_DEFINITIONS,
  METRIC_REGISTRY_VERSION,
  filterMetricEligibleActivities,
  isMetricEligibleActivity,
  sourceIsAccepted,
  summariesAreAdequate,
} from './registry'

function activity(overrides = {}) {
  return {
    id: 'activity-1',
    state: ACTIVITY_STATES.COMPLETED,
    hidden_at: null,
    has_meaningful_fact: true,
    ...overrides,
  }
}

describe('metric registry', () => {
  it('version-controls every metric definition with the required contract fields', () => {
    expect(METRIC_REGISTRY_VERSION).toBe(1)
    for (const [key, definition] of Object.entries(METRIC_DEFINITIONS)) {
      expect(definition).toMatchObject({ key, version: 1, minimumSamples: expect.any(Number) })
      expect(definition.subjects.length).toBeGreaterThan(0)
      expect(definition.windows.length).toBeGreaterThan(0)
      expect(definition.requiredInputs.length).toBeGreaterThan(0)
      expect(definition.exclusions).toContain('hidden')
    }
  })

  it('includes meaningful completed and incomplete facts but excludes hidden/current/draft activities', () => {
    expect(isMetricEligibleActivity(activity())).toBe(true)
    expect(isMetricEligibleActivity(activity({ state: ACTIVITY_STATES.INCOMPLETE }))).toBe(true)
    expect(isMetricEligibleActivity(activity({ hidden_at: '2026-07-12T12:00:00.000Z' }))).toBe(false)
    expect(isMetricEligibleActivity(activity({ state: ACTIVITY_STATES.ACTIVE }))).toBe(false)
    expect(isMetricEligibleActivity(activity({ state: ACTIVITY_STATES.DRAFT }))).toBe(false)
    expect(isMetricEligibleActivity(activity({ has_meaningful_fact: false }))).toBe(false)
  })

  it('filters a mixed history without excluding valid incomplete practice facts', () => {
    expect(
      filterMetricEligibleActivities([
        activity({ id: 'completed' }),
        activity({ id: 'incomplete', state: ACTIVITY_STATES.INCOMPLETE }),
        activity({ id: 'hidden', hidden_at: '2026-07-12T12:00:00.000Z' }),
      ]).map((row) => row.id),
    ).toEqual(['completed', 'incomplete'])
  })

  it('keeps summary-safe and ordered-event metrics explicit', () => {
    expect(summariesAreAdequate('putting.make_pct')).toBe(true)
    expect(summariesAreAdequate('putting.miss_tendency')).toBe(false)
    expect(METRIC_DEFINITIONS['putting.miss_tendency'].captureRequirement).toBe(
      METRIC_CAPTURE_REQUIREMENTS.ORDERED_EVENTS_REQUIRED,
    )
  })

  it('rejects batch summaries for metrics requiring real ordered events', () => {
    expect(sourceIsAccepted('putting.make_pct', ACTIVITY_SOURCES.BATCH_ENTRY)).toBe(true)
    expect(sourceIsAccepted('putting.miss_tendency', ACTIVITY_SOURCES.BATCH_ENTRY)).toBe(false)
    expect(sourceIsAccepted('putting.miss_tendency', ACTIVITY_SOURCES.LIVE_CAPTURE)).toBe(true)
  })
})
