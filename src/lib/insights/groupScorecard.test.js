import { describe, expect, it } from 'vitest'
import { describeGroupScorecard, groupScorecard } from './groupScorecard'

const ROUND_ID = '11111111-1111-4111-8111-111111111111'

function hole(id, par) {
  return { id, par }
}

function scoredRound(overrides = {}) {
  return {
    id: ROUND_ID,
    holes: [hole('h1', 3), hole('h2', 4), hole('h3', 3)],
    round_holes: [
      { hole_id: 'h1', score: 3 },
      { hole_id: 'h2', score: 5 },
      { hole_id: 'h3', score: 3 },
    ],
    ...overrides,
  }
}

function companion(position, name, total = null) {
  return { id: `p${position}`, position, display_name: name, total_score: total }
}

describe('groupScorecard — the solo and absent cases', () => {
  it('reports a solo round as not a group round, with the owner still on the card', () => {
    const card = groupScorecard({ round: scoredRound(), players: [] })
    expect(card.isGroupRound).toBe(false)
    expect(card.companionCount).toBe(0)
    expect(card.cardSize).toBe(1)
    expect(card.entries).toHaveLength(1)
    expect(card.entries[0].kind).toBe('self')
  })

  it('survives no arguments at all', () => {
    const card = groupScorecard()
    expect(card.isGroupRound).toBe(false)
    expect(card.entries).toHaveLength(1)
    expect(card.entries[0].total).toBeNull()
    expect(card.parTotal).toBeNull()
  })

  // Zero players is not zero coverage of a group; it is not a group.
  it('reports null coverage rather than 0 for a solo round', () => {
    expect(groupScorecard({ round: scoredRound(), players: [] }).totalsCoverage).toBeNull()
  })

  it('says nothing about a solo round', () => {
    expect(describeGroupScorecard(groupScorecard({ round: scoredRound(), players: [] }))).toBeNull()
    expect(describeGroupScorecard(null)).toBeNull()
  })
})

describe('groupScorecard — the owner line', () => {
  it('carries the scorecard total and its source through unchanged', () => {
    const self = groupScorecard({ round: scoredRound(), players: [] }).entries[0]
    expect(self.total).toBe(11)
    expect(self.totalSource).toBe('scorecard')
    expect(self.relativeToPar).toBe(1)
    expect(self.relativeToParSource).toBe('scorecard')
  })

  // An unscored round must not claim even par here any more than it does on the
  // summary hero — the F1 defect, in a second consumer.
  it('shows an unscored round as having no total, not as even par', () => {
    const self = groupScorecard({
      round: { id: ROUND_ID, holes: [hole('h1', 3)], round_holes: [] },
      players: [companion(1, 'Dave')],
    }).entries[0]
    expect(self.total).toBeNull()
    expect(self.relativeToPar).toBeNull()
  })

  it('labels an activity-only round\'s total as stated', () => {
    const self = groupScorecard({
      round: { id: ROUND_ID, scoring_mode: 'activity_only', total_score: 54, holes: [hole('h1', 3)] },
      players: [],
    }).entries[0]
    expect(self.total).toBe(54)
    expect(self.totalSource).toBe('stated')
  })

  it('uses the label it is given for the owner', () => {
    const card = groupScorecard({ round: scoredRound(), players: [], selfLabel: 'Ryan' })
    expect(card.entries[0].name).toBe('Ryan')
  })
})

