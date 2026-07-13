// Framework-free request and authorization contracts for the catalog admin
// Edge Function. The database RPCs remain the only canonical write boundary.

export const CATALOG_ADMIN_OPERATIONS = Object.freeze(['review', 'promote'])
export const CATALOG_REVIEW_DECISIONS = Object.freeze(['approved', 'rejected', 'needs_changes'])

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_ERROR_CODES = new Set([
  'catalog_admin_required',
  'catalog_admin_auth_required',
  'catalog_admin_request_invalid',
  'catalog_review_decision_invalid',
  'catalog_candidate_not_found',
  'catalog_candidate_invalid',
  'catalog_candidate_already_promoted',
  'catalog_batch_not_found',
  'catalog_batch_closed',
  'catalog_batch_not_reviewed',
  'catalog_batch_needs_changes',
  'catalog_artifact_missing',
  'catalog_batch_close_incomplete',
  'catalog_candidate_fields_invalid',
  'catalog_candidate_field_not_allowlisted',
  'catalog_candidate_fields_mismatch',
  'catalog_required_candidate_field',
  'catalog_candidate_numeric_invalid',
  'catalog_candidate_year_invalid',
  'catalog_candidate_date_invalid',
  'catalog_identity_mismatch',
  'catalog_dependency_missing',
  'catalog_canonical_conflict',
  'catalog_unsupported_candidate_type',
  'catalog_promotion_request_invalid',
])

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function requiredString(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('catalog_admin_request_invalid')
  const normalized = value.trim()
  if (normalized.length > maxLength) throw new Error('catalog_admin_request_invalid')
  return normalized
}

function uuid(value) {
  const normalized = requiredString(value, 'id', 64)
  if (!UUID_PATTERN.test(normalized)) throw new Error('catalog_admin_request_invalid')
  return normalized
}

export function adminPrincipalForUser(userId) {
  return `admin:${uuid(userId)}`
}

export function createCatalogAdminRpcCall({ body, userId } = {}) {
  if (!isPlainObject(body)) throw new Error('catalog_admin_request_invalid')
  const operation = requiredString(body.operation, 'operation', 16).toLowerCase()
  const principal = adminPrincipalForUser(userId)

  if (operation === 'review') {
    const decision = requiredString(body.decision, 'decision', 32).toLowerCase()
    if (!CATALOG_REVIEW_DECISIONS.includes(decision)) throw new Error('catalog_review_decision_invalid')
    const reason = requiredString(body.reason, 'reason', 4096)
    return Object.freeze({
      functionName: 'catalog_review_candidate',
      params: {
        p_candidate_id: uuid(body.candidateId),
        p_decision: decision,
        p_reviewer_user_id: uuid(userId),
        p_reviewer_principal: principal,
        p_reason: reason,
      },
    })
  }

  if (operation === 'promote') {
    return Object.freeze({
      functionName: 'catalog_promote_import_batch',
      params: {
        p_import_batch_id: uuid(body.batchId),
        p_promoter_user_id: uuid(userId),
        p_promoter_principal: principal,
      },
    })
  }

  if (!CATALOG_ADMIN_OPERATIONS.includes(operation)) throw new Error('catalog_admin_request_invalid')
  throw new Error('catalog_admin_request_invalid')
}

export function catalogAdminErrorResponse(error) {
  const rawMessage = typeof error?.message === 'string' ? error.message : ''
  const code = SAFE_ERROR_CODES.has(rawMessage) ? rawMessage : 'catalog_admin_operation_failed'
  const status = code === 'catalog_admin_required'
    ? 403
    : code === 'catalog_admin_operation_failed'
      ? 500
      : code.includes('conflict') || code.includes('not_reviewed')
        || code.includes('needs_changes') || code.includes('artifact') || code.includes('incomplete')
        ? 409
        : 400
  return Object.freeze({ status, body: Object.freeze({ error: code }) })
}
