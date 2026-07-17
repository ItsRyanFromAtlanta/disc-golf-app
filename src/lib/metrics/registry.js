import { ACTIVITY_SOURCES, ACTIVITY_STATES } from '../activityLifecycle'

export const METRIC_REGISTRY_VERSION = 1

export const METRIC_CAPTURE_REQUIREMENTS = Object.freeze({
  SUMMARY_ADEQUATE: 'summary_adequate',
  ORDERED_EVENTS_REQUIRED: 'ordered_events_required',
})

const PRACTICE_SOURCES = Object.freeze([
  ACTIVITY_SOURCES.LIVE_CAPTURE,
  ACTIVITY_SOURCES.BATCH_ENTRY,
  ACTIVITY_SOURCES.MANUAL_ENTRY,
  ACTIVITY_SOURCES.MANUAL_CORRECTION,
  ACTIVITY_SOURCES.UDISC_IMPORT,
  ACTIVITY_SOURCES.SYSTEM_INFERENCE,
  ACTIVITY_SOURCES.SENSOR,
])

export const METRIC_DEFINITIONS = Object.freeze({
  'practice.volume': Object.freeze({
    key: 'practice.volume',
    version: 1,
    group: 'activity_volume',
    subjects: Object.freeze(['player', 'routine', 'session']),
    acceptableSources: PRACTICE_SOURCES,
    windows: Object.freeze(['week', 'month', 'lifetime']),
    minimumSamples: 1,
    confidence: 'none',
    exclusions: Object.freeze(['draft', 'active', 'paused', 'hidden', 'no_meaningful_fact']),
    format: 'integer_putts',
    requiredInputs: Object.freeze(['makes', 'attempts', 'occurred_at']),
    captureRequirement: METRIC_CAPTURE_REQUIREMENTS.SUMMARY_ADEQUATE,
  }),
  'putting.make_pct': Object.freeze({
    key: 'putting.make_pct',
    version: 1,
    group: 'putting',
    subjects: Object.freeze(['player', 'routine', 'session']),
    acceptableSources: PRACTICE_SOURCES,
    windows: Object.freeze(['session', '14_day_decay', 'lifetime']),
    minimumSamples: 1,
    confidence: 'wilson_below_30',
    exclusions: Object.freeze(['draft', 'active', 'paused', 'hidden', 'no_meaningful_fact']),
    format: 'percentage',
    requiredInputs: Object.freeze(['makes', 'attempts', 'occurred_at']),
    captureRequirement: METRIC_CAPTURE_REQUIREMENTS.SUMMARY_ADEQUATE,
  }),
  'putting.fatigue_curve': Object.freeze({
    key: 'putting.fatigue_curve',
    version: 1,
    group: 'fatigue',
    subjects: Object.freeze(['player', 'routine']),
    acceptableSources: PRACTICE_SOURCES,
    windows: Object.freeze(['lifetime']),
    minimumSamples: 1,
    confidence: 'wilson_below_30',
    exclusions: Object.freeze(['draft', 'active', 'paused', 'hidden', 'no_meaningful_fact']),
    format: 'percentage_by_set_order',
    requiredInputs: Object.freeze(['set_order', 'makes', 'attempts']),
    captureRequirement: METRIC_CAPTURE_REQUIREMENTS.SUMMARY_ADEQUATE,
  }),
  'putting.pressure_differential': Object.freeze({
    key: 'putting.pressure_differential',
    version: 1,
    group: 'pressure',
    subjects: Object.freeze(['player', 'routine']),
    acceptableSources: PRACTICE_SOURCES,
    windows: Object.freeze(['lifetime']),
    minimumSamples: 1,
    confidence: 'wilson_below_30',
    exclusions: Object.freeze(['draft', 'active', 'paused', 'hidden', 'no_meaningful_fact']),
    format: 'percentage_point_delta',
    requiredInputs: Object.freeze(['distance', 'makes', 'attempts', 'pressure_putt_made']),
    captureRequirement: METRIC_CAPTURE_REQUIREMENTS.SUMMARY_ADEQUATE,
  }),
  'putting.miss_tendency': Object.freeze({
    key: 'putting.miss_tendency',
    version: 1,
    group: 'putting',
    subjects: Object.freeze(['player', 'physical_disc', 'session']),
    acceptableSources: Object.freeze([
      ACTIVITY_SOURCES.LIVE_CAPTURE,
      ACTIVITY_SOURCES.SENSOR,
    ]),
    windows: Object.freeze(['session', '30_day', 'lifetime']),
    minimumSamples: 3,
    confidence: 'minimum_pattern_threshold',
    exclusions: Object.freeze(['draft', 'active', 'paused', 'hidden', 'no_meaningful_fact']),
    format: 'miss_zone_distribution',
    requiredInputs: Object.freeze(['sequence', 'outcome', 'miss_zone', 'distance_ft', 'putter_disc_id']),
    captureRequirement: METRIC_CAPTURE_REQUIREMENTS.ORDERED_EVENTS_REQUIRED,
  }),
})

export function metricDefinition(key) {
  return METRIC_DEFINITIONS[key] ?? null
}

export function isMetricEligibleActivity(activity) {
  if (!activity || activity.hidden_at || !activity.has_meaningful_fact) return false
  return [ACTIVITY_STATES.COMPLETED, ACTIVITY_STATES.INCOMPLETE].includes(activity.state)
}

export function filterMetricEligibleActivities(activities) {
  return activities.filter(isMetricEligibleActivity)
}

export function sourceIsAccepted(metricKey, source) {
  const definition = metricDefinition(metricKey)
  return Boolean(definition?.acceptableSources.includes(source))
}

export function summariesAreAdequate(metricKey) {
  return metricDefinition(metricKey)?.captureRequirement === METRIC_CAPTURE_REQUIREMENTS.SUMMARY_ADEQUATE
}
