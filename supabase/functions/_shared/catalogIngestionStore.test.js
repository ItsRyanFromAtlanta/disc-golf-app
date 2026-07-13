import { describe, expect, it, vi } from 'vitest'
import {
  checksumBytes,
  createStageRpcPayload,
  createSupabaseCatalogIngestionStore,
} from './catalogIngestionStore.js'
import {
  normalizeStagedCandidates,
  rawArtifactPathForChecksum,
} from './catalogIngestionPersistence.js'

const source = {
  id: 'source-mvp',
  type: 'manufacturer',
  name: 'MVP official catalog',
  url: 'https://mvpdiscsports.com/discs/watt/',
}
const actor = {
  userId: '35b59d46-c58d-4193-9de2-f09238c0d009',
  principal: 'admin:35b59d46-c58d-4193-9de2-f09238c0d009',
}

async function fixture() {
  const rawResponseBody = new TextEncoder().encode('<html><h1>Watt</h1></html>')
  const sourceChecksum = await checksumBytes(rawResponseBody)
  const [candidate] = await normalizeStagedCandidates([{
    entityType: 'mold',
    identity: { manufacturerKey: 'mvp', moldKey: 'watt' },
    identityKey: 'mold:manufacturerKey=mvp|moldKey=watt',
    fields: { mold_name: 'Watt', speed: 2 },
    supportedFields: ['mold_name', 'speed'],
    sourceReference: source.url,
    evidenceSnapshot: { sourcePage: source.url },
    confidence: 'manufacturer_verified',
  }])
  const capturedAt = '2026-07-12T22:50:00.000Z'
  return {
    rawResponseBody,
    sourceChecksum,
    envelope: {
      sourceChecksum,
      rowCount: 1,
      fetch: {
        requestedUrl: source.url,
        finalUrl: source.url,
        status: 200,
        contentType: 'text/html',
        responseBytes: rawResponseBody.byteLength,
        etag: 'etag-1',
        lastModified: null,
        redirectCount: 0,
        capturedAt,
        rawChecksum: sourceChecksum,
        notModified: false,
      },
      rawArtifact: {
        path: rawArtifactPathForChecksum(sourceChecksum),
        checksum: sourceChecksum,
      },
      candidates: [candidate],
    },
    batch: {
      adapterName: 'mvp-catalog',
      adapterVersion: '1.0.0',
      sourceChecksum,
      status: 'staged',
      capturedAt,
      rowCount: 1,
    },
  }
}

function createSupabaseHarness({ rpcStageResult, storage } = {}) {
  const rpc = vi.fn(async (functionName) => {
    if (functionName === 'catalog_ensure_source') return { data: source.id, error: null }
    if (functionName === 'catalog_stage_import') {
      return rpcStageResult ?? {
        data: {
          status: 'staged',
          batch: { id: 'batch-1', source_id: source.id, status: 'staged', row_count: 1 },
        },
        error: null,
      }
    }
    return { data: null, error: null }
  })
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
  }
  return {
    supabase: { rpc, from: vi.fn(() => query) },
    rpc,
    query,
    storage: storage ?? {
      upload: vi.fn(async () => ({ data: { path: 'ok' }, error: null })),
      download: vi.fn(async () => ({ data: new Blob(), error: null })),
      remove: vi.fn(async () => ({ data: [], error: null })),
    },
  }
}

