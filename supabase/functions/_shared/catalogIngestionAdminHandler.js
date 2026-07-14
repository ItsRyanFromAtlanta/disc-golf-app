// Framework-free handler for the protected catalog-ingestion-admin Edge Function.
// Review/promote dispatch to their existing RPCs, which self-check the admin
// allowlist. The read-only list operations have no RPC to lean on, so they
// check catalog_assert_ingestion_admin explicitly before querying with the
// service-role client — no browser role is ever granted table access.

import {
  adminPrincipalForUser,
  catalogAdminErrorResponse,
  createCatalogAdminRpcCall,
} from './catalogIngestionAdmin.js'

const CORS_HEADERS = Object.freeze({
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
})

const LIST_OPERATIONS = new Set(['list_batches', 'list_candidates'])

const BATCH_SELECT = [
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
  'catalog_sources(name, url)',
].join(',')

const CANDIDATE_SELECT = [
  'id',
  'import_batch_id',
  'row_number',
  'entity_type',
  'identity_key',
  'identity',
  'normalized_fields',
  'supported_fields',
  'source_reference',
  'evidence_snapshot',
  'confidence',
  'validation_status',
  'dedup_status',
  'conflict_code',
  'review_status',
  'created_at',
].join(',')

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS })
}

function requiredEnv(getEnv, name) {
  const value = getEnv(name)
  if (!value) throw new Error(`missing_${name}`)
  return value
}

function bearerToken(request) {
  const authorization = request.headers.get('Authorization')
  return authorization?.startsWith('Bearer ') ? authorization : null
}

export function createCatalogAdminHandler({
  getEnv = () => undefined,
  createClientImpl,
  createUserClient,
  createServiceClient,
} = {}) {
  if (typeof createClientImpl !== 'function' && (!createUserClient || !createServiceClient)) {
    throw new TypeError('createClientImpl or client factories are required')
  }

  const makeUserClient = createUserClient ?? (({ url, key, authorization }) => createClientImpl(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  }))
  const makeServiceClient = createServiceClient ?? (({ url, key }) => createClientImpl(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  }))

  return async function handleCatalogAdmin(request) {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
    if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405)

    const authorization = bearerToken(request)
    if (!authorization) return response({ error: 'catalog_admin_auth_required' }, 401)

    try {
      const supabaseUrl = requiredEnv(getEnv, 'SUPABASE_URL')
      const anonKey = requiredEnv(getEnv, 'SUPABASE_ANON_KEY')
      const serviceRoleKey = requiredEnv(getEnv, 'SUPABASE_SERVICE_ROLE_KEY')

      const userClient = makeUserClient({ url: supabaseUrl, key: anonKey, authorization })
      const { data: userData, error: authError } = await userClient.auth.getUser()
      if (authError || !userData?.user?.id) return response({ error: 'catalog_admin_auth_required' }, 401)
      const userId = userData.user.id

      let body
      try {
        body = await request.json()
      } catch {
        return response({ error: 'catalog_admin_request_invalid' }, 400)
      }

      const serviceClient = makeServiceClient({ url: supabaseUrl, key: serviceRoleKey })

      if (LIST_OPERATIONS.has(body?.operation)) {
        const { data: allowed, error: accessError } = await serviceClient.rpc('catalog_assert_ingestion_admin', {
          p_user_id: userId,
          p_principal: adminPrincipalForUser(userId),
        })
        if (accessError || allowed !== true) return response({ error: 'catalog_admin_required' }, 403)

        if (body.operation === 'list_batches') {
          const { data, error } = await serviceClient
            .from('catalog_import_batches')
            .select(BATCH_SELECT)
            .order('created_at', { ascending: false })
            .limit(50)
          if (error) return response({ error: 'catalog_admin_operation_failed' }, 500)
          return response({ result: data ?? [] })
        }

        const batchId = typeof body.batchId === 'string' ? body.batchId.trim() : ''
        if (!batchId) return response({ error: 'catalog_admin_request_invalid' }, 400)
        const { data, error } = await serviceClient
          .from('catalog_import_candidates')
          .select(CANDIDATE_SELECT)
          .eq('import_batch_id', batchId)
          .order('row_number', { ascending: true })
        if (error) return response({ error: 'catalog_admin_operation_failed' }, 500)
        return response({ result: data ?? [] })
      }

      let call
      try {
        call = createCatalogAdminRpcCall({ body, userId })
      } catch (error) {
        return response({
          error: error.message === 'catalog_review_decision_invalid'
            ? error.message
            : 'catalog_admin_request_invalid',
        }, 400)
      }

      const { data: result, error } = await serviceClient.rpc(call.functionName, call.params)
      if (error) {
        const safe = catalogAdminErrorResponse(error)
        return response(safe.body, safe.status)
      }
      return response({ result })
    } catch (error) {
      console.error('catalog admin operation failed', error?.code ?? 'unknown')
      return response({ error: 'catalog_admin_operation_failed' }, 500)
    }
  }
}
