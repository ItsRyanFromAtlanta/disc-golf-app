// Server-only row contracts for the B1.7 staging persistence boundary.
// This module computes candidate checksums and maps validated envelopes to
// database-shaped rows; it does not issue database, Storage, or canonical writes.

export const CATALOG_RAW_ARTIFACT_BUCKET = 'catalog-import-raw'
export const CATALOG_RAW_ARTIFACT_KIND = 'raw_response'
export const CATALOG_RAW_ARTIFACT_PATH_PATTERN = /^raw\/[a-f0-9]{64}\.raw$/

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const CATALOG_ENTITY_TYPES = Object.freeze([
  'manufacturer',
  'manufacturer_alias',
  'mold',
  'plastic',
  'mold_plastic',
  'run',
  'stamp',
  'source',
  'entity_source',
])
const CATALOG_CONFIDENCE_LEVELS = Object.freeze([
  'unverified',
  'corroborated',
  'manufacturer_verified',
  'admin_verified',
])

function isRecord(value) {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function requiredString(value, field, maxLength = 2048) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`)
  const normalized = value.trim()
  if (normalized.length > maxLength) throw new Error(`${field} exceeds the maximum length`)
  return normalized
}

function normalizeIdentityPart(value, field) {
  return requiredString(String(value), field, 512).toLocaleLowerCase('en-US')
}

function stableStringify(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Stable JSON cannot contain a non-finite number')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }
  throw new TypeError('Stable JSON only supports JSON-compatible values')
}

function catalogIdentityKey(entityType, identity) {
  const parts = Object.entries(identity)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${normalizeIdentityPart(value, key)}`)
  return `${entityType}:${parts.join('|')}`
}

async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') {
    throw new Error('A Web Crypto implementation is required to checksum staged candidates')
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function rawArtifactPathForChecksum(checksum) {
  const normalized = requiredString(checksum, 'rawArtifact.checksum', 64).toLowerCase()
  if (!SHA256_PATTERN.test(normalized)) throw new Error('rawArtifact.checksum must be a SHA-256 hex string')
  return `raw/${normalized}.raw`
}

export function assertChecksumAddressedRawArtifact(rawArtifact, checksum) {
  if (!isRecord(rawArtifact)) throw new TypeError('rawArtifact is required for a new staged batch')
  const normalizedChecksum = requiredString(checksum, 'sourceChecksum', 64).toLowerCase()
  if (!SHA256_PATTERN.test(normalizedChecksum)) throw new Error('sourceChecksum must be a SHA-256 hex string')
  const artifactChecksum = requiredString(rawArtifact.checksum, 'rawArtifact.checksum', 64).toLowerCase()
  const path = requiredString(rawArtifact.path, 'rawArtifact.path', 512).replaceAll('\\', '/')
  if (artifactChecksum !== normalizedChecksum) throw new Error('rawArtifact checksum must match sourceChecksum')
  if (path !== rawArtifactPathForChecksum(normalizedChecksum) || !CATALOG_RAW_ARTIFACT_PATH_PATTERN.test(path)) {
    throw new Error('rawArtifact.path must be checksum-addressed')
  }
  return Object.freeze({ path, checksum: artifactChecksum })
}

export async function normalizeStagedCandidate(candidate, rowNumber) {
  if (!isRecord(candidate)) throw new TypeError('Catalog candidate must be an object')
  if (!Number.isInteger(rowNumber) || rowNumber < 1) throw new Error('Candidate rowNumber must be a positive integer')
  if (!CATALOG_ENTITY_TYPES.includes(candidate.entityType)) {
    throw new Error(`Unsupported catalog entity type: ${candidate.entityType}`)
  }
  if (!isRecord(candidate.identity) || Object.keys(candidate.identity).length === 0) {
    throw new TypeError('Catalog candidate identity must be a non-empty object')
  }
  if (!isRecord(candidate.fields)) throw new TypeError('Catalog candidate fields must be an object')
  if (!Array.isArray(candidate.supportedFields) || candidate.supportedFields.some((field) => typeof field !== 'string')) {
    throw new TypeError('Catalog candidate supportedFields must be an array of strings')
  }

  const supportedFields = candidate.supportedFields.map((field) => requiredString(field, 'supportedField', 256))
  if (new Set(supportedFields).size !== supportedFields.length) {
    throw new Error('Catalog candidate supportedFields must not contain duplicates')
  }
  const fieldKeys = Object.keys(candidate.fields)
  if (supportedFields.length !== fieldKeys.length || supportedFields.some((field) => !fieldKeys.includes(field))) {
    throw new Error('Catalog candidate supportedFields must exactly describe fields')
  }

  const identityKey = requiredString(candidate.identityKey, 'candidate.identityKey', 1024)
  const expectedIdentityKey = catalogIdentityKey(candidate.entityType, candidate.identity)
  if (identityKey !== expectedIdentityKey) throw new Error('Catalog candidate identityKey does not match identity')

  const normalized = {
    entityType: candidate.entityType,
    identity: candidate.identity,
    identityKey,
    fields: candidate.fields,
    supportedFields,
    sourceReference: requiredString(candidate.sourceReference, 'candidate.sourceReference', 2048),
    evidenceSnapshot: candidate.evidenceSnapshot,
    confidence: candidate.confidence,
  }
  if (!isRecord(normalized.evidenceSnapshot)) {
    throw new TypeError('Catalog candidate evidenceSnapshot must be an object')
  }
  if (!CATALOG_CONFIDENCE_LEVELS.includes(normalized.confidence)) {
    throw new Error(`Unsupported catalog confidence: ${normalized.confidence}`)
  }

  const checksumPayload = {
    ...normalized,
    supportedFields: [...normalized.supportedFields].sort(),
  }
  const candidateChecksum = await sha256Hex(stableStringify(checksumPayload))
  return Object.freeze({ ...normalized, rowNumber, candidateChecksum })
}

