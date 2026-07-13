import { describe, expect, it, vi } from 'vitest'
import { stageCatalogIngestion } from './catalogIngestionStage.js'

const request = {
  jobId: 'job-1',
  adapterKey: 'mvp-catalog',
  adapterVersion: '1.0.0',
  mode: 'stage',
  source: { type: 'manufacturer', name: 'MVP', url: 'https://mvp.example/catalog' },
}

const fetchEnvelope = {
  requestedUrl: request.source.url,
  finalUrl: request.source.url,
  status: 200,
  contentType: 'application/json',
  responseBytes: 10,
  capturedAt: '2026-07-12T23:00:00.000Z',
  rawChecksum: 'b'.repeat(64),
}

function createHarness({ existing = null, status = 200 } = {}) {
  const adapter = { adapterKey: 'mvp-catalog', adapterVersion: '1.0.0' }
  const runAdapter = vi.fn(async () => ({
    adapterKey: adapter.adapterKey,
    adapterVersion: adapter.adapterVersion,
    source: { ...request.source, id: 'source-1' },
    sourceChecksum: fetchEnvelope.rawChecksum,
    capturedAt: fetchEnvelope.capturedAt,
    candidates: [{
      entityType: 'mold',
      identity: { manufacturerKey: 'mvp', moldKey: 'watt' },
      identityKey: 'mold:manufacturerKey=mvp|moldKey=watt',
      fields: { mold_name: 'Watt' },
      supportedFields: ['mold_name'],
      sourceReference: 'https://mvp.example/catalog/watt',
      evidenceSnapshot: { title: 'Watt' },
      confidence: 'manufacturer_verified',
    }],
  }))
  const fetcher = {
    fetch: vi.fn(async () => ({
      envelope: { ...fetchEnvelope, status, responseBytes: status === 304 ? 0 : fetchEnvelope.responseBytes },
      ...(status === 304 ? {} : { payload: { molds: ['Watt'] } }),
      rawArtifact: { path: `raw/${fetchEnvelope.rawChecksum}.raw`, checksum: fetchEnvelope.rawChecksum },
    })),
  }
  const store = {
    ensureSource: vi.fn(async (source) => ({ ...source, id: 'source-1' })),
    findBatch: vi.fn(async () => existing),
    stageImport: vi.fn(async ({ batch }) => ({ batch: { id: 'batch-1', ...batch } })),
  }
  return { adapter, runAdapter, fetcher, store }
}

describe('catalog ingestion staging orchestrator', () => {
  it('stages a fetched adapter result through one persistence boundary', async () => {
    const harness = createHarness()
    const result = await stageCatalogIngestion({
      request,
      adapterRegistry: { get: vi.fn(() => harness.adapter) },
      resolveSourcePolicy: () => ({ allowedHosts: ['mvp.example'] }),
      fetcher: harness.fetcher,
      runAdapter: harness.runAdapter,
      store: harness.store,
    })

    expect(result).toMatchObject({ status: 'staged', batch: { id: 'batch-1', status: 'staged', rowCount: 1 } })
    expect(harness.runAdapter).toHaveBeenCalledWith(
      harness.adapter,
      expect.objectContaining({ sourceChecksum: fetchEnvelope.rawChecksum }),
    )
    expect(harness.store.stageImport).toHaveBeenCalledOnce()
  })

  it('returns the existing batch without rerunning the adapter or staging writes', async () => {
    const existing = { id: 'batch-existing', status: 'staged' }
    const harness = createHarness({ existing })
    const result = await stageCatalogIngestion({
      request,
      adapterRegistry: { get: () => harness.adapter },
      resolveSourcePolicy: () => ({ allowedHosts: ['mvp.example'] }),
      fetcher: harness.fetcher,
      runAdapter: harness.runAdapter,
      store: harness.store,
    })

    expect(result).toMatchObject({ status: 'existing', batch: existing })
    expect(harness.runAdapter).not.toHaveBeenCalled()
    expect(harness.store.stageImport).not.toHaveBeenCalled()
  })

  it('rejects a 304 response when no prior batch exists', async () => {
    const harness = createHarness({ status: 304 })
    await expect(
      stageCatalogIngestion({
        request,
        adapterRegistry: { get: () => harness.adapter },
        resolveSourcePolicy: () => ({ allowedHosts: ['mvp.example'] }),
        fetcher: harness.fetcher,
        runAdapter: harness.runAdapter,
        store: harness.store,
      }),
    ).rejects.toMatchObject({ code: 'not_modified_without_existing_batch' })
  })

  it('blocks a host before any network or persistence call', async () => {
    const harness = createHarness()
    await expect(
      stageCatalogIngestion({
        request,
        adapterRegistry: { get: () => harness.adapter },
        resolveSourcePolicy: () => ({ allowedHosts: ['other.example'] }),
        fetcher: harness.fetcher,
        runAdapter: harness.runAdapter,
        store: harness.store,
      }),
    ).rejects.toMatchObject({ code: 'host_not_allowlisted' })
    expect(harness.fetcher.fetch).not.toHaveBeenCalled()
    expect(harness.store.ensureSource).not.toHaveBeenCalled()
  })

  it('applies response limits before creating import metadata', async () => {
    const harness = createHarness()
    harness.fetcher.fetch.mockResolvedValueOnce({
      envelope: { ...fetchEnvelope, responseBytes: 6 * 1024 * 1024 },
      payload: { molds: ['Watt'] },
    })

    await expect(
      stageCatalogIngestion({
        request,
        adapterRegistry: { get: () => harness.adapter },
        resolveSourcePolicy: () => ({ allowedHosts: ['mvp.example'] }),
        fetcher: harness.fetcher,
        runAdapter: harness.runAdapter,
        store: harness.store,
      }),
    ).rejects.toMatchObject({ code: 'response_too_large' })
    expect(harness.store.ensureSource).not.toHaveBeenCalled()
  })
})
