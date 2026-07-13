// Server-only composition for the bounded MVP staging checkpoint.
//
// The network fetcher and persistence store are deliberately injected. This
// module selects the official adapter and its host policy, while the generic
// staging orchestrator continues to own checksums, 304 replay, candidate
// normalization, and the no-canonical-write boundary.

import { runManufacturerAdapter } from '../../../src/lib/catalog/manufacturerAdapter.js'
import { stageCatalogIngestion } from './catalogIngestionStage.js'
import {
  MVP_OFFICIAL_ADAPTER_KEY,
  MVP_OFFICIAL_ADAPTER_VERSION,
  MVP_OFFICIAL_SOURCE_HOSTS,
  mvpOfficialAdapter,
  mvpOfficialAdapterRegistry,
} from './adapters/mvpCatalogAdapter.js'

export const MVP_CATALOG_SOURCE_POLICY = Object.freeze({
  allowedHosts: MVP_OFFICIAL_SOURCE_HOSTS,
})

export function resolveMvpCatalogSourcePolicy({ job, adapter } = {}) {
  if (
    job?.adapterKey !== MVP_OFFICIAL_ADAPTER_KEY
    || job.adapterVersion !== MVP_OFFICIAL_ADAPTER_VERSION
    || adapter?.adapterKey !== MVP_OFFICIAL_ADAPTER_KEY
    || adapter?.adapterVersion !== MVP_OFFICIAL_ADAPTER_VERSION
  ) {
    const error = new Error('Unsupported MVP catalog adapter request')
    error.code = 'unsupported_mvp_adapter_request'
    throw error
  }
  return MVP_CATALOG_SOURCE_POLICY
}

export function stageMvpCatalogIngestion({ request, fetcher, store } = {}) {
  return stageCatalogIngestion({
    request,
    adapterRegistry: mvpOfficialAdapterRegistry,
    resolveSourcePolicy: resolveMvpCatalogSourcePolicy,
    fetcher,
    runAdapter: runManufacturerAdapter,
    store,
  })
}

export { mvpOfficialAdapter }
