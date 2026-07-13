import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.0'
import { createCatalogIngestionHandler } from '../_shared/catalogIngestionHandler.js'

const handleCatalogIngestion = createCatalogIngestionHandler({
  getEnv: (name) => Deno.env.get(name),
  createClientImpl: createClient,
  fetchImpl: globalThis.fetch,
})

Deno.serve(handleCatalogIngestion)
