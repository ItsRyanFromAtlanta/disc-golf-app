import { describe, it, expect, vi, beforeEach } from 'vitest'

// storage.js touches localStorage (absent under this repo's node vitest), and
// supabaseSync.js hits the network — both are mocked so flushOutbox's routing
// and dequeue logic can be exercised in isolation.
const syncRows = vi.fn()
let currentState

vi.mock('./supabaseSync', () => ({ syncRows: (...args) => syncRows(...args) }))
vi.mock('./storage', () => ({
  readInstantLaunchState: () => currentState,
  updateInstantLaunchState: (applyFn, ...args) => {
    currentState = applyFn(currentState, ...args)
    return currentState
  },
}))

import { flushOutbox, pendingWriteCount } from './flushOutbox'

function stateWith(outbox) {
  return { outbox: { parentWrites: [], summaryWrites: [], puttEvents: [], ...outbox } }
}

beforeEach(() => {
  syncRows.mockReset()
})

describe('pendingWriteCount', () => {
  it('sums the three outbox arrays', () => {
    expect(pendingWriteCount({ parentWrites: [1], summaryWrites: [2, 3], puttEvents: [] })).toBe(3)
    expect(pendingWriteCount(null)).toBe(0)
  })
})

describe('flushOutbox', () => {
  it('routes each tagged row to its table and dequeues successes', async () => {
    currentState = stateWith({
      parentWrites: [{ id: 'p1', _op: 'insert', _table: 'putt_sessions' }],
      summaryWrites: [{ id: 's1', _op: 'insert', _table: 'putt_distance_logs' }],
      puttEvents: [{ id: 'e1', _op: 'insert' }], // untagged putt event still routes via fallback
    })
    syncRows.mockImplementation((table, rows) => ({
      succeededIds: rows.map((r) => r.id),
      permanentFailureIds: [],
    }))

    const result = await flushOutbox()

    expect(syncRows).toHaveBeenCalledWith('putt_sessions', [{ id: 'p1', _op: 'insert', _table: 'putt_sessions' }])
    expect(syncRows).toHaveBeenCalledWith('putt_distance_logs', expect.any(Array))
    expect(syncRows).toHaveBeenCalledWith('putt_events', [{ id: 'e1', _op: 'insert' }])
    expect(result.pending).toBe(0)
    expect(result.untaggedRemaining).toBe(0)
    expect(result.hadError).toBe(false)
  })

  it('leaves untagged parent/summary rows in the outbox and flags them', async () => {
    currentState = stateWith({
      parentWrites: [{ id: 'legacy', _op: 'update' }], // no _table tag
    })

    const result = await flushOutbox()

    expect(syncRows).not.toHaveBeenCalled()
    expect(result.untaggedRemaining).toBe(1)
    expect(result.pending).toBe(1)
  })

  it('keeps transiently-failed rows pending and reports hadError', async () => {
    currentState = stateWith({
      parentWrites: [{ id: 'p1', _op: 'insert', _table: 'putt_sessions' }],
    })
    syncRows.mockResolvedValue({ succeededIds: [], permanentFailureIds: [] })

    const result = await flushOutbox()

    expect(result.hadError).toBe(true)
    expect(result.pending).toBe(1)
  })
})