describe('Supabase catalog ingestion store', () => {
  it('maps the staged envelope to the service-only RPC payload', async () => {
    const staged = await fixture()
    const payload = createStageRpcPayload({ source, batch: staged.batch, envelope: staged.envelope })

    expect(payload).toMatchObject({
      p_source_id: source.id,
      p_batch: {
        adapter_name: 'mvp-catalog',
        source_checksum: staged.sourceChecksum,
        row_count: 1,
      },
      p_artifact: {
        source_checksum: staged.sourceChecksum,
        storage_path: `raw/${staged.sourceChecksum}.raw`,
      },
    })
    expect(payload.p_artifact).not.toHaveProperty('import_batch_id')
    expect(payload.p_candidates[0]).not.toHaveProperty('import_batch_id')
  })

  it('uploads exact bytes and calls the transactional staging RPC', async () => {
    const staged = await fixture()
    const harness = createSupabaseHarness()
    const store = createSupabaseCatalogIngestionStore({
      supabase: harness.supabase,
      storage: harness.storage,
      actorUserId: actor.userId,
      actorPrincipal: actor.principal,
    })

    const result = await store.stageImport({
      source,
      batch: staged.batch,
      envelope: staged.envelope,
      rawResponseBody: staged.rawResponseBody,
    })

    expect(harness.storage.upload).toHaveBeenCalledWith(
      `raw/${staged.sourceChecksum}.raw`,
      staged.rawResponseBody,
      expect.objectContaining({ upsert: false, contentType: 'text/html' }),
    )
    expect(harness.rpc).toHaveBeenCalledWith('catalog_stage_import', expect.objectContaining({
      p_actor_user_id: actor.userId,
      p_actor_principal: actor.principal,
      p_source_id: source.id,
    }))
    expect(result).toMatchObject({ status: 'staged', batch: { id: 'batch-1', rowCount: 1 } })
  })

  it('verifies an existing checksum-addressed object instead of overwriting it', async () => {
    const staged = await fixture()
    const harness = createSupabaseHarness({
      storage: {
        upload: vi.fn(async () => ({ data: null, error: { statusCode: 409, message: 'Already exists' } })),
        download: vi.fn(async () => ({ data: new Blob([staged.rawResponseBody]), error: null })),
        remove: vi.fn(async () => ({ data: [], error: null })),
      },
    })
    const store = createSupabaseCatalogIngestionStore({
      supabase: harness.supabase,
      storage: harness.storage,
      actorUserId: actor.userId,
      actorPrincipal: actor.principal,
    })

    await store.stageImport({
      source,
      batch: staged.batch,
      envelope: staged.envelope,
      rawResponseBody: staged.rawResponseBody,
    })

    expect(harness.storage.download).toHaveBeenCalledWith(`raw/${staged.sourceChecksum}.raw`)
    expect(harness.storage.remove).not.toHaveBeenCalled()
  })

  it('cleans up a newly uploaded object when the transaction fails', async () => {
    const staged = await fixture()
    const harness = createSupabaseHarness({
      rpcStageResult: { data: null, error: { code: 'catalog_stage_request_invalid', message: 'catalog_stage_request_invalid' } },
    })
    const store = createSupabaseCatalogIngestionStore({
      supabase: harness.supabase,
      storage: harness.storage,
      actorUserId: actor.userId,
      actorPrincipal: actor.principal,
    })

    await expect(store.stageImport({
      source,
      batch: staged.batch,
      envelope: staged.envelope,
      rawResponseBody: staged.rawResponseBody,
    })).rejects.toMatchObject({ code: 'catalog_stage_request_invalid' })
    expect(harness.storage.remove).toHaveBeenCalledWith([`raw/${staged.sourceChecksum}.raw`])
  })

  it('rejects bytes that do not match the fetch envelope before Storage I/O', async () => {
    const staged = await fixture()
    const harness = createSupabaseHarness()
    const store = createSupabaseCatalogIngestionStore({
      supabase: harness.supabase,
      storage: harness.storage,
      actorUserId: actor.userId,
      actorPrincipal: actor.principal,
    })
    const wrongBytes = new TextEncoder().encode('wrong')

    await expect(store.stageImport({
      source,
      batch: staged.batch,
      envelope: staged.envelope,
      rawResponseBody: wrongBytes,
    })).rejects.toMatchObject({ code: 'catalog_raw_artifact_invalid' })
    expect(harness.storage.upload).not.toHaveBeenCalled()
  })

  it('finds the most recent batch and its cache validators for conditional replay', async () => {
    const batchQuery = {
      select: vi.fn(() => batchQuery),
      eq: vi.fn(() => batchQuery),
      order: vi.fn(() => batchQuery),
      limit: vi.fn(() => batchQuery),
      maybeSingle: vi.fn(async () => ({
        data: { id: 'batch-1', source_id: source.id, adapter_name: 'mvp-catalog', adapter_version: '1.0.0', source_checksum: 'e'.repeat(64), status: 'staged', captured_at: '2026-07-12T00:00:00.000Z', row_count: 4 },
        error: null,
      })),
    }
    const artifactQuery = {
      select: vi.fn(() => artifactQuery),
      eq: vi.fn(() => artifactQuery),
      maybeSingle: vi.fn(async () => ({ data: { etag: 'etag-1', last_modified: null }, error: null })),
    }
    const from = vi.fn((table) => (table === 'catalog_import_artifacts' ? artifactQuery : batchQuery))
    const store = createSupabaseCatalogIngestionStore({
      supabase: { rpc: vi.fn(), from },
      storage: createSupabaseHarness().storage,
      actorUserId: actor.userId,
      actorPrincipal: actor.principal,
    })

    const result = await store.findLatestBatch({
      sourceId: source.id,
      adapterName: 'mvp-catalog',
      adapterVersion: '1.0.0',
    })

    expect(batchQuery.order).toHaveBeenCalledWith('captured_at', { ascending: false })
    expect(artifactQuery.eq).toHaveBeenCalledWith('import_batch_id', 'batch-1')
    expect(result).toMatchObject({ id: 'batch-1', sourceChecksum: 'e'.repeat(64), etag: 'etag-1', lastModified: null })
  })

  it('returns null when no prior batch exists for the source and adapter', async () => {
    const batchQuery = {
      select: vi.fn(() => batchQuery),
      eq: vi.fn(() => batchQuery),
      order: vi.fn(() => batchQuery),
      limit: vi.fn(() => batchQuery),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    }
    const from = vi.fn(() => batchQuery)
    const store = createSupabaseCatalogIngestionStore({
      supabase: { rpc: vi.fn(), from },
      storage: createSupabaseHarness().storage,
      actorUserId: actor.userId,
      actorPrincipal: actor.principal,
    })

    const result = await store.findLatestBatch({ sourceId: source.id, adapterName: 'mvp-catalog', adapterVersion: '1.0.0' })

    expect(result).toBeNull()
  })
})
