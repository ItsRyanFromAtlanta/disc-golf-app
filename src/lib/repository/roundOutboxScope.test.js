import { describe, expect, it } from 'vitest'
import { isRoundOutboxWeatherOnly } from './roundOutboxScope'

// The regression this file guards: `roundWeatherFields()` sends all three
// weather columns in one PATCH, so during the round-weather deploy-lag
// window every weather edit queues as a `rounds` update whose fields are a
// subset of `{weather_condition, wind_mph, weather_summary}`. That must read
// as "weather is queued", never as "the round is unsynced" — those are
// different claims and RoundScorecardPage's toolbar label depends on this
// function to tell them apart.
function weatherEntry(fields) {
  return { table: 'rounds', op: 'update', payload: { roundId: 'round-1', fields } }
}

function holeEntry() {
  return {
    table: 'round_holes',
    op: 'upsert',
    payload: { round_id: 'round-1', hole_id: 'hole-1', score: 3 },
  }
}

describe('isRoundOutboxWeatherOnly', () => {
  it('is false when nothing is queued', () => {
    expect(isRoundOutboxWeatherOnly([])).toBe(false)
  })

  it('is true when the only queued entry is a full weather patch', () => {
    expect(
      isRoundOutboxWeatherOnly([weatherEntry({ weather_condition: 'rain', wind_mph: 12, weather_summary: null })]),
    ).toBe(true)
  })

  it('is true for a free-text-only weather edit, which rides along with the structured columns', () => {
    expect(
      isRoundOutboxWeatherOnly([
        weatherEntry({ weather_condition: null, wind_mph: null, weather_summary: 'gusting after the turn' }),
      ]),
    ).toBe(true)
  })

  it('is true across multiple queued weather edits for the same round', () => {
    expect(
      isRoundOutboxWeatherOnly([
        weatherEntry({ weather_condition: 'headwind', wind_mph: 8, weather_summary: null }),
        weatherEntry({ weather_summary: 'now gusting' }),
      ]),
    ).toBe(true)
  })

  it('is false once a score for the round is also queued', () => {
    expect(
      isRoundOutboxWeatherOnly([
        weatherEntry({ weather_condition: 'rain', wind_mph: 12, weather_summary: null }),
        holeEntry(),
      ]),
    ).toBe(false)
  })

  it('is false for a rounds update that carries a non-weather field, even mixed with weather ones', () => {
    expect(
      isRoundOutboxWeatherOnly([weatherEntry({ weather_condition: 'clear', total_score: 54 })]),
    ).toBe(false)
  })

  it('is false for a rounds create entry', () => {
    expect(
      isRoundOutboxWeatherOnly([
        { table: 'rounds', op: 'create', payload: { id: 'round-1', weather_condition: 'rain' } },
      ]),
    ).toBe(false)
  })

  it('ignores an empty fields object rather than calling it weather-only', () => {
    expect(isRoundOutboxWeatherOnly([weatherEntry({})])).toBe(false)
  })
})
