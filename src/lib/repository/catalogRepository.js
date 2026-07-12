import { readThroughCache, writeThrough } from './offlineFirstRepository'
import {
  CATALOG_CANONICAL_READ_ENTITIES,
  CATALOG_EDITABLE_SUBMISSION_STATES,
  CATALOG_SUBMISSION_TYPES,
  CATALOG_SUBMISSION_WRITE_STATES,
  isPlainObject,
} from '../catalog/catalogContracts'

export const CATALOG_REPOSITORY_ENTITY = 'catalog'
export const CATALOG_REPOSITORY_CAPABILITIES = Object.freeze({
  canonicalReads: true,
  privateConfigurationCrud: true,
  submissionDraftWorkflow: true,
  canonicalWrites: false,
  importBatchWrites: false,
  reviewWrites: false,
})

function requireUserId(userId) {
  if (typeof userId !== 'string' || !userId.trim()) throw new Error('userId is required')
  return userId
}

function requireRemote(remote, method) {
  if (typeof remote?.[method] !== 'function') throw new Error(`Catalog remote is missing ${method}`)
  return remote[method]
}

function assertCanonicalEntity(entity) {
  if (!CATALOG_CANONICAL_READ_ENTITIES.includes(entity)) {
    throw new Error(`Unsupported canonical catalog read: ${entity}`)
  }
}

function ownerPayload(userId, fields) {
  requireUserId(userId)
  if (!isPlainObject(fields)) throw new TypeError('Catalog mutation fields must be an object')
  if (fields.user_id !== undefined && fields.user_id !== userId) {
    throw new Error('Catalog mutation cannot change ownership')
  }
  const rest = { ...fields }
  delete rest.user_id
  return { ...rest, user_id: userId }
}

function createId(idFactory) {
  const id = idFactory()
  if (typeof id !== 'string' || !id) throw new Error('idFactory must return a non-empty string')
  return id
}

function cacheRead(cacheTable, remoteRead) {
  return cacheTable ? readThroughCache(cacheTable, remoteRead) : remoteRead()
}

