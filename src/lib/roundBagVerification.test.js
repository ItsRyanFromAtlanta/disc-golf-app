import { describe, expect, it } from 'vitest'
import {
  BAG_VERIFICATION_STATUSES,
  describeBagVerification,
  roundStartedAt,
  verifyRoundBag,
} from './roundBagVerification'

const BAG = 'bag-1'
const OTHER_BAG = 'bag-2'

function version(id, { at, number = 1, bagId = BAG, discs = ['disc-a', 'disc-b'], name = 'Tournament' } = {}) {
  return {
    id,
    bag_id: bagId,
    version: number,
    name,
    created_at: at,
    bag_version_discs: discs.map((discId) => ({ disc_id: discId })),
  }
}

function round(overrides = {}) {
  return {
    id: 'round-1',
    bag_id: BAG,
    bag_version_id: 'v1',
    created_at: '2026-07-20T14:00:00.000Z',
    played_at: '2026-07-20T14:00:00.000Z',
    ...overrides,
  }
}

describe('verifyRoundBag — the cases where nothing can be established', () => {
  it('separates "could not read the history" from "there is no snapshot"', () => {
    // The distinction this module exists for. A failed read is not evidence
    // about a bag, and reporting `snapshot_missing` because the phone was in a
    // basement would state a conclusion the data does not support.
    const unread = verifyRoundBag({ round: round(), versions: null })
    expect(unread.status).toBe(BAG_VERIFICATION_STATUSES.UNKNOWN)
    expect(unread.verified).toBe(false)

    const read = verifyRoundBag({ round: round(), versions: [] })
    expect(read.status).toBe(BAG_VERIFICATION_STATUSES.SNAPSHOT_MISSING)
  })

  it('reports a round with no bag as nothing to verify, not as a failure', () => {
    const result = verifyRoundBag({
      round: round({ bag_id: null, bag_version_id: null }),
      versions: [],
    })
    expect(result.status).toBe(BAG_VERIFICATION_STATUSES.NO_BAG_RECORDED)
    expect(describeBagVerification(result).detail).toMatch(/No bag was selected/)
  })

  it('reports a bag with no snapshot — a pre-snapshot round, or a failed capture', () => {
    const result = verifyRoundBag({
      round: round({ bag_version_id: null }),
      versions: [version('v1', { at: '2026-07-01T00:00:00.000Z' })],
    })
    expect(result.status).toBe(BAG_VERIFICATION_STATUSES.NOT_SNAPSHOTTED)
    // Never repaired: the newest version is right there and is deliberately not
    // adopted as the round's snapshot.
    expect(result.versionId).toBeNull()
    expect(result.discIds).toEqual([])
  })

  it('reports a snapshot belonging to a different bag without choosing a winner', () => {
    const result = verifyRoundBag({
      round: round(),
      versions: [version('v1', { at: '2026-07-20T13:00:00.000Z', bagId: OTHER_BAG })],
    })
    expect(result.status).toBe(BAG_VERIFICATION_STATUSES.BAG_MISMATCH)
    expect(result.bagId).toBe(BAG)
    expect(result.mismatchedBagId).toBe(OTHER_BAG)
  })

  it('cannot place an undatable snapshot on the timeline, and says so', () => {
    const result = verifyRoundBag({
      round: round({ created_at: null, played_at: null }),
      versions: [version('v1', { at: '2026-07-20T13:00:00.000Z' })],
    })
    expect(result.status).toBe(BAG_VERIFICATION_STATUSES.EDITED)
    expect(result.undatable).toBe(true)
    expect(result.windowEndKnown).toBe(false)
    expect(describeBagVerification(result).detail).toMatch(/no usable start time/)
  })
})

