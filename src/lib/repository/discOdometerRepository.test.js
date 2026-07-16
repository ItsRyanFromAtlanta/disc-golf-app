import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../supabaseClient', () => ({
  supabase: { rpc: vi.fn() },
}))

import { db } from '../db/dexieDb'
import { supabase } from '../supabaseClient'
import { recordDiscOdometerEvent } from './discOdometerRepository'

describe('disc odometer repository', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await db.open()
    await Promise.all([
      db.discOdometerEvents.clear(),
      db.discCosmeticUnlocks.clear(),
      db.discOdometerOutbox.clear(),
      db.discs.clear(),
    ])
  })

  it('caches a successful atomic RPC result and removes its outbox envelope', async () => {
    const event = { id: 'event-1', user_id: 'user-1', disc_id: 'disc-1', metric: 'chain_hits', delta: 1 }
    const disc = { id: 'disc-1', user_id: 'user-1', total_chain_hits: 300, total_throws: 0, total_airballs: 0 }
    const unlocks = [{ id: 'unlock-1', user_id: 'user-1', disc_id: 'disc-1', tier: 'rare', threshold: 300 }]
    supabase.rpc.mockResolvedValue({ data: { event, disc, unlocks }, error: null })

    const result = await recordDiscOdometerEvent({ userId: 'user-1', discId: 'disc-1', metric: 'chain_hits', delta: 1 })

    expect(result.queued).toBe(false)
    expect(supabase.rpc).toHaveBeenCalledWith('record_disc_odometer_event', expect.objectContaining({ p_metric: 'chain_hits', p_delta: 1 }))
    expect(await db.discOdometerOutbox.count()).toBe(0)
    expect(await db.discOdometerEvents.get('event-1')).toEqual(event)
    expect(await db.discCosmeticUnlocks.get('unlock-1')).toEqual(unlocks[0])
    expect(await db.discs.get('disc-1')).toEqual(disc)
  })

  it('retains a failed operation and optimistic immutable event for replay', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'offline' } })

    const result = await recordDiscOdometerEvent({ userId: 'user-1', discId: 'disc-1', metric: 'throws', delta: 10 })

    expect(result.queued).toBe(true)
    expect(await db.discOdometerOutbox.count()).toBe(1)
    expect(await db.discOdometerEvents.count()).toBe(1)
    expect((await db.discOdometerEvents.toArray())[0]).toMatchObject({ metric: 'throws', delta: 10, pending: true })
  })
})
