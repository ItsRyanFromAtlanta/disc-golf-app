import { describe, expect, it } from 'vitest'
import {
  COURSE_PREP_MIN_ROUNDS,
  DISC_CATEGORY_ORDER,
  HOLE_DISTANCE_BANDS,
  holeDistanceBand,
  holePrep,
  layoutBrief,
  lockerCoverage,
  priorityHoles,
} from './coursePrep'

const LAYOUT_ID = 'layout-1'

function hole(number, overrides = {}) {
  return {
    id: `hole-${number}`,
    layout_id: LAYOUT_ID,
    hole_number: number,
    par: 3,
    distance_feet: 300,
    tee_type: null,
    hazards: null,
    strategy_notes: null,
    ...overrides,
  }
}

function layout(holes, overrides = {}) {
  return { id: LAYOUT_ID, name: 'Main', holes, ...overrides }
}

/** A hydrated round in the shape `loadRound` returns. */
function round(id, holes, scores, overrides = {}) {
  return {
    id,
    layout_id: LAYOUT_ID,
    status: 'completed',
    holes,
    round_holes: holes.map((row, index) => ({
      id: `${id}-rh-${index}`,
      round_id: id,
      hole_id: row.id,
      score: scores[index] ?? null,
      disc_id: null,
      disc: null,
    })),
    ...overrides,
  }
}

describe('holeDistanceBand', () => {
  it('is null for anything that is not a recorded distance', () => {
    expect(holeDistanceBand(null)).toBeNull()
    expect(holeDistanceBand(undefined)).toBeNull()
    expect(holeDistanceBand('')).toBeNull()
    expect(holeDistanceBand('not a number')).toBeNull()
    expect(holeDistanceBand(-10)).toBeNull()
  })

  it('places every boundary in exactly one band', () => {
    expect(holeDistanceBand(0)?.key).toBe('short')
    expect(holeDistanceBand(249)?.key).toBe('short')
    expect(holeDistanceBand(250)?.key).toBe('mid')
    expect(holeDistanceBand(349)?.key).toBe('mid')
    expect(holeDistanceBand(350)?.key).toBe('long')
    expect(holeDistanceBand(449)?.key).toBe('long')
    expect(holeDistanceBand(450)?.key).toBe('very_long')
    expect(holeDistanceBand(1200)?.key).toBe('very_long')
  })

  it('leaves no gap between the declared bands', () => {
    for (let feet = 0; feet <= 500; feet += 1) {
      expect(holeDistanceBand(feet)).not.toBeNull()
    }
    expect(HOLE_DISTANCE_BANDS).toHaveLength(4)
  })
})

describe('layoutBrief', () => {
  // The live catalog holds zero courses, so this is the first state the
  // function will ever be called in.
  it('returns a zero brief for a missing layout', () => {
    const brief = layoutBrief(undefined)
    expect(brief.holeCount).toBe(0)
    expect(brief.parTotal).toBe(0)
    expect(brief.holesWithDistance).toBe(0)
    expect(brief.holesWithoutDistance).toBe(0)
    expect(brief.longest).toBeNull()
    expect(brief.shortest).toBeNull()
    expect(brief.parMix).toEqual([])
    expect(brief.bands).toEqual([])
    expect(brief.documented).toEqual({ hazards: 0, strategyNotes: 0 })
  })

  it('summarises a complete layout', () => {
    const brief = layoutBrief(
      layout([
        hole(1, { par: 3, distance_feet: 240 }),
        hole(2, { par: 4, distance_feet: 480 }),
        hole(3, { par: 3, distance_feet: 320, hazards: 'water left', strategy_notes: 'lay up' }),
      ]),
    )

    expect(brief.layoutId).toBe(LAYOUT_ID)
    expect(brief.holeCount).toBe(3)
    expect(brief.parTotal).toBe(10)
    expect(brief.holesWithPar).toBe(3)
    expect(brief.distanceTotalFeet).toBe(1040)
    expect(brief.holesWithDistance).toBe(3)
    expect(brief.holesWithoutDistance).toBe(0)
    expect(brief.longest).toEqual({ holeId: 'hole-2', holeNumber: 2, distanceFeet: 480 })
    expect(brief.shortest).toEqual({ holeId: 'hole-1', holeNumber: 1, distanceFeet: 240 })
    expect(brief.parMix).toEqual([
      { par: 3, holes: 2 },
      { par: 4, holes: 1 },
    ])
    expect(brief.bands).toEqual([
      { key: 'short', label: 'Under 250 ft', holes: 1 },
      { key: 'mid', label: '250–349 ft', holes: 1 },
      { key: 'very_long', label: '450 ft and up', holes: 1 },
    ])
    expect(brief.documented).toEqual({ hazards: 1, strategyNotes: 1 })
  })

  // A quick course is typed in on a phone at the first tee. Half its distances
  // will be blank, and the brief has to say so rather than report a total that
  // silently covers nine holes of eighteen.
  it('reports coverage rather than hiding missing course data', () => {
    const brief = layoutBrief(
      layout([
        hole(1, { par: 3, distance_feet: 300 }),
        hole(2, { par: null, distance_feet: null }),
        hole(3, { par: 3, distance_feet: null }),
      ]),
    )

    expect(brief.holeCount).toBe(3)
    expect(brief.holesWithPar).toBe(2)
    expect(brief.parTotal).toBe(6)
    expect(brief.holesWithDistance).toBe(1)
    expect(brief.holesWithoutDistance).toBe(2)
    expect(brief.distanceTotalFeet).toBe(300)
  })

  it('ignores whitespace-only hazard and strategy text', () => {
    const brief = layoutBrief(layout([hole(1, { hazards: '   ', strategy_notes: '' })]))
    expect(brief.documented).toEqual({ hazards: 0, strategyNotes: 0 })
  })
})