describe('verifyRoundBag — reading the bag version timeline', () => {
  it('confirms a snapshot taken at the first tee with nothing after it', () => {
    const result = verifyRoundBag({
      round: round(),
      versions: [version('v1', { at: '2026-07-20T13:59:00.000Z' })],
      roundEndedAt: '2026-07-20T17:00:00.000Z',
    })
    expect(result.status).toBe(BAG_VERIFICATION_STATUSES.VERIFIED)
    expect(result.verified).toBe(true)
    expect(result.discCount).toBe(2)
    expect(result.windowEndKnown).toBe(true)
    expect(describeBagVerification(result).detail).toBe('2 discs, unchanged for this round.')
  })

  it('catches the stale offline fallback: a save between the snapshot and the tee', () => {
    // The case that motivated the feature. `useCreateRound` falls back to the
    // newest version the device knows about when the live capture fails, so an
    // offline round can record a snapshot that was already superseded.
    const result = verifyRoundBag({
      round: round(),
      versions: [
        version('v1', { at: '2026-07-01T10:00:00.000Z', number: 1 }),
        version('v2', { at: '2026-07-15T10:00:00.000Z', number: 2, discs: ['disc-a', 'disc-c'] }),
      ],
      roundEndedAt: '2026-07-20T17:00:00.000Z',
    })
    expect(result.status).toBe(BAG_VERIFICATION_STATUSES.EDITED)
    expect(result.editedBeforeRound).toEqual(['v2'])
    expect(result.editedDuringRound).toEqual([])
    expect(describeBagVerification(result).detail).toMatch(/before the round started/)
  })

  it('catches a save during play', () => {
    const result = verifyRoundBag({
      round: round(),
      versions: [
        version('v1', { at: '2026-07-20T13:59:00.000Z', number: 1 }),
        version('v2', { at: '2026-07-20T15:30:00.000Z', number: 2 }),
      ],
      roundEndedAt: '2026-07-20T17:00:00.000Z',
    })
    expect(result.status).toBe(BAG_VERIFICATION_STATUSES.EDITED)
    expect(result.editedDuringRound).toEqual(['v2'])
    expect(describeBagVerification(result).detail).toMatch(/while this round was in progress/)
  })

  it('does not blame an edit made after the round finished', () => {
    const result = verifyRoundBag({
      round: round(),
      versions: [
        version('v1', { at: '2026-07-20T13:59:00.000Z', number: 1 }),
        version('v2', { at: '2026-07-21T09:00:00.000Z', number: 2 }),
      ],
      roundEndedAt: '2026-07-20T17:00:00.000Z',
    })
    expect(result.status).toBe(BAG_VERIFICATION_STATUSES.VERIFIED)
    // But it is still reported as drift, because that is useful context.
    expect(result.driftFromCurrent).not.toBeNull()
  })

  it('bounds its claim honestly when the round has no known end', () => {
    const result = verifyRoundBag({
      round: round(),
      versions: [
        version('v1', { at: '2026-07-20T13:59:00.000Z', number: 1 }),
        version('v2', { at: '2026-07-21T09:00:00.000Z', number: 2 }),
      ],
      roundEndedAt: null,
    })
    expect(result.status).toBe(BAG_VERIFICATION_STATUSES.EDITED)
    expect(result.windowEndKnown).toBe(false)
    expect(describeBagVerification(result).detail).toMatch(/no recorded end/)
  })

  it('ignores other bags’ versions entirely', () => {
    const result = verifyRoundBag({
      round: round(),
      versions: [
        version('v1', { at: '2026-07-20T13:59:00.000Z' }),
        version('other', { at: '2026-07-20T15:00:00.000Z', bagId: OTHER_BAG, number: 9 }),
      ],
      roundEndedAt: '2026-07-20T17:00:00.000Z',
    })
    expect(result.status).toBe(BAG_VERIFICATION_STATUSES.VERIFIED)
    expect(result.driftFromCurrent).toBeNull()
  })

  it('reports both sides when the bag was saved before and during', () => {
    const result = verifyRoundBag({
      round: round(),
      versions: [
        version('v1', { at: '2026-07-01T10:00:00.000Z', number: 1 }),
        version('v2', { at: '2026-07-15T10:00:00.000Z', number: 2 }),
        version('v3', { at: '2026-07-20T15:00:00.000Z', number: 3 }),
      ],
      roundEndedAt: '2026-07-20T17:00:00.000Z',
    })
    expect(result.editedBeforeRound).toEqual(['v2'])
    expect(result.editedDuringRound).toEqual(['v3'])
    expect(describeBagVerification(result).detail).toMatch(/both before and during/)
  })
})

