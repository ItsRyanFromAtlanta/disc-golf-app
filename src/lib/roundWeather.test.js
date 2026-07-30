import { describe, expect, it } from 'vitest'
import {
  ROUND_WEATHER_CONDITIONS,
  conditionLabel,
  describeRoundWeather,
  hasRoundWeather,
  normalizeCondition,
  normalizeSummary,
  normalizeWindMph,
  readRoundWeather,
  roundWeatherFields,
} from './roundWeather'

describe('round weather vocabulary', () => {
  // The whole point of this module is that rounds and practice sessions record
  // the same fact the same way. If someone widens one list without the other,
  // this fails before the CHECK constraint does.
  it('matches the five values D2 constrains the practice parents to', () => {
    expect(ROUND_WEATHER_CONDITIONS).toEqual(['clear', 'headwind', 'tailwind', 'crosswind', 'rain'])
  })

  it('accepts the vocabulary case-insensitively and rejects everything else', () => {
    expect(normalizeCondition('rain')).toBe('rain')
    expect(normalizeCondition('  Headwind ')).toBe('headwind')
    expect(normalizeCondition('sleet')).toBeNull()
    expect(normalizeCondition('')).toBeNull()
    expect(normalizeCondition(null)).toBeNull()
    expect(normalizeCondition(3)).toBeNull()
  })

  it('labels each condition for display', () => {
    expect(conditionLabel('crosswind')).toBe('Crosswind')
    expect(conditionLabel('nonsense')).toBeNull()
  })
})

describe('normalizeWindMph', () => {
  it('keeps whole non-negative speeds', () => {
    expect(normalizeWindMph(12)).toBe(12)
    expect(normalizeWindMph('12')).toBe(12)
    expect(normalizeWindMph(0)).toBe(0)
  })

  it('rounds fractional readings to whole mph', () => {
    expect(normalizeWindMph(12.4)).toBe(12)
    expect(normalizeWindMph(12.6)).toBe(13)
  })

  // A negative or unparseable value would fail the DB CHECK, and a failed write
  // goes to the outbox where 23514 classifies as permanent. Rejecting it here
  // means a typo costs nothing instead of poisoning a queued round.
  it('discards values the CHECK constraint would reject', () => {
    expect(normalizeWindMph(-1)).toBeNull()
    expect(normalizeWindMph('gusty')).toBeNull()
    expect(normalizeWindMph('')).toBeNull()
    expect(normalizeWindMph(null)).toBeNull()
    expect(normalizeWindMph(undefined)).toBeNull()
    expect(normalizeWindMph(true)).toBeNull()
    expect(normalizeWindMph(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('normalizeSummary', () => {
  it('trims and treats blank as unrecorded', () => {
    expect(normalizeSummary('  gusting hard on the back nine ')).toBe('gusting hard on the back nine')
    expect(normalizeSummary('   ')).toBeNull()
    expect(normalizeSummary(null)).toBeNull()
  })
})

describe('roundWeatherFields', () => {
  it('produces exactly the three persisted columns', () => {
    expect(roundWeatherFields({ condition: 'headwind', windMph: 14, summary: 'into the wind out' })).toEqual({
      weather_condition: 'headwind',
      wind_mph: 14,
      weather_summary: 'into the wind out',
    })
  })

  it('reads the snake_case shape a round row or an import carries', () => {
    expect(roundWeatherFields({ weather_condition: 'rain', wind_mph: '8', weather_summary: 'steady' })).toEqual({
      weather_condition: 'rain',
      wind_mph: 8,
      weather_summary: 'steady',
    })
  })

  // The auto-capture seam: a provider observation mapped to our vocabulary goes
  // through this same function rather than getting its own write path.
  it('normalizes a provider-shaped observation through the same path', () => {
    expect(roundWeatherFields({ condition: 'Crosswind', windSpeedMph: 9.7 })).toEqual({
      weather_condition: 'crosswind',
      wind_mph: 10,
      weather_summary: null,
    })
  })

  it('drops wind for clear, which carries no direction to attribute it to', () => {
    expect(roundWeatherFields({ condition: 'clear', windMph: 18 }).wind_mph).toBeNull()
  })

  it('drops wind when the condition itself is unrecorded', () => {
    expect(roundWeatherFields({ windMph: 18 })).toEqual({
      weather_condition: null,
      wind_mph: null,
      weather_summary: null,
    })
  })

  it('keeps a free-text note without a condition, since weather_summary predates both columns', () => {
    expect(roundWeatherFields({ summary: 'humid' })).toEqual({
      weather_condition: null,
      wind_mph: null,
      weather_summary: 'humid',
    })
  })

  it('returns a full null patch for an empty input, so clearing weather actually clears it', () => {
    expect(roundWeatherFields()).toEqual({
      weather_condition: null,
      wind_mph: null,
      weather_summary: null,
    })
  })
})

describe('readRoundWeather', () => {
  it('reads a round row into the editable shape', () => {
    expect(readRoundWeather({ weather_condition: 'tailwind', wind_mph: 6, weather_summary: 'warm' })).toEqual({
      condition: 'tailwind',
      windMph: 6,
      summary: 'warm',
    })
  })

  // A round created before the migration landed has neither column.
  it('reads a row with no weather columns at all as unrecorded', () => {
    expect(readRoundWeather({ id: 'round-1' })).toEqual({ condition: null, windMph: null, summary: null })
    expect(readRoundWeather()).toEqual({ condition: null, windMph: null, summary: null })
  })
})

describe('hasRoundWeather', () => {
  it('is true for any recorded part and false for none', () => {
    expect(hasRoundWeather({ condition: 'rain' })).toBe(true)
    expect(hasRoundWeather({ windMph: 0 })).toBe(true)
    expect(hasRoundWeather({ summary: 'muggy' })).toBe(true)
    expect(hasRoundWeather({ condition: null, windMph: null, summary: null })).toBe(false)
    expect(hasRoundWeather()).toBe(false)
  })
})

describe('describeRoundWeather', () => {
  it('joins the recorded parts in reading order', () => {
    expect(describeRoundWeather({ condition: 'headwind', windMph: 14, summary: 'gusty' })).toBe(
      'Headwind · 14 mph wind · gusty',
    )
  })

  it('omits the parts that are not recorded', () => {
    expect(describeRoundWeather({ condition: 'clear' })).toBe('Clear')
    expect(describeRoundWeather({ windMph: 0 })).toBe('0 mph wind')
    expect(describeRoundWeather({ summary: 'muggy' })).toBe('muggy')
  })

  // Null, not "unspecified" — the caller decides whether to render a row at all.
  it('returns null when nothing was recorded', () => {
    expect(describeRoundWeather({})).toBeNull()
    expect(describeRoundWeather()).toBeNull()
  })
})
