// Framework-free contracts for the protected catalog-ingestion function.

import { normalizeIngestionJobRequest } from './catalogIngestionContracts.js'

const SAFE_ERROR_CODES = new Set([
  'catalog_admin_required',
  'catalog_admin_auth_required',
  'catalog_ingestion_request_invalid',
  'catalog_stage_request_invalid',
  'catalog_raw_artifact_invalid',
  'catalog_raw_artifact_conflict',
  'catalog_raw_artifact_upload_failed',
  'catalog_raw_artifact_read_failed',
  'catalog_stage_persistence_failed',
  'catalog_source_ensure_failed',
  'catalog_batch_lookup_failed',
  'catalog_unsupported_candidate_type',
  'adapter_version_mismatch',
  'unsupported_mvp_adapter_request',
  'not_modified_without_existing_batch',
  'not_modified_without_new_artifact',
  'not_modified_without_conditional_request',
  'https_required',
  'url_credentials_forbidden',
  'url_port_forbidden',
  'host_forbidden',
  'host_allowlist_required',
  'host_not_allowlisted',
  'response_metadata_invalid',
  'response_too_large',
  'too_many_redirects',
  'content_type_not_allowed',
  'fetch_timeout',
  'fetch_failed',
  'redirect_target_invalid',
  'redirect_target_not_allowlisted',
  'product_page_invalid',
])

function safeErrorCode(error) {
  const candidates = [error?.code, error?.message]
  return candidates.find((candidate) => typeof candidate === 'string' && SAFE_ERROR_CODES.has(candidate))
    ?? 'catalog_ingestion_failed'
}

function statusForCode(code) {
  if (code === 'catalog_admin_auth_required') return 401
  if (code === 'catalog_admin_required') return 403
  if (
    code.includes('conflict')
    || code.includes('existing_batch')
    || code.includes('new_artifact')
    || code.includes('persistence')
  ) return 409
  if (
    code.endsWith('_invalid')
    || code.includes('required')
    || code.includes('allowlist')
    || code.includes('forbidden')
    || code.includes('not_allowed')
    || code.includes('mismatch')
    || code.includes('unsupported')
  ) return 400
  if (code === 'catalog_ingestion_failed') return 500
  return 502
}

export const CATALOG_INGESTION_CORS_HEADERS = Object.freeze({
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
})

export function catalogIngestionErrorResponse(error) {
  const code = safeErrorCode(error)
  return Object.freeze({
    status: statusForCode(code),
    body: Object.freeze({ error: code }),
  })
}

export function normalizeCatalogIngestionRequest(body) {
  try {
    return normalizeIngestionJobRequest(body)
  } catch {
    const error = new Error('catalog_ingestion_request_invalid')
    error.code = 'catalog_ingestion_request_invalid'
    throw error
  }
}

function invalidCrawlRequest() {
  const error = new Error('catalog_ingestion_request_invalid')
  error.code = 'catalog_ingestion_request_invalid'
  return error
}

export function normalizeCatalogCrawlRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalidCrawlRequest()
  const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
  if (!jobId || jobId.length > 128) throw invalidCrawlRequest()
  return Object.freeze({ jobId })
}

export function summarizeCatalogIngestionResult(result) {
  const batch = result?.batch ?? {}
  return Object.freeze({
    status: result?.status ?? 'staged',
    batchId: batch.id ?? null,
    sourceChecksum: result?.envelope?.sourceChecksum
      ?? batch.sourceChecksum
      ?? batch.source_checksum
      ?? null,
    rowCount: result?.envelope?.rowCount
      ?? batch.rowCount
      ?? batch.row_count
      ?? null,
  })
}
