import { describe, expect, it, vi } from 'vitest'
import {
  createStagePersistencePayload,
  rawArtifactPathForChecksum,
} from './catalogIngestionPersistence.js'
import {
  MVP_OFFICIAL_ADAPTER_KEY,
  MVP_OFFICIAL_ADAPTER_VERSION,
  MVP_OFFICIAL_PAYLOAD,
  MVP_OFFICIAL_SOURCE,
} from './adapters/mvpCatalogAdapter.js'
import {
  MVP_CATALOG_SOURCE_POLICY,
  stageMvpCatalogIngestion,
} from './mvpCatalogStaging.js'

const SOURCE_CHECKSUM = 'c'.repeat(64)
const CAPTURED_AT = '2026-07-12T23:30:00.000Z'

const request = {
  jobId: 'mvp-stage-1',
  adapterKey: MVP_OFFICIAL_ADAPTER_KEY,
  adapterVersion: MVP_OFFICIAL_ADAPTER_VERSION,
  mode: 'stage',
  source: MVP_OFFICIAL_SOURCE,
}

function createHarness({ existing = null, status = 200 } = {}) {
  const persisted = { batch: null, artifact: null, candidates: [] }
  const fetcher = {
    fetch: vi.fn(async () => ({
      envelope: {
        requestedUrl: MVP_OFFICIAL_SOURCE.url,
        finalUrl: MVP_OFFICIAL_SOURCE.url,
        status,
        contentType: 'application/json',
        responseBytes: status === 304 ? 0 : 4096,
        capturedAt: CAPTURED_AT,
        rawChecksum: SOURCE_CHECKSUM,
        notModified: status === 304,
      },
      ...(status === 304
        ? {}
        : {
            payload: MVP_OFFICIAL_PAYLOAD,
            rawResponseBody: new Uint8Array([1, 2, 3]),
            rawArtifact: {
              path: rawArtifactPathForChecksum(SOURCE_CHECKSUM),
              checksum: SOURCE_CHECKSUM,
            },
          }),
    })),
  }
  const store = {
    ensureSource: vi.fn(async (source) => ({ ...source, id: 'source-mvp' })),
    findBatch: vi.fn(async () => existing),
    stageImport: vi.fn(async ({ batch, envelope }) => {
      const rows = await createStagePersistencePayload({
        batchId: 'batch-mvp-1',
        batch,
        envelope,
      })
      persisted.batch = rows.batch
      persisted.artifact = rows.artifact
      persisted.candidates = rows.candidates
      return { batch: rows.batch }
    }),
  }
  return { fetcher, store, persisted }
}

describe('official MVP staging composition', () => {
  it('wires the official adapter through injected fetch and persistence boundaries', async () => {
    const harness = createHarness()
    let persistedRawResponseBody
    harness.store.stageImport.mockImplementationOnce(async ({ batch, envelope, rawResponseBody }) => {
      persistedRawResponseBody = rawResponseBody
      const rows = await createStagePersistencePayload({
        batchId: 'batch-mvp-1',
        batch,
        envelope,
      })
      harness.persisted.batch = rows.batch
      harness.persisted.artifact = rows.artifact
      harness.persisted.candidates = rows.candidates
      return { batch: rows.batch }
    })
    const result = await stageMvpCatalogIngestion({
      request,
      fetcher: harness.fetcher,
      store: harness.store,
    })

    expect(result).toMatchObject({
      status: 'staged',
      batch: {
        id: 'batch-mvp-1',
        status: 'staged',
        rowCount: 4,
        sourceChecksum: SOURCE_CHECKSUM,
      },
      envelope: {
        adapterKey: MVP_OFFICIAL_ADAPTER_KEY,
        adapterVersion: MVP_OFFICIAL_ADAPTER_VERSION,
        sourceChecksum: SOURCE_CHECKSUM,
        rowCount: 4,
      },
    })
    expect(harness.fetcher.fetch).toHaveBeenCalledWith(expect.objectContaining({
      adapter: expect.objectContaining({ adapterKey: MVP_OFFICIAL_ADAPTER_KEY }),
      policy: MVP_CATALOG_SOURCE_POLICY,
      url: MVP_OFFICIAL_SOURCE.url,
    }))
    expect(harness.persisted.artifact).toMatchObject({
      storage_bucket: 'catalog-import-raw',
      storage_path: `raw/${SOURCE_CHECKSUM}.raw`,
      source_checksum: SOURCE_CHECKSUM,
    })
    expect(harness.persisted.candidates).toHaveLength(4)
    expect(persistedRawResponseBody).toEqual(new Uint8Array([1, 2, 3]))
    expect(harness.persisted.candidates.map(({ identity_key }) => identity_key)).toEqual([
      'mold:manufacturerKey=mvp|moldKey=photon',
      'mold:manufacturerKey=mvp|moldKey=terra',
      'mold:manufacturerKey=mvp|moldKey=volt',
      'mold:manufacturerKey=mvp|moldKey=watt',
    ])
  })

  it('replays an existing checksum batch without another persistence write', async () => {
    const harness = createHarness()
    const first = await stageMvpCatalogIngestion({ request, fetcher: harness.fetcher, store: harness.store })
    const existingBatch = first.batch
    harness.store.findBatch.mockResolvedValue(existingBatch)

    const replay = await stageMvpCatalogIngestion({
      request: { ...request, jobId: 'mvp-stage-replay' },
      fetcher: harness.fetcher,
      store: harness.store,
    })

    expect(replay).toMatchObject({ status: 'existing', batch: existingBatch })
    expect(harness.store.stageImport).toHaveBeenCalledOnce()
  })

  it('rejects a 304 without an existing batch and rejects a version before fetch', async () => {
    const notModified = createHarness({ status: 304 })
    await expect(stageMvpCatalogIngestion({
      request,
      fetcher: notModified.fetcher,
      store: notModified.store,
    })).rejects.toMatchObject({ code: 'not_modified_without_existing_batch' })

    const versionMismatch = createHarness()
    await expect(stageMvpCatalogIngestion({
      request: { ...request, adapterVersion: '9.9.9' },
      fetcher: versionMismatch.fetcher,
      store: versionMismatch.store,
    })).rejects.toMatchObject({ code: 'adapter_version_mismatch' })
    expect(versionMismatch.fetcher.fetch).not.toHaveBeenCalled()
    expect(versionMismatch.store.ensureSource).not.toHaveBeenCalled()
  })
})