export function createCatalogRepository({
  cacheTables = {},
  outboxTable,
  remote = {},
  idFactory = () => crypto.randomUUID(),
} = {}) {
  if (!outboxTable) throw new Error('outboxTable is required for catalog writes')

  async function listCanonical(entity, query = {}) {
    assertCanonicalEntity(entity)
    const read = () => requireRemote(remote, 'listCanonical')(entity, query)
    return cacheRead(cacheTables[entity], read)
  }

  async function listConfigurations(userId, query = {}) {
    const owner = requireUserId(userId)
    const read = () => requireRemote(remote, 'listConfigurations')(owner, query)
    return cacheRead(cacheTables.userDiscConfigurations, read)
  }

  async function listSubmissions(userId, query = {}) {
    const owner = requireUserId(userId)
    const read = () => requireRemote(remote, 'listSubmissions')(owner, query)
    return cacheRead(cacheTables.catalogSubmissions, read)
  }

  async function listEvidence(userId, submissionId) {
    const owner = requireUserId(userId)
    if (typeof submissionId !== 'string' || !submissionId) throw new Error('submissionId is required')
    const read = () => requireRemote(remote, 'listEvidence')(owner, submissionId)
    return cacheRead(cacheTables.catalogSubmissionEvidence, read)
  }

  async function write({ op, payload, remoteMethod, cacheTable }) {
    const result = await writeThrough({
      outboxTable,
      entityName: CATALOG_REPOSITORY_ENTITY,
      op,
      payload,
      remoteFn: requireRemote(remote, remoteMethod),
    })
    if (result && cacheTable?.put) await cacheTable.put(result)
    return result
  }

  async function createConfiguration(userId, fields) {
    if (!isPlainObject(fields)) throw new TypeError('Catalog mutation fields must be an object')
    const payload = ownerPayload(userId, { ...fields, id: fields.id ?? createId(idFactory) })
    return write({ op: 'configuration_create', payload, remoteMethod: 'createConfiguration', cacheTable: cacheTables.userDiscConfigurations })
  }

  async function updateConfiguration(userId, configurationId, fields) {
    if (typeof configurationId !== 'string' || !configurationId) throw new Error('configurationId is required')
    if (!isPlainObject(fields)) throw new TypeError('Catalog mutation fields must be an object')
    const payload = ownerPayload(userId, { ...fields, id: configurationId })
    return write({ op: 'configuration_update', payload, remoteMethod: 'updateConfiguration', cacheTable: cacheTables.userDiscConfigurations })
  }

  async function removeConfiguration(userId, configurationId) {
    const owner = requireUserId(userId)
    if (typeof configurationId !== 'string' || !configurationId) throw new Error('configurationId is required')
    const payload = { id: configurationId, user_id: owner }
    const result = await write({ op: 'configuration_remove', payload, remoteMethod: 'removeConfiguration' })
    if (cacheTables.userDiscConfigurations?.delete) await cacheTables.userDiscConfigurations.delete(configurationId)
    return result
  }

  async function createSubmission(userId, { id, submission_type: submissionType, proposed_payload: proposedPayload }) {
    const owner = requireUserId(userId)
    if (!CATALOG_SUBMISSION_TYPES.includes(submissionType)) throw new Error(`Unsupported submission type: ${submissionType}`)
    if (!isPlainObject(proposedPayload)) throw new TypeError('proposed_payload must be an object')
    const payload = {
      id: id ?? createId(idFactory),
      user_id: owner,
      submission_type: submissionType,
      status: 'draft',
      proposed_payload: proposedPayload,
    }
    return write({ op: 'submission_create', payload, remoteMethod: 'createSubmission', cacheTable: cacheTables.catalogSubmissions })
  }

  async function updateSubmission(userId, submissionId, patch) {
    const owner = requireUserId(userId)
    if (typeof submissionId !== 'string' || !submissionId) throw new Error('submissionId is required')
    if (!isPlainObject(patch)) throw new TypeError('submission patch must be an object')
    if (patch.user_id !== undefined || patch.id !== undefined) throw new Error('Submission identity is immutable')
    if (patch.status !== undefined && !CATALOG_SUBMISSION_WRITE_STATES.includes(patch.status)) {
      throw new Error(`Unsupported submission write state: ${patch.status}`)
    }
    if (patch.proposed_payload !== undefined && !isPlainObject(patch.proposed_payload)) {
      throw new TypeError('proposed_payload must be an object')
    }
    const payload = { ...patch, id: submissionId, user_id: owner }
    return write({ op: 'submission_update', payload, remoteMethod: 'updateSubmission', cacheTable: cacheTables.catalogSubmissions })
  }

  async function createEvidence(userId, submissionId, fields) {
    const owner = requireUserId(userId)
    if (typeof submissionId !== 'string' || !submissionId) throw new Error('submissionId is required')
    if (!isPlainObject(fields)) throw new TypeError('evidence fields must be an object')
    const payload = ownerPayload(owner, { ...fields, id: fields.id ?? createId(idFactory), submission_id: submissionId })
    return write({ op: 'evidence_create', payload, remoteMethod: 'createEvidence', cacheTable: cacheTables.catalogSubmissionEvidence })
  }

  async function updateEvidence(userId, evidenceId, fields) {
    const owner = requireUserId(userId)
    if (typeof evidenceId !== 'string' || !evidenceId) throw new Error('evidenceId is required')
    const payload = ownerPayload(owner, { ...fields, id: evidenceId })
    return write({ op: 'evidence_update', payload, remoteMethod: 'updateEvidence', cacheTable: cacheTables.catalogSubmissionEvidence })
  }

  async function removeEvidence(userId, evidenceId) {
    const owner = requireUserId(userId)
    if (typeof evidenceId !== 'string' || !evidenceId) throw new Error('evidenceId is required')
    const payload = { id: evidenceId, user_id: owner }
    const result = await write({ op: 'evidence_remove', payload, remoteMethod: 'removeEvidence' })
    if (cacheTables.catalogSubmissionEvidence?.delete) await cacheTables.catalogSubmissionEvidence.delete(evidenceId)
    return result
  }

  return Object.freeze({
    capabilities: CATALOG_REPOSITORY_CAPABILITIES,
    listCanonical,
    listConfigurations,
    listSubmissions,
    listEvidence,
    createConfiguration,
    updateConfiguration,
    removeConfiguration,
    createSubmission,
    updateSubmission,
    createEvidence,
    updateEvidence,
    removeEvidence,
    editableSubmissionStates: CATALOG_EDITABLE_SUBMISSION_STATES,
  })
}
