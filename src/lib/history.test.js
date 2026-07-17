import { describe, expect, it } from 'vitest'
import { activityHistoryEntries, sessionAggregate } from './history'

describe('history helpers', () => {
  it('keeps activities canonical and preserves local-only pending rows without inventing facts', () => {
    const entries = activityHistoryEntries({
      activities: [
        {
          id: 'session-1',
          type: 'putting_freeform',
          state: 'completed',
          created_at: '2026-07-12T12:00:00.000Z',
          sync_state: 'pending',
        },
      ],
      sessions: [],
      runs: [],
    })

    expect(entries).toEqual([
      expect.objectContaining({
        id: 'session-1',
        type: 'freeform',
        session: null,
        aggregate: { makes: 0, attempts: 0, minDistance: null, maxDistance: null },
      }),
    ])
  })

  it('aggregates only authoritative summary rows', () => {
    expect(
      sessionAggregate({
        putt_distance_logs: [
          { distance_feet: 15, makes: 7, attempts: 10 },
          { distance_feet: 25, makes: 4, attempts: 10 },
        ],
      }),
    ).toEqual({ makes: 11, attempts: 20, minDistance: 15, maxDistance: 25 })
  })
})