describe('holePrep', () => {
  const holes = [hole(1), hole(2), hole(3)]

  it('returns the course record and nothing else when no round has been played', () => {
    const entries = holePrep(layout(holes), [])

    expect(entries).toHaveLength(3)
    for (const entry of entries) {
      expect(entry.playedRounds).toBe(0)
      expect(entry.best).toBeNull()
      expect(entry.worst).toBeNull()
      expect(entry.averageRelativeToPar).toBeNull()
      expect(entry.totalRelativeToPar).toBe(0)
      expect(entry.outcomes).toEqual({ underPar: 0, atPar: 0, overPar: 0 })
      expect(entry.discs).toEqual([])
    }
    expect(entries[0].par).toBe(3)
    expect(entries[0].band.key).toBe('mid')
  })

  it('returns holes in play order regardless of the order they arrived in', () => {
    const entries = holePrep(layout([hole(3), hole(1), hole(2)]), [])
    expect(entries.map((entry) => entry.holeNumber)).toEqual([1, 2, 3])
  })

  it('breaks a tie on hole number with tee type', () => {
    const entries = holePrep(
      layout([hole(1, { id: 'hole-1-long', tee_type: 'long' }), hole(1, { id: 'hole-1-short', tee_type: 'blue' })]),
      [],
    )
    expect(entries.map((entry) => entry.holeId)).toEqual(['hole-1-short', 'hole-1-long'])
  })

  it('counts a single round as a fact but withholds the average', () => {
    const entries = holePrep(layout(holes), [round('r1', holes, [4, 3, 2])])

    expect(entries[0].playedRounds).toBe(1)
    expect(entries[0].best).toBe(4)
    expect(entries[0].totalRelativeToPar).toBe(1)
    expect(entries[0].averageRelativeToPar).toBeNull()
    expect(entries[0].outcomes).toEqual({ underPar: 0, atPar: 0, overPar: 1 })
    expect(entries[2].outcomes).toEqual({ underPar: 1, atPar: 0, overPar: 0 })
  })

  it('publishes the average once the sample floor is cleared', () => {
    const rounds = [
      round('r1', holes, [4, 3, 3]),
      round('r2', holes, [5, 3, 3]),
      round('r3', holes, [3, 3, 3]),
    ]
    const entries = holePrep(layout(holes), rounds)

    expect(COURSE_PREP_MIN_ROUNDS).toBe(3)
    expect(entries[0].playedRounds).toBe(3)
    expect(entries[0].totalRelativeToPar).toBe(3)
    expect(entries[0].averageRelativeToPar).toBe(1)
    expect(entries[0].best).toBe(3)
    expect(entries[0].worst).toBe(5)
    expect(entries[1].averageRelativeToPar).toBe(0)
  })

  it('honours an explicit minRounds override', () => {
    const entries = holePrep(layout(holes), [round('r1', holes, [4, 3, 3])], { minRounds: 1 })
    expect(entries[0].averageRelativeToPar).toBe(1)
  })

  // The reason `roundConditions.js` gives at length: a different layout is
  // different holes at different pars.
  it('ignores rounds played on another layout', () => {
    const other = round('r-other', holes, [6, 6, 6], { layout_id: 'layout-2' })
    const entries = holePrep(layout(holes), [other])
    expect(entries[0].playedRounds).toBe(0)
  })

  it('ignores rounds that are still in progress', () => {
    const live = round('r-live', holes, [6, 6, 6], { status: 'in_progress' })
    const entries = holePrep(layout(holes), [live])
    expect(entries[0].playedRounds).toBe(0)
  })

  it('skips blank and non-numeric scores instead of counting them as strokes', () => {
    const sparse = round('r1', holes, [null, '', 'x'])
    const entries = holePrep(layout(holes), [sparse])
    expect(entries.map((entry) => entry.playedRounds)).toEqual([0, 0, 0])
    expect(entries[0].totalRelativeToPar).toBe(0)
  })

  // A hole whose par was never entered still gets played; it just cannot report
  // anything relative to a par it does not have.
  it('reports plays but no relative scoring for a hole with no par', () => {
    const parless = [hole(1, { par: null })]
    const entries = holePrep(layout(parless), [round('r1', parless, [4])])

    expect(entries[0].playedRounds).toBe(1)
    expect(entries[0].best).toBe(4)
    expect(entries[0].totalRelativeToPar).toBeNull()
    expect(entries[0].averageRelativeToPar).toBeNull()
    expect(entries[0].outcomes).toEqual({ underPar: 0, atPar: 0, overPar: 0 })
  })

  it('aggregates the discs actually thrown on a hole, most-thrown first', () => {
    const wraith = { id: 'disc-w', nickname: 'Wraith' }
    const buzzz = { id: 'disc-b', nickname: 'Buzzz' }
    const withDiscs = (id, score, disc) => ({
      ...round(id, [holes[0]], [score]),
      round_holes: [
        { id: `${id}-rh`, round_id: id, hole_id: 'hole-1', score, disc_id: disc.id, disc },
      ],
    })

    const entries = holePrep(layout([holes[0]]), [
      withDiscs('r1', 4, wraith),
      withDiscs('r2', 3, wraith),
      withDiscs('r3', 5, buzzz),
    ])

    expect(entries[0].discs).toHaveLength(2)
    expect(entries[0].discs[0]).toMatchObject({ discId: 'disc-w', throws: 2, scoredThrows: 2 })
    expect(entries[0].discs[0].disc).toEqual(wraith)
    // Two throws is below the floor, so the per-disc average stays withheld
    // even though the hole itself cleared it.
    expect(entries[0].discs[0].averageRelativeToPar).toBeNull()
    expect(entries[0].discs[1].discId).toBe('disc-b')
  })

  it('counts a disc thrown without a score as a throw but not as evidence', () => {
    const disc = { id: 'disc-w', nickname: 'Wraith' }
    const entries = holePrep(layout([holes[0]]), [
      {
        id: 'r1',
        layout_id: LAYOUT_ID,
        status: 'completed',
        holes: [holes[0]],
        round_holes: [{ id: 'rh', round_id: 'r1', hole_id: 'hole-1', score: null, disc_id: disc.id, disc }],
      },
    ])

    expect(entries[0].playedRounds).toBe(0)
    expect(entries[0].discs[0]).toMatchObject({ throws: 1, scoredThrows: 0, averageRelativeToPar: null })
  })

  it('returns nothing at all for a layout with no holes', () => {
    expect(holePrep(layout([]), [])).toEqual([])
    expect(holePrep(null, [])).toEqual([])
  })

  it('never matches rounds when the layout has no id', () => {
    const entries = holePrep({ name: 'Unsaved', holes }, [round('r1', holes, [4, 4, 4])])
    expect(entries[0].playedRounds).toBe(0)
  })
})

