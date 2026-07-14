import { supabase } from './supabaseClient'

async function callCatalogAdmin(operation, params = {}) {
  const { data, error } = await supabase.functions.invoke('catalog-ingestion-admin', {
    body: { operation, ...params },
  })
  if (error) {
    let code = 'catalog_admin_operation_failed'
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json()
        if (body?.error) code = body.error
      } catch {
        // response body wasn't JSON; fall back to the generic code
      }
    }
    const wrapped = new Error(code)
    wrapped.code = code
    throw wrapped
  }
  return data?.result
}

export function listStagedBatches() {
  return callCatalogAdmin('list_batches')
}

export function listStagedCandidates(batchId) {
  return callCatalogAdmin('list_candidates', { batchId })
}

export function reviewCandidate({ candidateId, decision, reason }) {
  return callCatalogAdmin('review', { candidateId, decision, reason })
}

export function promoteBatch(batchId) {
  return callCatalogAdmin('promote', { batchId })
}
