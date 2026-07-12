import { describe, expect, it, vi } from 'vitest'
import { createCatalogRepository } from './catalogRepository'

function fakeTable(initialRows = []) {
  let rows = [...initialRows]
  let nextId = 1
  return {
    toArray: async () => [...rows],
    bulkPut: async (nextRows) => {
      for (const row of nextRows) {
        const index = rows.findIndex((current) => current.id === row.id)
        if (index >= 0) rows[index] = row
        else rows.push(row)
      }
    },
    add: async (row) => {
      const id = nextId++
      rows.push({ id, ...row })
      return id
    },
    delete: async (id) => {
      rows = rows.filter((row) => row.id !== id)
    },
    bulkDelete: async (ids) => {
      const idSet = new Set(ids)
      rows = rows.filter((row) => !idSet.has(row.id))
    },
    put: async (row) => {
      const index = rows.findIndex((current) => current.id === row.id)
      if (index >= 0) rows[index] = row
      else rows.push(row)
    },
    rows: () => rows,
  }
}

function createHarness() {
  const outbox = fakeTable()
  const cache = fakeTable([{ id: 'stale' }])
  const remote = {
    listCanonical: vi.fn(async () => [{ id: 'mold-1' }]),
    listConfigurations: vi.fn(async () => []),
    listSubmissions: vi.fn(async () => []),
    listEvidence: vi.fn(async () => []),
    createConfiguration: vi.fn(async (payload) => ({ ...payload, updated_at: 'now' })),
    updateConfiguration: vi.fn(async (payload) => payload),
    removeConfiguration: vi.fn(async () => ({ removed: true })),
    createSubmission: vi.fn(async (payload) => payload),
    updateSubmission: vi.fn(async (payload) => payload),
    createEvidence: vi.fn(async (payload) => payload),
    updateEvidence: vi.fn(async (payload) => payload),
    removeEvidence: vi.fn(async () => ({ removed: true })),
  }
  const repository = createCatalogRepository({
    outboxTable: outbox,
    remote,
    idFactory: vi.fn(() => 'generated-id'),
    cacheTables: { disc_molds: cache },
  })
  return { repository, remote, outbox, cache }
}

describe('catalog repository contract', () => {
  it('supports canonical reads with cache fallback/pruning', async () => {
    const { repository, remote, cache } = createHarness()
    await expect(repository.listCanonical('disc_molds')).resolves.toEqual([{ id: 'mold-1' }])
    expect(remote.listCanonical).toHaveBeenCalledWith('disc_molds', {})
    expect(cache.rows()).toEqual([{ id: 'mold-1' }])
    await expect(repository.listCanonical('disc_molds')).resolves.toEqual([{ id: 'mold-1' }])
    remote.listCanonical.mockRejectedValueOnce(new Error('offline'))
    await expect(repository.listCanonical('disc_molds')).resolves.toEqual([{ id: 'mold-1' }])
  })

  it('exposes no canonical, import-batch, or review write path', () => {
    const { repository } = createHarness()
    expect(repository.createMold).toBeUndefined()
    expect(repository.createImportBatch).toBeUndefined()
    expect(repository.createReview).toBeUndefined()
    expect(repository.capabilities).toMatchObject({ canonicalWrites: false, importBatchWrites: false, reviewWrites: false })
  })

  it('creates an owned configuration with a stable client id and durable outbox replay', async () => {
    const { repository, remote, outbox } = createHarness()
    const result = await repository.createConfiguration('user-1', { custom_mold: 'My Watt' })
    expect(result).toMatchObject({ id: 'generated-id', user_id: 'user-1', custom_mold: 'My Watt' })
    expect(remote.createConfiguration).toHaveBeenCalledWith({ id: 'generated-id', user_id: 'user-1', custom_mold: 'My Watt' })
    expect(await outbox.toArray()).toEqual([])

    remote.createConfiguration.mockRejectedValueOnce(new Error('offline'))
    await expect(repository.createConfiguration('user-1', { id: 'retry-id', custom_mold: 'Offline Watt' })).rejects.toThrow('offline')
    expect((await outbox.toArray())[0]).toMatchObject({
      table: 'catalog',
      op: 'configuration_create',
      payload: { id: 'retry-id', user_id: 'user-1' },
    })
  })

  it('rejects ownership spoofing and restricts submission identity', async () => {
    const { repository } = createHarness()
    await expect(repository.createConfiguration('user-1', { user_id: 'user-2', custom_mold: 'Spoof' })).rejects.toThrow(
      'cannot change ownership',
    )
    await expect(repository.createSubmission('user-1', { submission_type: 'mold', proposed_payload: {} })).resolves.toMatchObject({
      id: 'generated-id',
      user_id: 'user-1',
      status: 'draft',
    })
    await expect(repository.updateSubmission('user-1', 'submission-1', { id: 'spoof' })).rejects.toThrow('identity is immutable')
    await expect(repository.updateSubmission('user-1', 'submission-1', { status: 'approved' })).rejects.toThrow(
      'Unsupported submission write state',
    )
  })

  it('allows draft evidence writes but leaves server-side state enforcement to RLS', async () => {
    const { repository, remote } = createHarness()
    await expect(
      repository.createEvidence('user-1', 'submission-1', { source_url: 'https://example.test', snapshot: {} }),
    ).resolves.toMatchObject({ id: 'generated-id', user_id: 'user-1', submission_id: 'submission-1' })
    expect(remote.createEvidence).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', submission_id: 'submission-1' }),
    )
  })
})