describe('priorityHoles', () => {
  const entry = (holeNumber, averageRelativeToPar, playedRounds = 3) => ({
    holeId: `hole-${holeNumber}`,
    holeNumber,
    playedRounds,
    averageRelativeToPar,
  })

  it('is empty with no entries at all', () => {
    expect(priorityHoles()).toEqual([])
    expect(priorityHoles([])).toEqual([])
  })

  // The expected result for every player for their first few rounds: every
  // average is still withheld, so there is nothing to rank.
  it('is empty while every average is still withheld', () => {
    expect(priorityHoles([entry(1, null), entry(2, null)])).toEqual([])
  })

  it('leaves out holes the player is at or under par on', () => {
    expect(priorityHoles([entry(1, 0), entry(2, -0.5)])).toEqual([])
  })

  it('ranks by average over par, most costly first', () => {
    const ranked = priorityHoles([entry(1, 0.5), entry(2, 1.5), entry(3, 1)])
    expect(ranked.map((row) => row.holeNumber)).toEqual([2, 3, 1])
  })

  it('breaks an exact tie with the larger sample, then hole order', () => {
    const ranked = priorityHoles([entry(5, 1, 3), entry(2, 1, 8), entry(1, 1, 3)])
    expect(ranked.map((row) => row.holeNumber)).toEqual([2, 1, 5])
  })

  it('caps the list at the requested limit', () => {
    const ranked = priorityHoles([entry(1, 1), entry(2, 2), entry(3, 3), entry(4, 4)], { limit: 2 })
    expect(ranked.map((row) => row.holeNumber)).toEqual([4, 3])
  })
})

