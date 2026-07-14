import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.0'
import { createCatalogAdminHandler } from '../_shared/catalogIngestionAdminHandler.js'

const handleCatalogAdmin = createCatalogAdminHandler({
  getEnv: (name) => Deno.env.get(name),
  createClientImpl: createClient,
})

Deno.serve(handleCatalogAdmin)
