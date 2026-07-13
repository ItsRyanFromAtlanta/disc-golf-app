// Server-only staging orchestrator. Dependencies are injected so this module
// can be tested without Supabase, network access, or canonical write authority.

import {
  CATALOG_FETCH_LIMITS,
  assertAllowedRemoteHost,
  validateFetchResponseMetadata,
  validateRemoteUrl,
} from './catalogFetchPolicy.js'
import {
  createStagedIngestionEnvelope,
  normalizeIngestionJobRequest,
  validateFetchEnvelope,
} from './catalogIngestionContracts.js'

function requireFunction(value, field) {
  if (typeof value !== 'function') throw new TypeError(`${field} must be a function`)
  return value
}

function requireObject(value, field) {
  if (!value || typeof value !== 'object') throw new TypeError(`${field} is required`)
  return value
}

export async function stageCatalogIngestion({
  request,
  adapterRegistry,
  resolveSourcePolicy = () => ({ allowedHosts: [] }),
  fetcher,
  runAdapter,
  store,
} = {}) {
  const job = normalizeIngestionJobRequest(request)
  requireObject(adapterRegistry, 'adapterRegistry')
  requireFunction(adapterRegistry.get, 'adapterRegistry.get')
  requireObject(fetcher, 'fetcher')
  requireFunction(fetcher.fetch, 'fetcher.fetch')
  requireFunction(runAdapter, 'runAdapter')
  requireObject(store, 'store')
  requireFunction(store.ensureSource, 'store.ensureSource')
  requireFunction(store.findBatch, 'store.findBatch')
  requireFunction(store.stageImport, 'store.stageImport')

  const adapter = adapterRegistry.get(job.adapterKey)
  if (!adapter) throw new Error(`Unknown manufacturer adapter: ${job.adapterKey}`)

  const policy = await resolveSourcePolicy({ job, adapter })
  const sourceUrl = validateRemoteUrl(job.source.url)
  assertAllowedRemoteHost(new URL(sourceUrl).hostname, policy?.allowedHosts)

  const fetched = await fetcher.fetch({ job, adapter, url: sourceUrl, policy })
  if (!fetched || typeof fetched !== 'object') throw new TypeError('fetcher.fetch must return an object')
  const limits = { ...CATALOG_FETCH_LIMITS, ...(policy?.limits ?? {}) }
  validateFetchResponseMetadata(fetched.envelope, limits)
  const fetchEnvelope = validateFetchEnvelope(fetched.envelope)
  const source = await store.ensureSource({ ...job.source, url: sourceUrl })
  if (!source || typeof source.id !== 'string' || !source.id) throw new Error('store.ensureSource must return a source id')

  const batchKey = Object.freeze({
    sourceId: source.id,
    adapterName: job.adapterKey,
    adapterVersion: job.adapterVersion,
    sourceChecksum: fetchEnvelope.rawChecksum,
  })
  const existing = await store.findBatch(batchKey)
  if (existing) return Object.freeze({ status: 'existing', batch: existing, batchKey })
  if (fetchEnvelope.notModified) {
    const error = new Error('A 304 response cannot stage without an existing batch')
    error.code = 'not_modified_without_existing_batch'
    throw error
  }
  if (!Object.prototype.hasOwnProperty.call(fetched, 'payload')) {
    throw new Error('fetcher.fetch must return a parsed payload for a new batch')
  }

  const adapterRun = await runAdapter(adapter, {
    payload: fetched.payload,
    source,
    capturedAt: fetchEnvelope.capturedAt,
    sourceChecksum: fetchEnvelope.rawChecksum,
  })
  const envelope = createStagedIngestionEnvelope({
    request: job,
    fetch: fetchEnvelope,
    adapterRun,
    rawArtifact: fetched.rawArtifact,
  })
  const batch = {
    ...batchKey,
    jobId: job.jobId,
    status: 'staged',
    capturedAt: envelope.capturedAt,
    rowCount: envelope.rowCount,
  }
  const persisted = await store.stageImport({
    source,
    batch,
    candidates: envelope.candidates,
    rawArtifact: envelope.rawArtifact,
    envelope,
  })

  return Object.freeze({
    status: 'staged',
    batch: persisted?.batch ?? persisted ?? batch,
    envelope,
  })
}
