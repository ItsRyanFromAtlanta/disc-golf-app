import { describe, expect, it } from 'vitest'
import {
  MAX_PLAYER_NAME_LENGTH,
  ROUND_PLAYER_LIMIT,
  describeRoster,
  isRosterFull,
  isValidPosition,
  nextAvailablePosition,
  normalizePlayerName,
  normalizeRoster,
  normalizeStatedTotal,
  readRoundPlayer,
  roundPlayerFields,
} from './roundPlayers'

const ROUND_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'

function row(position, overrides = {}) {
  return {
    id: `row-${position}`,
    round_id: ROUND_ID,
    user_id: USER_ID,
    position,
    display_name: `Player ${position}`,
    total_score: null,
    ...overrides,
  }
}

describe('normalizePlayerName', () => {
  it('trims and collapses whitespace so one person is one seat', () => {
    expect(normalizePlayerName('  Dave   Smith ')).toBe('Dave Smith')
  })

  it('returns null for nothing, blank, and non-strings', () => {
    expect(normalizePlayerName(undefined)).toBeNull()
    expect(normalizePlayerName('')).toBeNull()
    expect(normalizePlayerName('   ')).toBeNull()
    expect(normalizePlayerName(42)).toBeNull()
  })

  it('caps at the length the CHECK constraint allows, so the database never rejects a name', () => {
    const long = 'x'.repeat(MAX_PLAYER_NAME_LENGTH + 20)
    expect(normalizePlayerName(long)).toHaveLength(MAX_PLAYER_NAME_LENGTH)
  })
})

describe('normalizeStatedTotal', () => {
  it('rounds to whole strokes', () => {
    expect(normalizeStatedTotal('54.4')).toBe(54)
  })

  it('treats absent, blank, negative and unparseable values as not recorded', () => {
    expect(normalizeStatedTotal(undefined)).toBeNull()
    expect(normalizeStatedTotal(null)).toBeNull()
    expect(normalizeStatedTotal('')).toBeNull()
    expect(normalizeStatedTotal(-1)).toBeNull()
    expect(normalizeStatedTotal('par')).toBeNull()
    expect(normalizeStatedTotal(true)).toBeNull()
  })

  it('keeps zero, which is a real value the CHECK allows', () => {
    expect(normalizeStatedTotal(0)).toBe(0)
  })
})

describe('isValidPosition', () => {
  it('accepts the seats the CHECK constraint accepts and nothing else', () => {
    expect(isValidPosition(1)).toBe(true)
    expect(isValidPosition(ROUND_PLAYER_LIMIT)).toBe(true)
    expect(isValidPosition(0)).toBe(false)
    expect(isValidPosition(ROUND_PLAYER_LIMIT + 1)).toBe(false)
    expect(isValidPosition(1.5)).toBe(false)
    expect(isValidPosition('1')).toBe(false)
  })
})

describe('roundPlayerFields', () => {
  it('produces exactly the persisted columns', () => {
    const fields = roundPlayerFields({
      roundId: ROUND_ID,
      userId: USER_ID,
      position: 2,
      displayName: ' Dave ',
      totalScore: '54',
    })
    expect(fields).toMatchObject({
      round_id: ROUND_ID,
      user_id: USER_ID,
      position: 2,
      display_name: 'Dave',
      total_score: 54,
    })
    expect(fields.id).toBeTruthy()
  })

  it('accepts the snake_case shape a stored row carries', () => {
    const fields = roundPlayerFields({
      round_id: ROUND_ID,
      user_id: USER_ID,
      position: 1,
      display_name: 'Dad',
      total_score: 60,
    })
    expect(fields.display_name).toBe('Dad')
    expect(fields.total_score).toBe(60)
  })

  // The point of refusing here rather than at the server: a 23514 arriving at
  // the outbox classifies as permanent and poisons the round.
  it('refuses anything the CHECK constraints would reject', () => {
    const base = { roundId: ROUND_ID, userId: USER_ID, position: 1, displayName: 'Dave' }
    expect(roundPlayerFields({ ...base, displayName: '   ' })).toBeNull()
    expect(roundPlayerFields({ ...base, position: 0 })).toBeNull()
    expect(roundPlayerFields({ ...base, position: ROUND_PLAYER_LIMIT + 1 })).toBeNull()
    expect(roundPlayerFields({ ...base, roundId: null })).toBeNull()
    expect(roundPlayerFields({ ...base, userId: null })).toBeNull()
    expect(roundPlayerFields()).toBeNull()
  })

  it('keeps an unusable total as "not recorded" rather than refusing the whole player', () => {
    const fields = roundPlayerFields({
      roundId: ROUND_ID,
      userId: USER_ID,
      position: 1,
      displayName: 'Dave',
      totalScore: 'nope',
    })
    expect(fields.total_score).toBeNull()
    expect(fields.display_name).toBe('Dave')
  })
})