describe('lockerCoverage', () => {
  const disc = (id, category, status = 'in_locker') => ({
    id,
    status,
    moldInfo: category ? { category } : null,
  })

  it('reports an empty locker without inventing a gap', () => {
    const coverage = lockerCoverage(layout([hole(1)]), [])
    expect(coverage.discCount).toBe(0)
    expect(coverage.categories).toEqual([])
    expect(coverage.uncategorized).toBe(0)
    expect(coverage.bands).toEqual([{ key: 'mid', label: '250–349 ft', holes: 1 }])
  })

  it('survives a missing layout and a missing disc list', () => {
    const coverage = lockerCoverage(null)
    expect(coverage.bands).toEqual([])
    expect(coverage.discCount).toBe(0)
    expect(coverage.holesWithoutDistance).toBe(0)
  })

  it('counts carried discs by category in throwing order', () => {
    const coverage = lockerCoverage(layout([hole(1), hole(2, { distance_feet: 460 })]), [
      disc('d1', 'distance'),
      disc('d2', 'putter'),
      disc('d3', 'midrange'),
      disc('d4', 'distance'),
    ])

    expect(coverage.discCount).toBe(4)
    expect(coverage.categories).toEqual([
      { category: 'putter', discs: 1 },
      { category: 'midrange', discs: 1 },
      { category: 'distance', discs: 2 },
    ])
    expect(coverage.categories.map((row) => row.category)).toEqual(
      DISC_CATEGORY_ORDER.filter((category) => coverage.categories.some((row) => row.category === category)),
    )
  })

  it('leaves out discs that are no longer in the locker', () => {
    const coverage = lockerCoverage(layout([hole(1)]), [
      disc('d1', 'distance', 'lost'),
      disc('d2', 'distance', 'retired'),
      disc('d3', 'distance', 'sold'),
      disc('d4', 'distance'),
    ])
    expect(coverage.discCount).toBe(1)
    expect(coverage.categories).toEqual([{ category: 'distance', discs: 1 }])
  })

  // `disc_molds.category` is nullable and the catalog is filled in by hand, so
  // "we do not know" has to be distinguishable from "you have none".
  it('counts discs the catalog cannot categorise separately', () => {
    const coverage = lockerCoverage(layout([hole(1)]), [
      disc('d1', null),
      { id: 'd2', status: 'in_locker', moldInfo: { category: 'not-a-category' } },
      disc('d3', 'putter'),
    ])
    expect(coverage.uncategorized).toBe(2)
    expect(coverage.categories).toEqual([{ category: 'putter', discs: 1 }])
    expect(coverage.discCount).toBe(3)
  })

  it('carries a disc whose status was never set', () => {
    const coverage = lockerCoverage(layout([hole(1)]), [{ id: 'd1', moldInfo: { category: 'fairway' } }])
    expect(coverage.discCount).toBe(1)
    expect(coverage.categories).toEqual([{ category: 'fairway', discs: 1 }])
  })

  it('surfaces holes whose distance was never recorded', () => {
    const coverage = lockerCoverage(layout([hole(1), hole(2, { distance_feet: null })]), [])
    expect(coverage.holesWithoutDistance).toBe(1)
  })
})