describe('groupScorecard — companions', () => {
  it('places companions after the owner, in seat order, never in score order', () => {
    const card = groupScorecard({
      round: scoredRound(),
      players: [companion(2, 'Sam', 48), companion(1, 'Dave', 62)],
    })
    expect(card.entries.map((entry) => entry.name)).toEqual(['You', 'Dave', 'Sam'])
    // Sam shot the lowest round on the card and is still listed second, because
    // seat order is the only order this module has.
    expect(card.entries[2].total).toBe(48)
  })

  it('labels every companion total as stated', () => {
    const card = groupScorecard({ round: scoredRound(), players: [companion(1, 'Dave', 54)] })
    expect(card.entries[1].totalSource).toBe('stated')
    expect(card.entries[1].relativeToParSource).toBe('stated_vs_par')
    expect(card.entries[1].relativeToPar).toBe(54 - 10)
  })

  it('leaves a companion with no total as unrecorded rather than zero', () => {
    const card = groupScorecard({ round: scoredRound(), players: [companion(1, 'Dave')] })
    expect(card.entries[1].total).toBeNull()
    expect(card.entries[1].totalSource).toBeNull()
    expect(card.entries[1].relativeToPar).toBeNull()
  })

  // `stated - 0` renders as a wildly negative "score to par" that is really the
  // raw total. The same trap `roundScoreSummary` avoids, avoided the same way.
  it('withholds relative-to-par when the layout carries no pars', () => {
    const card = groupScorecard({
      round: { id: ROUND_ID, holes: [hole('h1', null), hole('h2', null)] },
      players: [companion(1, 'Dave', 54)],
    })
    expect(card.parTotal).toBeNull()
    expect(card.entries[1].total).toBe(54)
    expect(card.entries[1].relativeToPar).toBeNull()
  })

  it('withholds relative-to-par when no layout was recorded at all', () => {
    const card = groupScorecard({
      round: { id: ROUND_ID, scoring_mode: 'activity_only', total_score: 50 },
      players: [companion(1, 'Dave', 54)],
    })
    expect(card.entries[1].relativeToPar).toBeNull()
  })

  it('drops a companion the schema could not hold', () => {
    const card = groupScorecard({
      round: scoredRound(),
      players: [companion(1, 'Dave'), companion(0, 'Seatless'), companion(2, '   ')],
    })
    expect(card.companionCount).toBe(1)
    expect(card.entries.map((entry) => entry.name)).toEqual(['You', 'Dave'])
  })
})

describe('groupScorecard — coverage', () => {
  it('counts how many of the card have a total, owner included', () => {
    const card = groupScorecard({
      round: scoredRound(),
      players: [companion(1, 'Dave', 54), companion(2, 'Sam')],
    })
    expect(card.cardSize).toBe(3)
    expect(card.totalsRecorded).toBe(2)
    expect(card.totalsCoverage).toBeCloseTo(2 / 3)
  })

  it('describes a complete card, a partial one, and one with nothing recorded', () => {
    const complete = groupScorecard({ round: scoredRound(), players: [companion(1, 'Dave', 54)] })
    expect(describeGroupScorecard(complete)).toBe('Two players on this card, all with a total recorded.')

    const partial = groupScorecard({
      round: scoredRound(),
      players: [companion(1, 'Dave', 54), companion(2, 'Sam')],
    })
    expect(describeGroupScorecard(partial)).toBe('3 players on this card. 2 of 3 have a total recorded.')

    const none = groupScorecard({
      round: { id: ROUND_ID, holes: [hole('h1', 3)], round_holes: [] },
      players: [companion(1, 'Dave')],
    })
    expect(describeGroupScorecard(none)).toBe('Two players on this card. No totals recorded.')
  })
})

describe('groupScorecard — what it deliberately does not do', () => {
  const card = groupScorecard({
    round: scoredRound(),
    players: [companion(1, 'Dave', 62), companion(2, 'Sam', 48)],
  })

  // These assertions exist to make a future "small addition" fail loudly. Rank,
  // winner and gap are the leaderboard, and the leaderboard is parked.
  it('exposes no rank, winner, position-on-the-day or gap', () => {
    expect(Object.keys(card)).toEqual([
      'isGroupRound',
      'cardSize',
      'companionCount',
      'entries',
      'parTotal',
      'totalsRecorded',
      'totalsCoverage',
    ])
    card.entries.forEach((entry) => {
      expect(entry).not.toHaveProperty('rank')
      expect(entry).not.toHaveProperty('won')
      expect(entry).not.toHaveProperty('strokesBehind')
    })
  })

  it('does not average companion totals into anything', () => {
    expect(card).not.toHaveProperty('averageScore')
    expect(card).not.toHaveProperty('fieldAverage')
  })
})