describe('readRoundPlayer', () => {
  it('reads a stored row into the editable shape', () => {
    expect(readRoundPlayer(row(3, { display_name: ' Dave ', total_score: '54' }))).toEqual({
      id: 'row-3',
      position: 3,
      displayName: 'Dave',
      totalScore: 54,
    })
  })

  it('survives an absent row', () => {
    expect(readRoundPlayer()).toEqual({ id: null, position: null, displayName: '', totalScore: null })
  })
})

describe('normalizeRoster', () => {
  it('returns nothing for an empty, absent or non-array roster', () => {
    expect(normalizeRoster([])).toEqual([])
    expect(normalizeRoster()).toEqual([])
    expect(normalizeRoster(null)).toEqual([])
  })

  it('orders by seat rather than by insertion', () => {
    expect(normalizeRoster([row(3), row(1), row(2)]).map((r) => r.position)).toEqual([1, 2, 3])
  })

  it('drops rows with an unusable seat or no name', () => {
    const roster = normalizeRoster([row(1), row(0), row(99), row(2, { display_name: '  ' })])
    expect(roster.map((r) => r.position)).toEqual([1])
  })

  // Seat, not row id, is the identity — `unique (round_id, position)`. An
  // optimistic local row and the server's row for the same seat must resolve to
  // one entry or the card shows a phantom player.
  it('collapses two rows claiming the same seat, keeping the newer one', () => {
    const older = row(1, { id: 'local', display_name: 'Typo', updated_at: '2026-07-30T10:00:00Z' })
    const newer = row(1, { id: 'server', display_name: 'Dave', updated_at: '2026-07-30T11:00:00Z' })
    const roster = normalizeRoster([newer, older])
    expect(roster).toHaveLength(1)
    expect(roster[0].id).toBe('server')
  })

  it('falls back to created_at, then to insertion order, when updated_at is absent', () => {
    const a = row(1, { id: 'a', created_at: '2026-07-30T10:00:00Z' })
    const b = row(1, { id: 'b', created_at: '2026-07-30T12:00:00Z' })
    expect(normalizeRoster([a, b])[0].id).toBe('b')
    const undated = [row(1, { id: 'x' }), row(1, { id: 'y' })]
    expect(normalizeRoster(undated)[0].id).toBe('y')
  })
})

describe('nextAvailablePosition', () => {
  it('starts at seat 1 on an empty card', () => {
    expect(nextAvailablePosition([])).toBe(1)
    expect(nextAvailablePosition()).toBe(1)
  })

  // Lowest free, not one past the highest: otherwise removing and re-adding
  // walks the roster up to the cap and a card of seven becomes seven writes.
  it('reuses a freed seat rather than climbing towards the cap', () => {
    expect(nextAvailablePosition([row(1), row(3)])).toBe(2)
  })

  it('returns null and reports full at the cap', () => {
    const full = Array.from({ length: ROUND_PLAYER_LIMIT }, (_, index) => row(index + 1))
    expect(nextAvailablePosition(full)).toBeNull()
    expect(isRosterFull(full)).toBe(true)
    expect(isRosterFull([row(1)])).toBe(false)
    expect(isRosterFull([])).toBe(false)
  })
})

describe('describeRoster', () => {
  // Null, not "played alone": an empty roster means nothing was recorded, and
  // every round logged before this feature existed has one.
  it('says nothing at all for an empty roster', () => {
    expect(describeRoster([])).toBeNull()
    expect(describeRoster()).toBeNull()
  })

  it('names one, two and many companions', () => {
    expect(describeRoster([row(1, { display_name: 'Dave' })])).toBe('Played with Dave')
    expect(describeRoster([row(1, { display_name: 'Dave' }), row(2, { display_name: 'Sam' })])).toBe(
      'Played with Dave and Sam',
    )
    expect(
      describeRoster([
        row(1, { display_name: 'Dave' }),
        row(2, { display_name: 'Sam' }),
        row(3, { display_name: 'Jo' }),
      ]),
    ).toBe('Played with Dave, Sam and Jo')
  })
})
