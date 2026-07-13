// Framework-free handler for the protected catalog-ingestion Edge Function.
// The production entrypoint supplies Deno's environment, fetch, and
// supabase-js client factory; tests inject all three without network access.

import { createMvpCatalogFetcher } from './mvpCatalogFetcher.js'
import { stageMvpCatalogIngestion } from './mvpCatalogStaging.js'
import { createSupabaseCatalogIngestionStore } from './catalogIngestionStore.js'
import { adminPrincipalForUser } from './catalogIngestionAdmin.js'
import {
  CATALOG_INGESTION_CORS_HEADERS,
  catalogIngestionErrorResponse,
  normalizeCatalogIngestionRequest,
  summarizeCatalogIngestionResult,
} from './catalogIngestionFunction.js'

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: CATALOG_INGESTION_CORS_HEADERS,
  })
}

function bearerToken(request) {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return null
  const token = authorization.slice('Bearer '.length).trim()
  return token ? { authorization, token } : null
}

function namedKey(raw, preferredName = 'default') {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    if (typeof parsed[preferredName] === 'string' && parsed[preferredName]) return parsed[preferredName]
    const first = Object.values(parsed).find((value) => typeof value === 'string' && value)
    return first ?? null
  } catch {
    return null
  }
}

function resolveEnvKey(getEnv, namedEnv, fallbackNames) {
  const named = namedKey(getEnv(namedEnv))
  if (named) return named
  for (const name of fallbackNames) {
    const value = getEnv(name)
    if (value) return value
  }
  return null
}

function requiredEnv(getEnv, name, fallbackNames = []) {
  const value = getEnv(name) || fallbackNames.map((fallback) => getEnv(fallback)).find(Boolean)
  if (!value) throw new Error(`missing_${name}`)
  return value
}

export function createCatalogIngestionHandler({
  getEnv = () => undefined,
  createClientImpl,
  fetchImpl = globalThis.fetch,
  stage = stageMvpCatalogIngestion,
  createFetcher = createMvpCatalogFetcher,
  createStore = createSupabaseCatalogIngestionStore,
  createUserClient,
  createServiceClient,
} = {}) {
  if (typeof createClientImpl !== 'function' && (!createUserClient || !createServiceClient)) {
    throw new TypeError('createClientImpl or client factories are required')
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required')

  const makeUserClient = createUserClient ?? (({ url, key, authorization }) => createClientImpl(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  }))
  const makeServiceClient = createServiceClient ?? (({ url, key }) => createClientImpl(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  }))

  return async function handleCatalogIngestion(request) {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: CATALOG_INGESTION_CORS_HEADERS })
    if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405)

    const bearer = bearerToken(request)
    if (!bearer) return response({ error: 'catalog_admin_auth_required' }, 401)

    try {
      const supabaseUrl = requiredEnv(getEnv, 'SUPABASE_URL')
      const publishableKey = resolveEnvKey(getEnv, 'SUPABASE_PUBLISHABLE_KEYS', [
        'SUPABASE_PUBLISHABLE_KEY',
        'SUPABASE_ANON_KEY',
      ])
      const secretKey = resolveEnvKey(getEnv, 'SUPABASE_SECRET_KEYS', [
        'SUPABASE_SECRET_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
      ])
      if (!publishableKey || !secretKey) throw new Error('missing_supabase_api_keys')

      const userClient = makeUserClient({
        url: supabaseUrl,
        key: publishableKey,
        authorization: bearer.authorization,
      })
      const { data: userData, error: authError } = await userClient.auth.getUser()
      if (authError || !userData?.user?.id) return response({ error: 'catalog_admin_auth_required' }, 401)

      const actorUserId = userData.user.id
      const actorPrincipal = adminPrincipalForUser(actorUserId)
      let parsedBody
      try {
        parsedBody = await request.json()
      } catch {
        const error = new Error('catalog_ingestion_request_invalid')
        error.code = 'catalog_ingestion_request_invalid'
        throw error
      }
      const requestBody = normalizeCatalogIngestionRequest(parsedBody)
      const serviceClient = makeServiceClient({ url: supabaseUrl, key: secretKey })

      const { data: allowed, error: accessError } = await serviceClient.rpc('catalog_assert_ingestion_admin', {
        p_user_id: actorUserId,
        p_principal: actorPrincipal,
      })
      if (accessError || allowed !== true) {
        const error = new Error(accessError?.message ?? 'catalog_admin_required')
        error.code = 'catalog_admin_required'
        throw error
      }

      const result = await stage({
        request: requestBody,
        fetcher: createFetcher({ fetchImpl }),
        store: createStore({
          supabase: serviceClient,
          actorUserId,
          actorPrincipal,
        }),
      })
      return response({ result: summarizeCatalogIngestionResult(result) })
    } catch (error) {
      const safe = catalogIngestionErrorResponse(error)
      console.error('catalog ingestion operation failed', safe.body.error)
      return response(safe.body, safe.status)
    }
  }
}
