import {
  CATALOG_CONFIDENCE_LEVELS,
  CATALOG_SOURCE_TYPES,
  isPlainObject,
  normalizeAdapterKey,
  normalizeCatalogText,
  normalizeIdentityPart,
  stableStringify,
  validateCatalogCandidate,
} from './catalogContracts'

export const MANUFACTURER_ADAPTER_CONTRACT_VERSION = 1

function assertVersion(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`)
  return value.trim()
}

function normalizeSource(source, sourceType) {
  if (!isPlainObject(source)) throw new TypeError('Adapter source must be an object')
  const name = normalizeCatalogText(source.name, 'source.name')
  const type = source.type ?? sourceType
  if (typeof type !== 'string' || !type.trim()) throw new Error('source.type is required')
  if (!CATALOG_SOURCE_TYPES.includes(type.trim())) throw new Error(`Unsupported source.type: ${type}`)
  if (source.url !== undefined && source.url !== null && typeof source.url !== 'string') {
    throw new TypeError('source.url must be a string when provided')
  }
  return {
    id: source.id ?? null,
    type: type.trim(),
    name,
    url: source.url?.trim() || null,
  }
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function checksumPayload(payload) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') {
    throw new Error('A Web Crypto implementation is required to checksum adapter payloads')
  }
  const bytes = new TextEncoder().encode(stableStringify(payload))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return bytesToHex(new Uint8Array(digest))
}

export function defineManufacturerAdapter({
  adapterKey,
  adapterVersion,
  manufacturerName,
  sourceType = 'manufacturer',
  normalize,
}) {
  const key = normalizeAdapterKey(adapterKey)
  const version = assertVersion(adapterVersion, 'adapterVersion')
  const manufacturer = normalizeCatalogText(manufacturerName, 'manufacturerName')
  if (typeof normalize !== 'function') throw new TypeError('normalize must be a function')
  if (typeof sourceType !== 'string' || !sourceType.trim()) throw new Error('sourceType is required')
  if (!CATALOG_SOURCE_TYPES.includes(sourceType.trim())) throw new Error(`Unsupported sourceType: ${sourceType}`)

  return Object.freeze({
    contractVersion: MANUFACTURER_ADAPTER_CONTRACT_VERSION,
    adapterKey: key,
    adapterVersion: version,
    manufacturerName: manufacturer,
    manufacturerKey: normalizeIdentityPart(manufacturer, 'manufacturerName'),
    sourceType: sourceType.trim(),
    normalize,
  })
}

export async function runManufacturerAdapter(adapter, { payload, source, capturedAt, sourceChecksum } = {}) {
  if (!adapter || adapter.contractVersion !== MANUFACTURER_ADAPTER_CONTRACT_VERSION) {
    throw new Error('Unsupported manufacturer adapter contract')
  }
  if (capturedAt === undefined || Number.isNaN(Date.parse(capturedAt))) {
    throw new Error('capturedAt must be an ISO-compatible timestamp')
  }
  if (payload === undefined) throw new Error('payload is required')
  const normalizedSource = normalizeSource(source, adapter.sourceType)
  const checksum = sourceChecksum ?? (await checksumPayload(payload))
  if (typeof checksum !== 'string' || !/^[a-f0-9]{64}$/i.test(checksum)) {
    throw new Error('sourceChecksum must be a SHA-256 hex string')
  }

  const candidates = await adapter.normalize(payload, {
    adapterKey: adapter.adapterKey,
    adapterVersion: adapter.adapterVersion,
    manufacturerName: adapter.manufacturerName,
    manufacturerKey: adapter.manufacturerKey,
    source: normalizedSource,
    capturedAt,
  })
  if (!Array.isArray(candidates)) throw new TypeError('Adapter normalize must return an array')

  const validated = candidates.map((candidate) =>
    validateCatalogCandidate(candidate, { manufacturerKey: adapter.manufacturerKey }),
  )
  const identityKeys = new Set()
  for (const candidate of validated) {
    if (identityKeys.has(candidate.identityKey)) {
      throw new Error(`Adapter emitted duplicate identity: ${candidate.identityKey}`)
    }
    identityKeys.add(candidate.identityKey)
  }

  return Object.freeze({
    contractVersion: MANUFACTURER_ADAPTER_CONTRACT_VERSION,
    adapterKey: adapter.adapterKey,
    adapterVersion: adapter.adapterVersion,
    source: normalizedSource,
    sourceChecksum: checksum.toLowerCase(),
    capturedAt,
    rowCount: validated.length,
    candidates: validated,
  })
}

export function createManufacturerAdapterRegistry(adapters = []) {
  const registry = new Map()
  for (const adapter of adapters) register(adapter)

  function register(adapter) {
    if (!adapter || adapter.contractVersion !== MANUFACTURER_ADAPTER_CONTRACT_VERSION) {
      throw new Error('Only manufacturer adapters for the current contract can be registered')
    }
    if (registry.has(adapter.adapterKey)) throw new Error(`Adapter already registered: ${adapter.adapterKey}`)
    registry.set(adapter.adapterKey, adapter)
    return adapter
  }

  function get(adapterKey) {
    return registry.get(adapterKey) ?? null
  }

  function list() {
    return [...registry.values()].sort((left, right) => left.adapterKey.localeCompare(right.adapterKey))
  }

  return Object.freeze({ register, get, list })
}

export { CATALOG_CONFIDENCE_LEVELS }
