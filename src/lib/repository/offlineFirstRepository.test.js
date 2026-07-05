import { describe, it, expect, vi } from 'vitest'
import { readThroughCache, writeThrough, flushOutbox } from './offlineFirstRepository'

// Minimal in-memory stand-in for the subset of the Dexie Table API this
// module uses — keeps these tests framework-free, matching the rest of lib/.
function fakeTable(initialRows = []) {
  let rows = [...initialRows]
  let nextId = 1
  return {
    toArray: async () => [...rows],
    bulkPut: async (newRows) => {
      for (const row of newRows) {
        const i = rows.findIndex((r) => r.id === row.id)
        if (i >= 0) rows[i] = row
        else rows.push(row)
      }
    },
    add: async (row) => {
      const id = nextId++
      rows.push({ id, ...row })
      return id
    },
    delete: async (id) => {
      rows = rows.filter((r) => r.id !== id)
    },
    bulkDelete: async (ids) => {
      const idSet = new Set(ids)
      rows = rows.filter((r) => !idSet.has(r.id))
    },
  }
}

describe('readThroughCache', () => {
  it('returns remote data and mirrors it into the cache on success', async () => {
    const cache = fakeTable()
    const remote = [{ id: 'a' }, { id: 'b' }]
    const result = await readThroughCache(cache, async () => remote)
    expect(result).toEqual(remote)
    expect(await cache.toArray()).toEqual(remote)
  })

  it('falls back to cached rows when the remote fetch fails', async () => {
    const cached = [{ id: 'a' }]
    const cache = fakeTable(cached)
    const result = await readThroughCache(cache, async () => {
      throw new Error('offline')
    })
    expect(result).toEqual(cached)
  })

  it('rethrows when the remote fetch fails and nothing is cached', async () => {
    const cache = fakeTable()
    await expect(
      readThroughCache(cache, async () => {
        throw new Error('offline')
      }),
    ).rejects.toThrow('offline')
  })

  it('prunes cached rows that are absent from a successful remote result', async () => {
    const cache = fakeTable([{ id: 'a' }, { id: 'b' }])
    const remote = [{ id: 'a' }] // 'b' was deleted/moved elsewhere
    const result = await readThroughCache(cache, async () => remote)
    expect(result).toEqual(remote)
    expect(await cache.toArray()).toEqual(remote)
  })

  it('clears the cache entirely when the remote result is now empty', async () => {
    const cache = fakeTable([{ id: 'a' }])
    const result = await readThroughCache(cache, async () => [])
    expect(result).toEqual([])
    expect(await cache.toArray()).toEqual([])
  })
})

describe('writeThrough', () => {
  it('queues then clears the outbox entry on a successful remote write', async () => {
    const outbox = fakeTable()
    const result = await writeThrough({
      outboxTable: outbox,
      entityName: 'discs',
      op: 'create',
      payload: { name: 'Aviar' },
      remoteFn: async (p) => ({ id: 'x', ...p }),
    })
    expect(result).toEqual({ id: 'x', name: 'Aviar' })
    expect(await outbox.toArray()).toEqual([])
  })

  it('leaves the outbox entry queued when the remote write fails', async () => {
    const outbox = fakeTable()
    await expect(
      writeThrough({
        outboxTable: outbox,
        entityName: 'discs',
        op: 'create',
        payload: { name: 'Aviar' },
        remoteFn: async () => {
          throw new Error('offline')
        },
      }),
    ).rejects.toThrow('offline')

    const pending = await outbox.toArray()
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({ table: 'discs', op: 'create', payload: { name: 'Aviar' } })
  })
})

describe('flushOutbox', () => {
  it('replays and clears queued entries that now succeed', async () => {
    const outbox = fakeTable([{ id: 1, table: 'discs', op: 'create', payload: { name: 'Aviar' } }])
    const remoteFns = { create: vi.fn(async (p) => ({ id: 'x', ...p })) }

    await flushOutbox({ outboxTable: outbox, entityName: 'discs', remoteFns })

    expect(remoteFns.create).toHaveBeenCalledWith({ name: 'Aviar' })
    expect(await outbox.toArray()).toEqual([])
  })

  it('leaves an entry queued when the retry still fails', async () => {
    const outbox = fakeTable([{ id: 1, table: 'discs', op: 'create', payload: {} }])
    const remoteFns = {
      create: async () => {
        throw new Error('still offline')
      },
    }

    await flushOutbox({ outboxTable: outbox, entityName: 'discs', remoteFns })

    expect(await outbox.toArray()).toHaveLength(1)
  })

  it('only replays entries belonging to the given entity', async () => {
    const outbox = fakeTable([
      { id: 1, table: 'discs', op: 'create', payload: {} },
      { id: 2, table: 'bags', op: 'create', payload: {} },
    ])
    const remoteFns = { create: vi.fn(async () => ({})) }

    await flushOutbox({ outboxTable: outbox, entityName: 'discs', remoteFns })

    expect(remoteFns.create).toHaveBeenCalledTimes(1)
    const remaining = await outbox.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].table).toBe('bags')
  })
})
