import { describe, expect, it, vi } from 'vitest'
import { createCatalogAdminHandler } from './catalogIngestionAdminHandler.js'

const userId = '35b59d46-c58d-4193-9de2-f09238c0d009'

function request({ authorization = 'Bearer user-token', body, method = 'POST' } = {}) {
  return new Request('https://example.test/functions/v1/catalog-ingestion-admin', {
    method,
    headers: authorization ? { Authorization: authorization, 'Content-Type': 'application/json' } : {},
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  })
}

function harness({ allowed = true, batches = [], candidates = [], rpcResult } = {}) {
  const userClient = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: userId } }, error: null })) },
  }
  const rpc = vi.fn(async (name) => {
    if (name === 'catalog_assert_ingestion_admin') {
      return allowed ? { data: true, error: null } : { data: null, error: { message: 'catalog_admin_required' } }
    }
    return rpcResult ?? { data: { ok: true }, error: null }
  })
  const query = (rows) => ({
    select: vi.fn(function select() { return this }),
    eq: vi.fn(function eq() { return this }),
    order: vi.fn(function order() { return this }),
    limit: vi.fn(async () => ({ data: rows, error: null })),
    then: undefined,
  })
  const candidateQuery = {
    select: vi.fn(function select() { return this }),
    eq: vi.fn(function eq() { return this }),
    order: vi.fn(async () => ({ data: candidates, error: null })),
  }
  const from = vi.fn((table) => (table === 'catalog_import_candidates' ? candidateQuery : query(batches)))
  const serviceClient = { rpc, from }
  const handler = createCatalogAdminHandler({
    getEnv: (name) => ({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    })[name],
    createUserClient: vi.fn(() => userClient),
    createServiceClient: vi.fn(() => serviceClient),
  })
  return { handler, rpc, from }
}

describe('protected catalog-ingestion-admin handler', () => {
  it('rejects requests without a bearer token', async () => {
    const h = harness()
    const response = await h.handler(request({ authorization: null }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'catalog_admin_auth_required' })
  })

  it('lists staged batches for an allowlisted admin', async () => {
    const h = harness({ batches: [{ id: 'batch-1', status: 'staged' }] })
    const response = await h.handler(request({ body: { operation: 'list_batches' } }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ result: [{ id: 'batch-1', status: 'staged' }] })
    expect(h.rpc).toHaveBeenCalledWith('catalog_assert_ingestion_admin', { p_user_id: userId, p_principal: `admin:${userId}` })
  })

  it('rejects list_batches for a non-admin user without querying tables', async () => {
    const h = harness({ allowed: false })
    const response = await h.handler(request({ body: { operation: 'list_batches' } }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'catalog_admin_required' })
    expect(h.from).not.toHaveBeenCalled()
  })

  it('lists candidates for a given batch', async () => {
    const h = harness({ candidates: [{ id: 'candidate-1', row_number: 1 }] })
    const response = await h.handler(request({ body: { operation: 'list_candidates', batchId: 'batch-1' } }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ result: [{ id: 'candidate-1', row_number: 1 }] })
  })

  it('rejects list_candidates without a batchId', async () => {
    const h = harness()
    const response = await h.handler(request({ body: { operation: 'list_candidates' } }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'catalog_admin_request_invalid' })
  })

  it('still dispatches review/promote through the existing RPC path', async () => {
    const h = harness({ rpcResult: { data: { status: 'approved' }, error: null } })
    const response = await h.handler(request({
      body: { operation: 'review', candidateId: userId, decision: 'approved', reason: 'looks right' },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ result: { status: 'approved' } })
    expect(h.rpc).toHaveBeenCalledWith('catalog_review_candidate', expect.objectContaining({
      p_candidate_id: userId,
      p_decision: 'approved',
    }))
  })

  it('returns a safe 400 for malformed JSON', async () => {
    const h = harness()
    const malformed = new Request('https://example.test/functions/v1/catalog-ingestion-admin', {
      method: 'POST',
      headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
      body: '{',
    })
    const response = await h.handler(malformed)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'catalog_admin_request_invalid' })
  })
})
