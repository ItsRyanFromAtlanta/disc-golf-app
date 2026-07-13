import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.0'
import {
  catalogAdminErrorResponse,
  createCatalogAdminRpcCall,
} from '../_shared/catalogIngestionAdmin.js'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function requiredEnv(name) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`missing_${name}`)
  return value
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return response({ error: 'catalog_admin_auth_required' }, 401)
  }

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL')
    const anonKey = requiredEnv('SUPABASE_ANON_KEY')
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error: authError } = await userClient.auth.getUser()
    if (authError || !data.user) return response({ error: 'catalog_admin_auth_required' }, 401)

    let body
    try {
      body = await request.json()
    } catch {
      return response({ error: 'catalog_admin_request_invalid' }, 400)
    }
    let call
    try {
      call = createCatalogAdminRpcCall({ body, userId: data.user.id })
    } catch (error) {
      return response({ error: error.message === 'catalog_review_decision_invalid'
        ? error.message
        : 'catalog_admin_request_invalid' }, 400)
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
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
})
