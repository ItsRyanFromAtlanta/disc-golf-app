// Server-only bounded crawler for a curated list of official MVP product pages.
//
// Each target page is staged independently through the existing single-page
// pipeline: its own catalog_sources row, its own checksum-addressed batch. A
// broken or changed page never blocks the others, and 304 replay keeps working
// per page. This is not a scheduled/recurring job — it runs once per explicit
// admin-triggered request, sequentially, so the fetcher's per-host delay
// throttling (see catalogFetchPolicy.js) applies across the whole run.

import { stageMvpCatalogIngestion } from './mvpCatalogStaging.js'
import { MVP_OFFICIAL_ADAPTER_KEY, MVP_OFFICIAL_ADAPTER_VERSION } from './adapters/mvpCatalogAdapter.js'

export const MVP_CRAWL_TARGETS = Object.freeze([
  'https://mvpdiscsports.com/discs/watt/',
  'https://mvpdiscsports.com/discs/terra/',
  'https://mvpdiscsports.com/discs/volt/',
  'https://mvpdiscsports.com/discs/photon/',
])

const MVP_SOURCE_NAME = 'MVP Disc Sports official catalog pages'

function requireFunction(value, field) {
  if (typeof value !== 'function') throw new TypeError(`${field} must be a function`)
  return value
}

function requiredJobId(jobId) {
  if (typeof jobId !== 'string' || !jobId.trim()) throw new TypeError('jobId is required')
  return jobId.trim()
}

function requiredTargets(targets) {
  if (!Array.isArray(targets) || targets.length === 0) throw new TypeError('targets must be a non-empty array')
  return targets
}

export async function crawlMvpCatalogSource({
  jobId,
  fetcher,
  store,
  targets = MVP_CRAWL_TARGETS,
  stage = stageMvpCatalogIngestion,
} = {}) {
  const baseJobId = requiredJobId(jobId)
  const crawlTargets = requiredTargets(targets)
  requireFunction(fetcher?.fetch, 'fetcher.fetch')
  requireFunction(stage, 'stage')

  const results = []
  for (const [index, url] of crawlTargets.entries()) {
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential by design: one fetcher shared across targets enforces the host-delay throttle
      const result = await stage({
        request: {
          jobId: `${baseJobId}-${index + 1}`,
          adapterKey: MVP_OFFICIAL_ADAPTER_KEY,
          adapterVersion: MVP_OFFICIAL_ADAPTER_VERSION,
          mode: 'stage',
          source: { type: 'manufacturer', name: MVP_SOURCE_NAME, url },
        },
        fetcher,
        store,
      })
      results.push(Object.freeze({ url, status: result.status, batchId: result.batch?.id ?? null }))
    } catch (error) {
      results.push(Object.freeze({
        url,
        status: 'failed',
        error: typeof error?.code === 'string' && error.code ? error.code : 'catalog_ingestion_failed',
      }))
    }
  }

  return Object.freeze({ targets: crawlTargets.length, results: Object.freeze(results) })
}