describe('verifyRoundBag — drift from the current bag', () => {
  it('names what has been added and removed since the round', () => {
    const result = verifyRoundBag({
      round: round(),
      versions: [
        version('v1', { at: '2026-07-20T13:59:00.000Z', number: 1, discs: ['a', 'b', 'c'] }),
        version('v2', { at: '2026-07-25T10:00:00.000Z', number: 2, discs: ['b', 'c', 'd'] }),
      ],
      roundEndedAt: '2026-07-20T17:00:00.000Z',
    })
    expect(result.driftFromCurrent).toEqual({ added: ['d'], removed: ['a'] })
  })

  it('reports no drift when the round’s snapshot is still the newest', () => {
    const result = verifyRoundBag({
      round: round(),
      versions: [version('v1', { at: '2026-07-20T13:59:00.000Z' })],
      roundEndedAt: '2026-07-20T17:00:00.000Z',
    })
    expect(result.driftFromCurrent).toBeNull()
  })

  it('deduplicates a snapshot that somehow lists a disc twice', () => {
    const result = verifyRoundBag({
      round: round(),
      versions: [version('v1', { at: '2026-07-20T13:59:00.000Z', discs: ['a', 'a', 'b'] })],
    })
    expect(result.discIds).toEqual(['a', 'b'])
    expect(result.discCount).toBe(2)
  })
})

describe('roundStartedAt', () => {
  it('prefers created_at, because it shares a clock with bag_versions.created_at', () => {
    // `played_at` is written on the device at submit; `created_at` is a server
    // default, as is `bag_versions.created_at`. Comparing a client clock to a
    // server clock would manufacture edits that never happened.
    const at = roundStartedAt({
      created_at: '2026-07-20T14:00:00.000Z',
      played_at: '2026-07-20T09:00:00.000Z',
    })
    expect(at).toBe(Date.parse('2026-07-20T14:00:00.000Z'))
  })

  it('falls back to played_at, then to nothing', () => {
    expect(roundStartedAt({ played_at: '2026-07-20T09:00:00.000Z' })).toBe(
      Date.parse('2026-07-20T09:00:00.000Z'),
    )
    expect(roundStartedAt({})).toBeNull()
    expect(roundStartedAt({ created_at: 'not a date' })).toBeNull()
  })
})

describe('describeBagVerification', () => {
  it('gives every status a headline and a reason, never a bare failure', () => {
    for (const status of Object.values(BAG_VERIFICATION_STATUSES)) {
      const message = describeBagVerification({ status, discCount: 1, editedBeforeRound: [], editedDuringRound: [] })
      expect(message.headline).toBeTruthy()
      expect(message.detail).toBeTruthy()
      expect(message.detail).not.toMatch(/something went wrong/i)
    }
  })

  it('distinguishes an unreadable history from an unverifiable bag', () => {
    // A player has to be able to tell "your bag changed" from "your phone
    // could not reach the server" — one is about equipment, one about signal.
    expect(describeBagVerification({ status: 'unknown' }).detail).toMatch(/could not be read/)
    expect(describeBagVerification({ status: 'not_snapshotted' }).detail).toMatch(/no snapshot was taken/)
  })

  it('treats an unrecognised status as unchecked rather than as verified', () => {
    const message = describeBagVerification({ status: 'something_new' })
    expect(message.headline).toBe('Bag not checked')
  })

  it('handles being called with nothing at all', () => {
    expect(describeBagVerification().headline).toBe('Bag not checked')
  })
})
