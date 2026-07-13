// Server-only, framework-free ingestion envelopes. These contracts deliberately
// contain no persistence or canonical-write operations.

export const CATALOG_INGESTION_CONTRACT_VERSION = 1
export const CATALOG_INGESTION_MODES = Object.freeze(['stage'])
export const CATALOG_SOURCE_TYPES = Object.freeze([
  'manufacturer',
  'pdga',
  'curated_seed',
  'community',
  'import',
  'other',
])
export const CATALOG_ADAPTER_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/i

function isRecord(value) {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
function requiredString(value, field, { maxLength = 512 } = {}) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`)
  const normalized = value.trim()
  if (normalized.length > maxLength) throw new Error(`${field} exceeds the maximum length`)
  return normalized
}

function optionalString(value, field, { maxLength = 2048 } = {}) {
  if (value === undefined || value === null || value === '') return null
  return requiredString(value, field, { maxLength })
}

function timestamp(value, field) {
  const normalized = requiredString(value, field, { maxLength: 64 })
  if (Number.isNaN(Date.parse(normalized))) throw new Error(`${field} must be an ISO-compatible timestamp`)
  return normalized
}

function httpsUrl(value, field) {
  const normalized = requiredString(value, field, { maxLength: 2048 })
  let url
  try {
    url = new URL(normalized)
  } catch {
    throw new Error(`${field} must be a valid URL`)
  }
  if (url.protocol !== 'https:') throw new Error(`${field} must use HTTPS`)
  if (url.username || url.password) throw new Error(`${field} cannot contain credentials`)
  return normalized
}

function nonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`)
  return value
}

function normalizeAdapterKey(value) {
  const normalized = requiredString(value, 'adapterKey', { maxLength: 96 })
  if (!CATALOG_ADAPTER_KEY_PATTERN.test(normalized)) throw new Error('adapterKey must be a lowercase slug')
  return normalized
}

function normalizeSource(source, field = 'source') {
  if (!isRecord(source)) throw new TypeError(`${field} must be an object`)
  const type = requiredString(source.type, `${field}.type`, { maxLength: 32 })
  if (!CATALOG_SOURCE_TYPES.includes(type)) throw new Error(`Unsupported ${field}.type: ${type}`)
  return {
    id: source.id == null ? null : requiredString(source.id, `${field}.id`, { maxLength: 128 }),
    type,
    name: requiredString(source.name, `${field}.name`, { maxLength: 256 }),
    url: httpsUrl(source.url, `${field}.url`),
  }
}

export function normalizeIngestionJobRequest(request) {
  if (!isRecord(request)) throw new TypeError('Ingestion job request must be an object')
  const mode = requiredString(request.mode ?? 'stage', 'mode', { maxLength: 16 })
  if (!CATALOG_INGESTION_MODES.includes(mode)) throw new Error(`Unsupported ingestion mode: ${mode}`)
  return Object.freeze({
    jobId: requiredString(request.jobId, 'jobId', { maxLength: 128 }),
    adapterKey: normalizeAdapterKey(request.adapterKey),
    adapterVersion: requiredString(request.adapterVersion, 'adapterVersion', { maxLength: 64 }),
    source: Object.freeze(normalizeSource(request.source)),
    mode,
  })
}

export function validateFetchEnvelope(envelope) {
  if (!isRecord(envelope)) throw new TypeError('Fetch envelope must be an object')
  const status = nonNegativeInteger(envelope.status, 'status')
  if (status < 200 || status > 599) throw new Error('status must be an HTTP status')
  const notModified = status === 304
  if (envelope.notModified !== undefined && Boolean(envelope.notModified) !== notModified) {
    throw new Error('notModified must match the HTTP status')
  }
  const responseBytes = nonNegativeInteger(envelope.responseBytes, 'responseBytes')
  const rawChecksum = requiredString(envelope.rawChecksum, 'rawChecksum', { maxLength: 64 }).toLowerCase()
  if (!SHA256_PATTERN.test(rawChecksum)) throw new Error('rawChecksum must be a SHA-256 hex string')
  return Object.freeze({
    requestedUrl: httpsUrl(envelope.requestedUrl, 'requestedUrl'),
    finalUrl: httpsUrl(envelope.finalUrl, 'finalUrl'),
    status,
    contentType: optionalString(envelope.contentType, 'contentType', { maxLength: 128 }),
    responseBytes,
    etag: optionalString(envelope.etag, 'etag', { maxLength: 512 }),
    lastModified: optionalString(envelope.lastModified, 'lastModified', { maxLength: 128 }),
    capturedAt: timestamp(envelope.capturedAt, 'capturedAt'),
    rawChecksum,
    notModified,
    redirectCount: envelope.redirectCount === undefined
      ? 0
      : nonNegativeInteger(envelope.redirectCount, 'redirectCount'),
  })
}

export function createStagedIngestionEnvelope({ request, fetch, adapterRun, rawArtifact = null } = {}) {
  const job = normalizeIngestionJobRequest(request)
  const fetchEnvelope = validateFetchEnvelope(fetch)
  if (!isRecord(adapterRun)) throw new TypeError('adapterRun must be an object')
  if (adapterRun.adapterKey !== job.adapterKey) throw new Error('adapterRun adapterKey does not match the job')
  if (adapterRun.adapterVersion !== job.adapterVersion) throw new Error('adapterRun adapterVersion does not match the job')
  if (String(adapterRun.sourceChecksum ?? '').toLowerCase() !== fetchEnvelope.rawChecksum) {
    throw new Error('adapterRun sourceChecksum must match the fetched artifact')
  }
  if (!Array.isArray(adapterRun.candidates)) throw new TypeError('adapterRun candidates must be an array')

  const source = normalizeSource(adapterRun.source ?? job.source, 'adapterRun.source')
  const capturedAt = timestamp(adapterRun.capturedAt ?? fetchEnvelope.capturedAt, 'capturedAt')
  const artifact = rawArtifact == null
    ? null
    : Object.freeze({
        path: requiredString(rawArtifact.path, 'rawArtifact.path', { maxLength: 512 }),
        checksum: requiredString(rawArtifact.checksum, 'rawArtifact.checksum', { maxLength: 64 }).toLowerCase(),
      })
  if (artifact && artifact.checksum !== fetchEnvelope.rawChecksum) {
    throw new Error('rawArtifact checksum must match the fetched artifact')
  }

  return Object.freeze({
    contractVersion: CATALOG_INGESTION_CONTRACT_VERSION,
    jobId: job.jobId,
    mode: job.mode,
    adapterKey: job.adapterKey,
    adapterVersion: job.adapterVersion,
    source: Object.freeze(source),
    sourceChecksum: fetchEnvelope.rawChecksum,
    capturedAt,
    fetch: fetchEnvelope,
    rowCount: adapterRun.candidates.length,
    candidates: adapterRun.candidates.map((candidate) => ({ ...candidate })),
    rawArtifact: artifact,
  })
}
