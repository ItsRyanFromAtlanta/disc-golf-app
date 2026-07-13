// Server-only Supabase binding for the catalog staging boundary.
//
// Storage is written before the database transaction because the database
// cannot atomically include an object-store upload. The object path is
// checksum-addressed, non-upserted, and verified on a conflict; if the
// transactional RPC fails after a new upload, this store removes only the
// object created by the current attempt.

import {
  CATALOG_RAW_ARTIFACT_BUCKET,
  createArtifactPersistenceRow,
  createCandidatePersistenceRows,
} from './catalogIngestionPersistence.js'

export const CATALOG_IMPORT_BATCH_SELECT = [
  'id',
  'source_id',
  'adapter_name',
  'adapter_version',
  'source_checksum',
  'status',
  'captured_at',
  'completed_at',
  'row_count',
  'error_summary',
  'created_at',
].join(',')

function isRecord(value) {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function requireFunction(value, field) {
  if (typeof value !== 'function') throw new TypeError(`${field} must be a function`)
  return value
}

function requiredString(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required`)
  return value.trim()
}

function storeError(error, fallbackCode) {
  const message = typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : fallbackCode
  const wrapped = new Error(message)
  wrapped.code = typeof error?.code === 'string' && error.code.trim()
    ? error.code
    : fallbackCode
  wrapped.cause = error
  return wrapped
}

function normalizeBatch(row) {
  if (!row || typeof row !== 'object') return row
  return {
    ...row,
    sourceId: row.sourceId ?? row.source_id,
    adapterName: row.adapterName ?? row.adapter_name,
    adapterVersion: row.adapterVersion ?? row.adapter_version,
    sourceChecksum: row.sourceChecksum ?? row.source_checksum,
    capturedAt: row.capturedAt ?? row.captured_at,
    rowCount: row.rowCount ?? row.row_count,
  }
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('A Web Crypto implementation is required for raw artifact verification')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export { sha256Hex as checksumBytes }

function alreadyExistsError(error) {
  const status = Number(error?.statusCode ?? error?.status ?? 0)
  const message = String(error?.message ?? '').toLowerCase()
  return status === 409 || message.includes('already exists') || message.includes('duplicate') || message.includes('conflict')
}

async function bytesFromStorageData(data) {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (typeof data?.arrayBuffer === 'function') return new Uint8Array(await data.arrayBuffer())
  throw new Error('Storage download did not return readable bytes')
}

async function verifyExistingRawArtifact({ storage, path, checksum }) {
  const { data, error } = await storage.download(path)
  if (error) throw storeError(error, 'catalog_raw_artifact_read_failed')
  const bytes = await bytesFromStorageData(data)
  const actualChecksum = await sha256Hex(bytes)
  if (actualChecksum !== checksum) {
    const error = new Error('The checksum-addressed raw artifact does not match the fetched bytes')
    error.code = 'catalog_raw_artifact_conflict'
    throw error
  }
}

async function uploadRawArtifact({ storage, path, body, checksum, contentType }) {
  const { error } = await storage.upload(path, body, {
    cacheControl: '0',
    contentType: contentType || 'text/plain',
    upsert: false,
  })
  if (!error) return { uploadedNow: true }
  if (!alreadyExistsError(error)) throw storeError(error, 'catalog_raw_artifact_upload_failed')
  await verifyExistingRawArtifact({ storage, path, checksum })
  return { uploadedNow: false }
}

function removeBatchId(row) {
  const copy = { ...row }
  delete copy.import_batch_id
  return copy
}

export function createStageRpcPayload({ source, batch, envelope } = {}) {
  if (!isRecord(source) || !source.id) throw new TypeError('source with id is required')
  if (!isRecord(batch)) throw new TypeError('batch is required')
  if (!isRecord(envelope)) throw new TypeError('envelope is required')

  const artifact = removeBatchId(createArtifactPersistenceRow({
    batchId: 'rpc-boundary',
    envelope,
  }))
  const candidates = createCandidatePersistenceRows({
    batchId: 'rpc-boundary',
    envelope,
  }).map(removeBatchId)

  return Object.freeze({
    p_source_id: requiredString(source.id, 'source.id'),
    p_batch: Object.freeze({
      adapter_name: requiredString(batch.adapterName, 'batch.adapterName'),
      adapter_version: requiredString(batch.adapterVersion, 'batch.adapterVersion'),
      source_checksum: requiredString(batch.sourceChecksum, 'batch.sourceChecksum').toLowerCase(),
      status: requiredString(batch.status, 'batch.status'),
      captured_at: requiredString(batch.capturedAt, 'batch.capturedAt'),
      row_count: batch.rowCount,
    }),
    p_artifact: Object.freeze(artifact),
    p_candidates: Object.freeze(candidates),
  })
}

export function createSupabaseCatalogIngestionStore({
  supabase,
  actorUserId,
  actorPrincipal,
  storage,
} = {}) {
  if (!supabase || typeof supabase !== 'object') throw new TypeError('supabase client is required')
  requireFunction(supabase.rpc, 'supabase.rpc')
  requireFunction(supabase.from, 'supabase.from')
  const storageClient = storage ?? supabase.storage?.from?.(CATALOG_RAW_ARTIFACT_BUCKET)
  if (!storageClient) throw new TypeError('catalog raw Storage client is required')
  requireFunction(storageClient.upload, 'storage.upload')
  requireFunction(storageClient.download, 'storage.download')
  requireFunction(storageClient.remove, 'storage.remove')

  const actor = Object.freeze({
    userId: requiredString(actorUserId, 'actorUserId'),
    principal: requiredString(actorPrincipal, 'actorPrincipal'),
  })

  return Object.freeze({
    async ensureSource(source) {
      const { data, error } = await supabase.rpc('catalog_ensure_source', {
        p_source_type: source?.type,
        p_source_name: source?.name,
        p_source_url: source?.url,
      })
      if (error) throw storeError(error, 'catalog_source_ensure_failed')
      if (typeof data !== 'string' || !data) throw new Error('catalog_ensure_source returned no id')
      return { ...source, id: data }
    },

    async findBatch({ sourceId, adapterName, adapterVersion, sourceChecksum } = {}) {
      const query = supabase
        .from('catalog_import_batches')
        .select(CATALOG_IMPORT_BATCH_SELECT)
        .eq('source_id', sourceId)
        .eq('adapter_name', adapterName)
        .eq('adapter_version', adapterVersion)
        .eq('source_checksum', sourceChecksum)
        .maybeSingle()
      const { data, error } = await query
      if (error) throw storeError(error, 'catalog_batch_lookup_failed')
      return normalizeBatch(data)
    },

    async stageImport({ source, batch, envelope, rawResponseBody } = {}) {
      if (!envelope?.fetch || envelope.fetch.notModified) {
        const error = new Error('A not-modified response cannot be staged without a new raw artifact')
        error.code = 'not_modified_without_new_artifact'
        throw error
      }
      if (!(rawResponseBody instanceof Uint8Array)) {
        throw new TypeError('rawResponseBody must be a Uint8Array')
      }
      if (rawResponseBody.byteLength !== envelope.fetch.responseBytes) {
        const error = new Error('Raw response byte count does not match the fetch envelope')
        error.code = 'catalog_raw_artifact_invalid'
        throw error
      }

      const checksum = requiredString(envelope.sourceChecksum, 'envelope.sourceChecksum').toLowerCase()
      const actualChecksum = await sha256Hex(rawResponseBody)
      if (actualChecksum !== checksum) {
        const error = new Error('Raw response checksum does not match the fetch envelope')
        error.code = 'catalog_raw_artifact_conflict'
        throw error
      }

      const rpcPayload = createStageRpcPayload({ source, batch, envelope })
      const rawPath = rpcPayload.p_artifact.storage_path
      let uploadedNow = false

      try {
        const upload = await uploadRawArtifact({
          storage: storageClient,
          path: rawPath,
          body: rawResponseBody,
          checksum,
          contentType: envelope.fetch.contentType,
        })
        uploadedNow = upload.uploadedNow

        const { data, error } = await supabase.rpc('catalog_stage_import', {
          ...rpcPayload,
          p_actor_user_id: actor.userId,
          p_actor_principal: actor.principal,
        })
        if (error) throw storeError(error, 'catalog_stage_persistence_failed')
        if (!data || typeof data !== 'object' || !data.batch) {
          throw new Error('catalog_stage_import returned no batch')
        }
        return {
          status: data.status ?? 'staged',
          batch: normalizeBatch(data.batch),
        }
      } catch (error) {
        if (uploadedNow) {
          const { error: cleanupError } = await storageClient.remove([rawPath])
          if (cleanupError) console.error('catalog raw artifact cleanup failed', cleanupError.code ?? 'unknown')
        }
        throw error
      }
    },
  })
}
