export const CATALOG_ENTITY_TYPES = Object.freeze([
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

export const CATALOG_SOURCE_TYPES = Object.freeze([
  'manufacturer',
  'pdga',
  'curated_seed',
  'community',
  'import',
  'other',
])

export const CATALOG_ADAPTER_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const CATALOG_CANONICAL_READ_ENTITIES = Object.freeze([
  'manufacturers',
  'manufacturer_aliases',
  'disc_molds',
  'disc_plastics',
  'disc_mold_plastics',
  'disc_runs',
  'disc_stamps',
  'catalog_sources',
  'catalog_entity_sources',
])

export const CATALOG_CONFIDENCE_LEVELS = Object.freeze([
  'unverified',
  'corroborated',
  'manufacturer_verified',
  'admin_verified',
])

export const CATALOG_SUBMISSION_TYPES = Object.freeze([
  'manufacturer',
  'mold',
  'plastic',
  'mold_plastic',
  'run',
  'stamp',
  'correction',
])

export const CATALOG_EDITABLE_SUBMISSION_STATES = Object.freeze(['draft', 'needs_changes'])
export const CATALOG_SUBMISSION_WRITE_STATES = Object.freeze(['draft', 'needs_changes', 'submitted'])

export function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function normalizeCatalogText(value, field = 'value') {
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`)
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) throw new Error(`${field} must not be blank`)
  return normalized
}

export function normalizeIdentityPart(value, field = 'identity') {
  return normalizeCatalogText(value, field).toLocaleLowerCase('en-US')
}

export function normalizeAdapterKey(value, field = 'adapterKey') {
  const normalized = normalizeCatalogText(value, field)
  if (!CATALOG_ADAPTER_KEY_PATTERN.test(normalized)) {
    throw new Error(`${field} must be a lowercase slug`)
  }
  return normalized
}

export function assertCatalogEntityType(entityType) {
  if (!CATALOG_ENTITY_TYPES.includes(entityType)) {
    throw new Error(`Unsupported catalog entity type: ${entityType}`)
  }
  return entityType
}

export function catalogIdentityKey(entityType, identity) {
  assertCatalogEntityType(entityType)
  if (!isPlainObject(identity) || Object.keys(identity).length === 0) {
    throw new TypeError('Catalog identity must be a non-empty object')
  }

  const parts = Object.entries(identity)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${normalizeIdentityPart(String(value), key)}`)
  return `${entityType}:${parts.join('|')}`
}

export function stableStringify(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Stable JSON cannot contain a non-finite number')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }
  throw new TypeError('Stable JSON only supports JSON-compatible values')
}

export function validateCatalogCandidate(candidate, { manufacturerKey } = {}) {
  if (!isPlainObject(candidate)) throw new TypeError('Catalog candidate must be an object')
  assertCatalogEntityType(candidate.entityType)
  if (!isPlainObject(candidate.identity) || Object.keys(candidate.identity).length === 0) {
    throw new TypeError('Catalog candidate identity must be a non-empty object')
  }
  if (!isPlainObject(candidate.fields)) throw new TypeError('Catalog candidate fields must be an object')
  if (!Array.isArray(candidate.supportedFields) || candidate.supportedFields.some((field) => typeof field !== 'string')) {
    throw new TypeError('Catalog candidate supportedFields must be an array of strings')
  }
  const supportedFields = [...new Set(candidate.supportedFields)]
  const fieldKeys = Object.keys(candidate.fields)
  if (supportedFields.length !== fieldKeys.length || supportedFields.some((field) => !fieldKeys.includes(field))) {
    throw new Error('Catalog candidate supportedFields must exactly describe fields')
  }
  if (typeof candidate.sourceReference !== 'string' || !candidate.sourceReference.trim()) {
    throw new Error('Catalog candidate sourceReference is required')
  }
  if (!isPlainObject(candidate.evidenceSnapshot)) {
    throw new TypeError('Catalog candidate evidenceSnapshot must be an object')
  }
  if (!CATALOG_CONFIDENCE_LEVELS.includes(candidate.confidence)) {
    throw new Error(`Unsupported catalog confidence: ${candidate.confidence}`)
  }
  const identityKey = catalogIdentityKey(candidate.entityType, candidate.identity)
  if (manufacturerKey) {
    const candidateManufacturer = candidate.identity.manufacturerKey
    if (!candidateManufacturer || normalizeIdentityPart(String(candidateManufacturer), 'manufacturerKey') !== manufacturerKey) {
      throw new Error('Catalog candidate manufacturer does not match the adapter')
    }
  }

  return {
    entityType: candidate.entityType,
    identity: { ...candidate.identity },
    identityKey,
    fields: { ...candidate.fields },
    supportedFields,
    sourceReference: candidate.sourceReference.trim(),
    evidenceSnapshot: { ...candidate.evidenceSnapshot },
    confidence: candidate.confidence,
  }
}
