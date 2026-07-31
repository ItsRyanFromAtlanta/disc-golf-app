import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Isolated from `roundRepository.test.js` for the same reason
// `roundLog.fetchRound.test.js` is separate from `roundLog.test.js`: this file
// mocks the network- and activity-lifecycle-facing dependencies of
// `useCreateRound`'s `mutationFn`, which the outbox-flush tests in the sibling
// file do not touch and must not be affected by.

const { captureBagVersionMock, assertCourseIsSyncedMock, createRoundApiMock, activityFlushMock } = vi.hoisted(() => ({
  captureBagVersionMock: vi.fn(),
  assertCourseIsSyncedMock: vi.fn(async () => undefined),
  createRoundApiMock: vi.fn(),
  activityFlushMock: vi.fn(async () => ({ hasPending: false, error: null, permanentFailureIds: [] })),
}))

vi.mock('./bagHistoryRepository', async () => {
  const actual = await vi.importActual('./bagHistoryRepository')
  return { ...actual, captureBagVersion: (...args) => captureBagVersionMock(...args) }
})

vi.mock('./courseRepository', () => ({
  assertCourseIsSynced: (...args) => assertCourseIsSyncedMock(...args),
}))

vi.mock('./activityRepository', () => ({
  activityRepository: {
    getById: vi.fn(async () => null),
    createDraft: vi.fn(async ({ id }) => ({ activity: { id, state: 'draft' } })),
    getActive: vi.fn(async () => ({ id: 'some-other-activity' })),
    start: vi.fn(),
    finalize: vi.fn(),
  },
}))

vi.mock('./activitySync', () => ({
  createActivitySyncAdapter: () => ({ flush: (...args) => activityFlushMock(...args) }),
}))

vi.mock('../roundLog', async () => {
  const actual = await vi.importActual('../roundLog')
  return { ...actual, createRound: (...args) => createRoundApiMock(...args) }
})

const { captureRoundStartBagVersion, createRoundMutationFn } = await import('./roundRepository')
const { db } = await import('../db/dexieDb')

const USER_ID = 'user-1'
const ROUND_ID = 'round-1'
const OFFLINE_ERROR = Object.assign(new TypeError('Failed to fetch'), {})

describe('captureRoundStartBagVersion (DEFECT_REGISTER D-05, E2 audit F2)', () => {
  beforeEach(() => {
    captureBagVersionMock.mockReset()
  })

  it('returns the captured version id on success', async () => {
    captureBagVersionMock.mockResolvedValueOnce('version-1')

    const result = await captureRoundStartBagVersion('bag-1', ROUND_ID)

    expect(result).toBe('version-1')
    expect(captureBagVersionMock).toHaveBeenCalledTimes(1)
    expect(captureBagVersionMock).toHaveBeenCalledWith('bag-1', { idempotencyKey: `round-bag:${ROUND_ID}` })
  })

  it('degrades to null on failure, rather than falling back to a stale cached version', async () => {
    captureBagVersionMock.mockRejectedValue(OFFLINE_ERROR)

    const result = await captureRoundStartBagVersion('bag-1', ROUND_ID)

    // The old behaviour here — `latestBagVersion(await loadBagVersions(bagId))`
    // — is what E2 audit finding F2 named: a stale local version recorded
    // indistinguishably from a fresh one. `null` is the honest fact instead,
    // and `verifyRoundBag` already has a status for it (`not_snapshotted`).
    expect(result).toBeNull()
  })

  it('never throws — this is the D-05 fix: nothing here can escape useCreateRound\'s mutationFn before payload exists', async () => {
    captureBagVersionMock.mockRejectedValue(OFFLINE_ERROR)
    await expect(captureRoundStartBagVersion('bag-1', ROUND_ID)).resolves.toBeNull()
  })
})

describe('useCreateRound offline with a bag selected (DEFECT_REGISTER D-05)', () => {
  beforeEach(async () => {
    captureBagVersionMock.mockReset()
    assertCourseIsSyncedMock.mockReset().mockResolvedValue(undefined)
    createRoundApiMock.mockReset()
    activityFlushMock.mockReset().mockResolvedValue({ hasPending: false, error: null, permanentFailureIds: [] })
    await db.open()
    await db.outbox.clear()
    await db.rounds.clear()
  })

  afterEach(async () => {
    await db.outbox.clear()
    await db.rounds.clear()
  })

  it('queues the round and attaches a usable localResult instead of throwing before payload exists', async () => {
    // The exact fault D-05 named: the bag-version RPC always rejects offline.
    captureBagVersionMock.mockRejectedValue(OFFLINE_ERROR)
    // And the remote round create is offline too, which is what should make
    // this reject overall — but *with* a localResult, unlike before the fix.
    createRoundApiMock.mockRejectedValue(OFFLINE_ERROR)

    const mutation = createRoundMutationFn(USER_ID)
    const fields = {
      id: ROUND_ID,
      course_id: 'course-1',
      layout_id: 'layout-1',
      bag_id: 'bag-1',
      status: 'in_progress',
      played_at: '2026-07-31T00:00:00.000Z',
    }

    let caught = null
    try {
      await mutation(fields)
    } catch (error) {
      caught = error
    }

    expect(caught).not.toBeNull()
    // The old bug: this was undefined, so `RoundStartPage.jsx`'s
    // `err.localResult?.id` check found nothing and fell through to a raw,
    // unactionable error message with no round created at all.
    expect(caught.localResult).toMatchObject({
      id: ROUND_ID,
      user_id: USER_ID,
      bag_version_id: null,
    })

    // The outbox row and the local optimistic round are what let
    // `RoundStartPage.jsx` navigate to the round anyway.
    const outboxRows = await db.outbox.where('table').equals('rounds').toArray()
    expect(outboxRows).toHaveLength(1)
    expect(outboxRows[0].payload).toMatchObject({ id: ROUND_ID, bag_version_id: null })
    const cached = await db.rounds.get(ROUND_ID)
    expect(cached).toMatchObject({ id: ROUND_ID, bag_version_id: null })
  })
})
