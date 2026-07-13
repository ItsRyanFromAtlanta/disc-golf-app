import { describe, expect, it, vi } from 'vitest'
import { MVP_CRAWL_TARGETS, crawlMvpCatalogSource } from './mvpCatalogCrawl.js'

describe('MVP catalog crawler', () => {
  it('stages each target page independently through the injected pipeline', async () => {
    const stage = vi.fn(async ({ request }) => ({
      status: 'staged',
      batch: { id: `batch-${request.jobId}` },
    }))
    const fetcher = { fetch: vi.fn() }
    const store = {}

    const result = await crawlMvpCatalogSource({ jobId: 'crawl-1', fetcher, store, stage })

    expect(result.targets).toBe(MVP_CRAWL_TARGETS.length)
    expect(result.results).toHaveLength(MVP_CRAWL_TARGETS.length)
    expect(stage).toHaveBeenCalledTimes(MVP_CRAWL_TARGETS.length)
    for (const [index, target] of MVP_CRAWL_TARGETS.entries()) {
      expect(stage).toHaveBeenNthCalledWith(index + 1, expect.objectContaining({
        request: expect.objectContaining({
          jobId: `crawl-1-${index + 1}`,
          source: expect.objectContaining({ url: target }),
        }),
        fetcher,
        store,
      }))
      expect(result.results[index]).toMatchObject({ url: target, status: 'staged' })
    }
  })

  it('records a per-target failure without aborting the remaining targets', async () => {
    const stage = vi.fn(async ({ request }) => {
      if (request.source.url === MVP_CRAWL_TARGETS[1]) {
        const error = new Error('host_not_allowlisted')
        error.code = 'host_not_allowlisted'
        throw error
      }
      return { status: 'staged', batch: { id: `batch-${request.jobId}` } }
    })

    const result = await crawlMvpCatalogSource({
      jobId: 'crawl-2',
      fetcher: { fetch: vi.fn() },
      store: {},
      stage,
    })

    expect(stage).toHaveBeenCalledTimes(MVP_CRAWL_TARGETS.length)
    expect(result.results[1]).toMatchObject({ url: MVP_CRAWL_TARGETS[1], status: 'failed', error: 'host_not_allowlisted' })
    expect(result.results[0]).toMatchObject({ status: 'staged' })
    expect(result.results[2]).toMatchObject({ status: 'staged' })
  })

  it('rejects a missing jobId or empty target list before staging anything', async () => {
    const stage = vi.fn()
    await expect(crawlMvpCatalogSource({ jobId: '', fetcher: { fetch: vi.fn() }, store: {}, stage }))
      .rejects.toThrow(TypeError)
    await expect(crawlMvpCatalogSource({ jobId: 'crawl-3', fetcher: { fetch: vi.fn() }, store: {}, targets: [], stage }))
      .rejects.toThrow(TypeError)
    expect(stage).not.toHaveBeenCalled()
  })
})
