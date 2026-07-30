import { describe, expect, it } from 'vitest'
import {
  CONDITION_SPLIT_MIN_ROUNDS,
  conditionLedger,
  conditionSplits,
} from './roundConditions'

const HOLES = [
  { id: 'hole-1', par: 3 },
  { id: 'hole-2', par: 4 },
  { id: 'hole-3', par: 3 },
]

// A completed, fully-scored round on one shared layout. `over` shifts every
// hole, so the round's relative-to-par is exactly `over * 3`.
function round(id, { condition, over = 0, ...overrides } = {}) {
  return {
    id,
    status: 'completed',
    layout_id: 'layout-1',
    layout: { id: 'layout-1', name: 'Main' },
    course: { id: 'course-1', name: 'Oak Grove' },
    weather_condition: condition ?? null,
    holes: HOLES,
    round_holes: HOLES.map((hole) => ({ hole_id: hole.id, score: hole.par + over })),
    ...overrides,
  }
}

describe('conditionLedger', () => {
  it('counts recorded conditions in vocabulary order', () => {
    const ledger = conditionLedger([
      round('a', { condition: 'rain' }),
      round('b', { condition: 'clear' }),
      round('c', { condition: 'rain' }),
    ])
    expect(ledger.conditions).toEqual([
      { condition: 'clear', rounds: 1 },
      { condition: 'rain', rounds: 2 },
    ])
  })

  // Weather is optional and always will be, so a reader has to be able to see
  // how much of their history the ledger actually covers.
  it('reports how many rounds recorded nothing', () => {
    const ledger = conditionLedger([
      round('a', { condition: 'headwind' }),
      round('b'),
      round('c', { weather_condition: 'not-a-condition' }),
    ])
    expect(ledger.recorded).toBe(1)
    expect(ledger.unrecorded).toBe(2)
  })

  it('is empty for no rounds', () => {
    expect(conditionLedger()).toEqual({ conditions: [], recorded: 0, unrecorded: 0 })
  })

  // A round in progress still counts in the ledger — the ledger records that
  // conditions were logged, which is true regardless of whether the round is
  // finished. Only the split cares about comparability.
  it('counts an in-progress round', () => {
    const ledger = conditionLedger([round('a', { condition: 'rain', status: 'in_progress' })])
    expect(ledger.recorded).toBe(1)
  })
})

describe('conditionSplits', () => {
  function repeat(count, prefix, options) {
    return Array.from({ length: count }, (_, index) => round(`${prefix}-${index}`, options))
  }

  it('averages relative-to-par per condition on one layout', () => {
    const splits = conditionSplits([
      ...repeat(3, 'clear', { condition: 'clear', over: 1 }),
      ...repeat(3, 'rain', { condition: 'rain', over: 2 }),
    ])
    expect(splits).toHaveLength(1)
    expect(splits[0].layoutId).toBe('layout-1')
    expect(splits[0].courseName).toBe('Oak Grove')
    expect(splits[0].conditions).toEqual([
      { condition: 'clear', rounds: 3, averageRelativeToPar: 3 },
      { condition: 'rain', rounds: 3, averageRelativeToPar: 6 },
    ])
  })

  it('withholds a condition below the sample floor', () => {
    const splits = conditionSplits([
      ...repeat(CONDITION_SPLIT_MIN_ROUNDS, 'clear', { condition: 'clear' }),
      ...repeat(CONDITION_SPLIT_MIN_ROUNDS - 1, 'rain', { condition: 'rain', over: 2 }),
    ])
    // One surviving condition is not a split, so the whole layout is withheld.
    expect(splits).toEqual([])
  })

  it('withholds a layout with only one condition, however many rounds', () => {
    expect(conditionSplits(repeat(20, 'clear', { condition: 'clear' }))).toEqual([])
  })

  // This is the reason the split is per-layout at all: averaged together, these
  // two courses would say "rain costs you 12 strokes" when the truth is that
  // the rainy course is longer.
  it('never pools two layouts into one comparison', () => {
    const otherLayout = {
      layout_id: 'layout-2',
      layout: { id: 'layout-2', name: 'Back' },
      course: { id: 'course-2', name: 'Pine Ridge' },
    }
    const splits = conditionSplits([
      ...repeat(3, 'clear', { condition: 'clear', over: 1 }),
      ...repeat(3, 'rain', { condition: 'rain', over: 4, ...otherLayout }),
    ])
    expect(splits).toEqual([])
  })

  it('reports each qualifying layout separately', () => {
    const second = {
      layout_id: 'layout-2',
      layout: { id: 'layout-2', name: 'Back' },
      course: { id: 'course-2', name: 'Pine Ridge' },
    }
    const splits = conditionSplits([
      ...repeat(3, 'a-clear', { condition: 'clear', over: 1 }),
      ...repeat(3, 'a-rain', { condition: 'rain', over: 2 }),
      ...repeat(3, 'b-clear', { condition: 'clear', over: 0, ...second }),
      ...repeat(3, 'b-wind', { condition: 'headwind', over: 3, ...second }),
    ])
    expect(splits.map((layout) => layout.courseName)).toEqual(['Oak Grove', 'Pine Ridge'])
    expect(splits[1].conditions.map((entry) => entry.condition)).toEqual(['clear', 'headwind'])
    expect(splits[1].conditions.map((entry) => entry.averageRelativeToPar)).toEqual([0, 9])
  })

  it('ignores rounds that are still in progress', () => {
    const splits = conditionSplits([
      ...repeat(3, 'clear', { condition: 'clear' }),
      ...repeat(3, 'rain', { condition: 'rain', status: 'in_progress' }),
    ])
    expect(splits).toEqual([])
  })

  // A completed card with holes left blank has a relative-to-par that reads as a
  // brilliant round. Averaging it in would be fiction.
  it('ignores a completed round with an unscored hole', () => {
    const partial = round('partial', { condition: 'rain' })
    partial.round_holes = partial.round_holes.slice(0, 2)
    const splits = conditionSplits([
      ...repeat(3, 'clear', { condition: 'clear' }),
      ...repeat(2, 'rain', { condition: 'rain', over: 2 }),
      partial,
    ])
    expect(splits).toEqual([])
  })

  it('ignores rounds with no recorded condition', () => {
    const splits = conditionSplits([...repeat(3, 'clear', { condition: 'clear' }), ...repeat(5, 'none')])
    expect(splits).toEqual([])
  })

  it('is empty for no rounds', () => {
    expect(conditionSplits()).toEqual([])
  })

  it('honours a caller-supplied floor', () => {
    const splits = conditionSplits(
      [...repeat(2, 'clear', { condition: 'clear', over: 1 }), ...repeat(2, 'rain', { condition: 'rain', over: 2 })],
      { minRounds: 2 },
    )
    expect(splits).toHaveLength(1)
    expect(splits[0].conditions).toHaveLength(2)
  })
})
