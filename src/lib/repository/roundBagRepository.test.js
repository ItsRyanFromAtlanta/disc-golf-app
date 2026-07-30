import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadBagVersions = vi.fn()
const getById = vi.fn()

vi.mock('./bagHistoryRepository', () => ({
  loadBagVersions: (...args) => loadBagVersions(...args),
}))

vi.mock('./activityRepository', () => ({
  activityRepository: { getById: (...args) => getById(...args) },
}))

const { roundEndedAt, verifyRoundBagSnapshot } = await import('./roundBagRepository')

const USER_ID = 'user-1'

function round(overrides = {}) {
  return {
    id: 'round-1',
    bag_id: 'bag-1',
    bag_version_id: 'v1',
    created_at: '2026-07-20T14:00:00.000Z',
    ...overrides,
  }
}

function version(id, at, extra = {}) {
  return {
    id,
    bag_id: 'bag-1',
    version: 1,
    name: 'Tournament',
    created_at: at,
    bag_version_discs: [{ disc_id: 'disc-a' }],
    ...extra,
  }
}

beforeEach(() => {
  loadBagVersions.mockReset()
  getById.mockReset()
  getById.mockResolvedValue(null)
})

describe('roundEndedAt', () => {
  it('reads the finalization time off the round’s activity parent', () => {
    // `rounds(id, user_id)` references `activities(id, user_id)`, so the
    // activity is stored under the round's own id — which is what lets this
    // work with no `rounds.finished_at` column and no migration.
    getById.mockResolvedValue({
      id: 'round-1',
      user_id: USER_ID,
      state: 'completed',
      updated_at: '2026-07-20T17:30:00.000Z',
    })
    return expect(roundEndedAt('round-1', USER_ID)).resolves.toBe('2026-07-20T17:30:00.000Z')
  })

  it('treats an incomplete round as finished too — it is still over', async () => {
    getById.mockResolvedValue({
      id: 'round-1',
      user_id: USER_ID,
      state: 'incomplete',
      updated_at: '2026-07-20T16:00:00.000Z',
    })
    await expect(roundEndedAt('round-1', USER_ID)).resolves.toBe('2026-07-20T16:00:00.000Z')
  })

  it('leaves the window open for a round still in progress', async () => {
    getById.mockResolvedValue({ id: 'round-1', user_id: USER_ID, state: 'active', updated_at: 'x' })
    await expect(roundEndedAt('round-1', USER_ID)).resolves.toBeNull()
  })

  it('leaves the window open when the activity is absent or belongs to someone else', async () => {
    // A round created on another device has no local activity mirror. Guessing
    // an end time from `played_at` — another device's clock, set at the start —
    // would be worse than admitting the window is open.
    getById.mockResolvedValue(null)
    await expect(roundEndedAt('round-1', USER_ID)).resolves.toBeNull()

    getById.mockResolvedValue({ id: 'round-1', user_id: 'someone-else', state: 'completed', updated_at: 'x' })
    await expect(roundEndedAt('round-1', USER_ID)).resolves.toBeNull()
  })

  it('never throws out of a local read failure', async () => {
    getById.mockRejectedValue(new Error('dexie is unhappy'))
    await expect(roundEndedAt('round-1', USER_ID)).resolves.toBeNull()
  })
})

describe('verifyRoundBagSnapshot', () => {
  it('verifies a snapshot against the bag’s version history', async () => {
    loadBagVersions.mockResolvedValue([version('v1', '2026-07-20T13:59:00.000Z')])
    getById.mockResolvedValue({
      id: 'round-1',
      user_id: USER_ID,
      state: 'completed',
      updated_at: '2026-07-20T17:00:00.000Z',
    })

    const result = await verifyRoundBagSnapshot(round(), USER_ID)
    expect(result.status).toBe('verified')
    expect(result.windowEndKnown).toBe(true)
    expect(loadBagVersions).toHaveBeenCalledWith('bag-1')
  })

  it('reports "unknown" — not "missing" — when the history cannot be read', async () => {
    // The whole point of the module. `loadBagVersions` already falls back to
    // Dexie and only throws when both are empty; that failure is the honest
    // "cannot be established" case and must not be reported as an absent
    // snapshot.
    loadBagVersions.mockRejectedValue(new Error('offline'))

    const result = await verifyRoundBagSnapshot(round(), USER_ID)
    expect(result.status).toBe('unknown')
    expect(result.verified).toBe(false)
  })

  it('does not read bag history at all for a round with no bag', async () => {
    const result = await verifyRoundBagSnapshot(round({ bag_id: null, bag_version_id: null }), USER_ID)
    expect(result.status).toBe('no_bag_recorded')
    expect(loadBagVersions).not.toHaveBeenCalled()
  })

  it('never repairs a round that recorded no snapshot', async () => {
    loadBagVersions.mockResolvedValue([version('v9', '2026-07-01T00:00:00.000Z')])

    const result = await verifyRoundBagSnapshot(round({ bag_version_id: null }), USER_ID)
    expect(result.status).toBe('not_snapshotted')
    expect(result.versionId).toBeNull()
  })

  it('tolerates being handed nothing', async () => {
    const result = await verifyRoundBagSnapshot(null, USER_ID)
    expect(result.status).toBe('no_bag_recorded')
  })
})
