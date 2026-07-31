import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { LOST_FOUND_REFERENCE_DATA_MESSAGE, loadLostFoundScreen } from './lostFoundRepository'

const QUEUED_CASE = { id: 'case-1', user_id: 'user-1', disc_id: 'disc-1', status: 'open', pending: true }
const QUEUED_UPDATE = { id: 'update-1', case_id: 'case-1', event_type: 'reported_lost', pending: true }

function readers({ discs, courses, cases } = {}) {
  return {
    readDiscs: discs ?? vi.fn().mockResolvedValue([{ id: 'disc-1', status: 'in_locker' }]),
    readCourses: courses ?? vi.fn().mockResolvedValue([{ id: 'course-1', name: 'Oak Grove' }]),
    readCases: cases ?? vi.fn().mockResolvedValue({ cases: [QUEUED_CASE], updates: [QUEUED_UPDATE] }),
  }
}

describe('loadLostFoundScreen', () => {
  it('returns discs, courses, and cases when every read succeeds', async () => {
    const screen = await loadLostFoundScreen('user-1', readers())

    expect(screen.cases).toEqual([QUEUED_CASE])
    expect(screen.updates).toEqual([QUEUED_UPDATE])
    expect(screen.discs).toHaveLength(1)
    expect(screen.courses).toHaveLength(1)
    expect(screen.referenceError).toBeNull()
  })

  // The defect: the disc and course reads were network-only and sat in a
  // Promise.all beside the case read, so offline the rejection discarded a case
  // the outbox had durably queued and the screen said nothing existed.
  it('still surfaces a queued case when the disc read fails', async () => {
    const screen = await loadLostFoundScreen('user-1', readers({
      discs: vi.fn().mockRejectedValue(new Error('Failed to fetch')),
    }))

    expect(screen.cases).toEqual([QUEUED_CASE])
    expect(screen.discs).toBeNull()
    expect(screen.referenceError).toBe(LOST_FOUND_REFERENCE_DATA_MESSAGE)
  })

  it('still surfaces a queued case when the course read fails', async () => {
    const screen = await loadLostFoundScreen('user-1', readers({
      courses: vi.fn().mockRejectedValue(new Error('Failed to fetch')),
    }))

    expect(screen.cases).toEqual([QUEUED_CASE])
    expect(screen.courses).toBeNull()
    expect(screen.referenceError).toBe(LOST_FOUND_REFERENCE_DATA_MESSAGE)
  })

  it('still surfaces a queued case when both reference reads fail', async () => {
    const screen = await loadLostFoundScreen('user-1', readers({
      discs: vi.fn().mockRejectedValue(new Error('Failed to fetch')),
      courses: vi.fn().mockRejectedValue(new Error('Failed to fetch')),
    }))

    expect(screen.cases).toEqual([QUEUED_CASE])
    expect(screen.updates).toEqual([QUEUED_UPDATE])
    expect(screen.referenceError).toBe(LOST_FOUND_REFERENCE_DATA_MESSAGE)
  })

  // Reported, never swallowed — E2 audit finding 2. A degraded read has to look
  // different from a clean one.
  it('reports nothing when the reference reads succeed but return empty', async () => {
    const screen = await loadLostFoundScreen('user-1', readers({
      discs: vi.fn().mockResolvedValue([]),
      courses: vi.fn().mockResolvedValue([]),
    }))

    expect(screen.discs).toEqual([])
    expect(screen.courses).toEqual([])
    expect(screen.referenceError).toBeNull()
  })

  it('propagates a case-read failure, so a genuine outage is not shown as an empty history', async () => {
    const failure = new Error('Failed to fetch')

    await expect(
      loadLostFoundScreen('user-1', readers({ cases: vi.fn().mockRejectedValue(failure) })),
    ).rejects.toThrow(failure)
  })

  it('reads every source for the requested user', async () => {
    const injected = readers()
    await loadLostFoundScreen('user-7', injected)

    expect(injected.readDiscs).toHaveBeenCalledWith('user-7')
    expect(injected.readCases).toHaveBeenCalledWith('user-7')
    expect(injected.readCourses).toHaveBeenCalled()
  })
})
