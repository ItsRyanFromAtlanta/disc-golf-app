// Round weather context — the round-side half of the weather concept D2 shipped
// for practice.
//
// There is deliberately only ONE weather vocabulary in this app. D2 constrained
// `putt_sessions.weather_condition` and `putting_regimen_runs.weather_condition`
// to these five values (`layer1_foundation_schema.sql`), the mid-session picker
// in `components/puttingCanvas/CanvasToolbar.jsx` offers exactly these five, and
// `20260730205654_phase_e_round_weather.sql` puts the same CHECK on `rounds`.
// Adding a sixth value means touching all three, which is the point: a round and
// a practice session played on the same windy afternoon must record the same
// fact the same way, or nothing can ever compare them.
export const ROUND_WEATHER_CONDITIONS = ['clear', 'headwind', 'tailwind', 'crosswind', 'rain']

const CONDITIONS = new Set(ROUND_WEATHER_CONDITIONS)

// `clear` means "no wind worth naming", so it carries no speed — the practice
// picker blanks the wind field on selecting it and this keeps the two surfaces
// from disagreeing about what a `clear` session with `wind_mph: 18` would mean.
const CONDITIONS_WITHOUT_WIND = new Set(['clear'])

export function normalizeCondition(value) {
  if (typeof value !== 'string') return null
  const condition = value.trim().toLowerCase()
  return CONDITIONS.has(condition) ? condition : null
}

// Whole mph, never negative. Anything else — a stray letter, an empty input, a
// negative typo — is "not recorded" rather than a value the CHECK would reject
// on arrival at the server, because a rejected write goes into the outbox and a
// 23514 classifies as permanent. Validating here means a bad keystroke costs
// nothing instead of poisoning a queued round.
export function normalizeWindMph(value) {
  if (value === '' || value == null || typeof value === 'boolean') return null
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return null
  return Math.round(number)
}

export function normalizeSummary(value) {
  if (typeof value !== 'string') return null
  return value.trim() || null
}

/**
 * The single normalizer every weather write goes through, and the seam a future
 * auto-capture provider plugs into.
 *
 * It accepts both the camelCase shape the UI holds and the snake_case shape a
 * round row (or an import, or a weather API response mapped to our vocabulary)
 * carries, and returns exactly the three columns to persist. Auto-capture, when
 * it is built, produces an observation and calls this — it does not get its own
 * write path, because a fetched condition and a typed one are the same fact and
 * must be equally correctable.
 */
export function roundWeatherFields(input = {}) {
  const condition = normalizeCondition(input.condition ?? input.weather_condition)
  const rawWind = input.windMph ?? input.wind_mph ?? input.windSpeedMph
  return {
    weather_condition: condition,
    // Wind is dropped, not preserved, when the condition cannot carry it.
    // Keeping a stale speed behind a `clear` reading would make the round claim
    // a wind it does not have the direction for.
    wind_mph: condition == null || CONDITIONS_WITHOUT_WIND.has(condition) ? null : normalizeWindMph(rawWind),
    weather_summary: normalizeSummary(input.summary ?? input.weather_summary),
  }
}

/** Reads the persisted columns off a round row into the shape the UI edits. */
export function readRoundWeather(round = {}) {
  return {
    condition: normalizeCondition(round.weather_condition),
    windMph: normalizeWindMph(round.wind_mph),
    summary: normalizeSummary(round.weather_summary),
  }
}

export function hasRoundWeather(weather = {}) {
  return Boolean(weather.condition || weather.windMph != null || weather.summary)
}

const CONDITION_LABELS = {
  clear: 'Clear',
  headwind: 'Headwind',
  tailwind: 'Tailwind',
  crosswind: 'Crosswind',
  rain: 'Rain',
}

export function conditionLabel(condition) {
  return CONDITION_LABELS[normalizeCondition(condition)] ?? null
}

/**
 * One line for a round's conditions, or null when nothing was recorded.
 *
 * Returns null rather than a placeholder string so callers can decide whether to
 * render a row at all — a round with no weather should show nothing, not
 * "Weather: unspecified".
 */
export function describeRoundWeather(weather = {}) {
  const parts = []
  const label = conditionLabel(weather.condition)
  if (label) parts.push(label)
  if (weather.windMph != null) parts.push(`${weather.windMph} mph wind`)
  if (weather.summary) parts.push(weather.summary)
  return parts.length ? parts.join(' · ') : null
}
