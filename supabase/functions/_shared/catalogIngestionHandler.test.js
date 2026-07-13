import { describe, expect, it, vi } from 'vitest'
import { createCatalogIngestionHandler } from './catalogIngestionHandler.js'
import {
  MVP_OFFICIAL_ADAPTER_KEY,
  MVP_OFFICIAL_ADAPTER_VERSION,
  MVP_OFFICIAL_SOURCE,
} from './adapters/mvpCatalogAdapter.js'

const userId = '35b59d46-c58d-4193-9de2-f09238c0d009'
const body = {
  jobId: 'mvp-job-1',
  adapterKey: MVP_OFFICIAL_ADAPTER_KEY,
  adapterVersion: MVP_OFFICIAL_ADAPTER_VERSION,
  mode: 'stage',
  source: MVP_OFFICIAL_SOURCE,
}

function request({ authorization = `Bearer user-token`, payload = body, method = 'POST' } = {}) {
  return new Request('https://example.test/functions/v1/catalog-ingestion', {
    method,
    headers: authorization ? { Authorization: authorization, 'Content-Type': 'application/json' } : {},
    body: method === 'POST' ? JSON.stringify(payload) : undefined,
  })
}

function harness({ allowed = true, stageResult } = {}) {
  const userClient = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: userId } }, error: null })) },
  }
  const serviceClient = {
    rpc: vi.fn(async (name) => {
      if (name === 'catalog_assert_ingestion_admin' && !allowed) {
        return { data: null, error: { message: 'catalog_admin_required' } }
      }
      return { data: true, error: null }
    }),
  }
  const stage = vi.fn(async () => stageResult ?? {
    status: 'staged',
    batch: { id: 'batch-1', source_checksum: 'a'.repeat(64), row_count: 4 },
    envelope: { sourceChecksum: 'a'.repeat(64), rowCount: 4 },
  })
  const createFetcher = vi.fn(() => ({ fetch: vi.fn() }))
  const createStore = vi.fn(() => ({ stageImport: vi.fn() }))
  const handler = createCatalogIngestionHandler({
    getEnv: (name) => ({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      SUPABASE_SECRET_KEY: 'secret-key',
    })[name],
    createUserClient: vi.fn(() => userClient),
    createServiceClient: vi.fn(() => serviceClient),
    fetchImpl: vi.fn(),
    stage,
    createFetcher,
    createStore,
  })
  return { handler, userClient, serviceClient, stage, createFetcher, createStore }
}

describe('protected catalog-ingestion handler', () => {
  it('rejects requests without a user bearer token before client work', async () => {
    const h = harness()
    const response = await h.handler(request({ authorization: null }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'catalog_admin_auth_required' })
    expect(h.stage).not.toHaveBeenCalled()
  })

  it('checks the ingestion-admin allowlist before creating a fetcher', async () => {
    const h = harness({ allowed: false })
    const response = await h.handler(request())

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'catalog_admin_required' })
    expect(h.serviceClient.rpc).toHaveBeenCalledWith('catalog_assert_ingestion_admin', {
      p_user_id: userId,
      p_principal: `admin:${userId}`,
    })
    expect(h.createFetcher).not.toHaveBeenCalled()
    expect(h.stage).not.toHaveBeenCalled()
  })

  it('runs the staging composition and returns a redacted batch summary', async () => {
    const h = harness()
    const response = await h.handler(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      result: {
        status: 'staged',
        batchId: 'batch-1',
        sourceChecksum: 'a'.repeat(64),
        rowCount: 4,
      },
    })
    expect(h.stage).toHaveBeenCalledWith({
      request: expect.objectContaining({ jobId: 'mvp-job-1' }),
      fetcher: expect.any(Object),
      store: expect.any(Object),
    })
    expect(h.createFetcher).toHaveBeenCalledWith(expect.objectContaining({ fetchImpl: expect.any(Function) }))
    expect(h.createStore).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: userId,
      actorPrincipal: `admin:${userId}`,
    }))
  })

  it('returns a safe 400 for malformed JSON', async () => {
    const h = harness()
    const malformed = new Request('https://example.test/functions/v1/catalog-ingestion', {
      method: 'POST',
      headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
      body: '{',
    })
    const response = await h.handler(malformed)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'catalog_ingestion_request_invalid' })
  })
})
