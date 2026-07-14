import { describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
vi.mock('./supabaseClient', () => ({
  supabase: { functions: { invoke } },
}))

const {
  listStagedBatches,
  listStagedCandidates,
  reviewCandidate,
  promoteBatch,
} = await import('./catalogAdmin.js')

describe('catalogAdmin client', () => {
  it('lists staged batches', async () => {
    invoke.mockResolvedValueOnce({ data: { result: [{ id: 'batch-1' }] }, error: null })
    const result = await listStagedBatches()

    expect(invoke).toHaveBeenCalledWith('catalog-ingestion-admin', { body: { operation: 'list_batches' } })
    expect(result).toEqual([{ id: 'batch-1' }])
  })

  it('lists staged candidates for a batch', async () => {
    invoke.mockResolvedValueOnce({ data: { result: [{ id: 'candidate-1' }] }, error: null })
    await listStagedCandidates('batch-1')

    expect(invoke).toHaveBeenCalledWith('catalog-ingestion-admin', {
      body: { operation: 'list_candidates', batchId: 'batch-1' },
    })
  })

  it('submits a candidate review decision', async () => {
    invoke.mockResolvedValueOnce({ data: { result: { status: 'approved' } }, error: null })
    await reviewCandidate({ candidateId: 'candidate-1', decision: 'approved', reason: 'matches source' })

    expect(invoke).toHaveBeenCalledWith('catalog-ingestion-admin', {
      body: { operation: 'review', candidateId: 'candidate-1', decision: 'approved', reason: 'matches source' },
    })
  })

  it('promotes a batch', async () => {
    invoke.mockResolvedValueOnce({ data: { result: { status: 'accepted' } }, error: null })
    await promoteBatch('batch-1')

    expect(invoke).toHaveBeenCalledWith('catalog-ingestion-admin', {
      body: { operation: 'promote', batchId: 'batch-1' },
    })
  })

  it('extracts the safe error code from a non-2xx response', async () => {
    const error = {
      context: { json: vi.fn(async () => ({ error: 'catalog_admin_required' })) },
    }
    invoke.mockResolvedValueOnce({ data: null, error })

    await expect(listStagedBatches()).rejects.toMatchObject({ code: 'catalog_admin_required' })
  })

  it('falls back to a generic error code when the response body is unreadable', async () => {
    const error = { context: { json: vi.fn(async () => { throw new Error('not json') }) } }
    invoke.mockResolvedValueOnce({ data: null, error })

    await expect(listStagedBatches()).rejects.toMatchObject({ code: 'catalog_admin_operation_failed' })
  })
})