export async function normalizeStagedCandidates(candidates) {
  if (!Array.isArray(candidates)) throw new TypeError('Staged candidates must be an array')
  const normalized = await Promise.all(candidates.map((candidate, index) => normalizeStagedCandidate(candidate, index + 1)))
  const identityKeys = new Set()
  for (const candidate of normalized) {
    if (identityKeys.has(candidate.identityKey)) throw new Error(`Duplicate staged identity: ${candidate.identityKey}`)
    identityKeys.add(candidate.identityKey)
  }
  return normalized
}

function requiredBatchId(batchId) {
  return requiredString(batchId, 'importBatchId', 128)
}

export function createArtifactPersistenceRow({ batchId, envelope } = {}) {
  const importBatchId = requiredBatchId(batchId)
  if (!envelope?.fetch || !envelope.rawArtifact) {
    throw new Error('A raw artifact is required to persist a new staged batch')
  }
  const artifact = assertChecksumAddressedRawArtifact(envelope.rawArtifact, envelope.sourceChecksum)
  if (envelope.fetch.notModified) throw new Error('A not-modified response cannot create a new artifact row')
  return {
    import_batch_id: importBatchId,
    source_checksum: envelope.sourceChecksum,
    artifact_kind: CATALOG_RAW_ARTIFACT_KIND,
    storage_bucket: CATALOG_RAW_ARTIFACT_BUCKET,
    storage_path: artifact.path,
    requested_url: envelope.fetch.requestedUrl,
    final_url: envelope.fetch.finalUrl,
    http_status: envelope.fetch.status,
    content_type: envelope.fetch.contentType,
    response_bytes: envelope.fetch.responseBytes,
    etag: envelope.fetch.etag,
    last_modified: envelope.fetch.lastModified,
    redirect_count: envelope.fetch.redirectCount,
    captured_at: envelope.fetch.capturedAt,
  }
}

export function createCandidatePersistenceRows({ batchId, envelope } = {}) {
  const importBatchId = requiredBatchId(batchId)
  if (!Array.isArray(envelope?.candidates)) throw new TypeError('Envelope candidates are required')
  return envelope.candidates.map((candidate) => {
    const rowNumber = candidate.rowNumber
    if (!Number.isInteger(rowNumber) || rowNumber < 1) throw new Error('Normalized candidate rowNumber is required')
    if (!SHA256_PATTERN.test(candidate.candidateChecksum ?? '')) throw new Error('Normalized candidate checksum is required')
    return {
      import_batch_id: importBatchId,
      row_number: rowNumber,
      entity_type: candidate.entityType,
      identity_key: candidate.identityKey,
      identity: candidate.identity,
      normalized_fields: candidate.fields,
      supported_fields: candidate.supportedFields,
      source_reference: candidate.sourceReference,
      evidence_snapshot: candidate.evidenceSnapshot,
      confidence: candidate.confidence,
      candidate_checksum: candidate.candidateChecksum,
      validation_status: 'valid',
      dedup_status: 'new',
      conflict_code: null,
      review_status: 'pending',
    }
  })
}

export function createStagePersistencePayload({ batchId, batch, envelope } = {}) {
  const importBatchId = requiredBatchId(batchId)
  if (!batch || typeof batch !== 'object') throw new TypeError('Batch is required')
  if (batch.status !== 'staged') throw new Error('Only staged batches can enter the staging persistence boundary')
  if (batch.sourceChecksum !== envelope?.sourceChecksum) throw new Error('Batch checksum must match the staged envelope')
  if (batch.rowCount !== envelope?.rowCount) throw new Error('Batch row count must match the staged envelope')
  return {
    batch: { id: importBatchId, ...batch },
    artifact: createArtifactPersistenceRow({ batchId: importBatchId, envelope }),
    candidates: createCandidatePersistenceRows({ batchId: importBatchId, envelope }),
  }
}
