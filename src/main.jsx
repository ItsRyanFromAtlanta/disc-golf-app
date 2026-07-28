import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { requestPersistentStorage } from './lib/storagePersistence.js'

// Ask for durable storage before anything writes. The InstantLaunch buffer and
// the Dexie outbox hold work that has not reached Supabase yet, and default
// origin storage is evictable — a user who logs in the field and does not
// reopen the app for a while can otherwise lose those writes. Failure is
// non-fatal and never blocks start.
requestPersistentStorage()

// networkMode 'offlineFirst' on individual queries (see createRepository.js)
// needs the client itself to not hard-block on connectivity checks.
const queryClient = new QueryClient({
  defaultOptions: { queries: { networkMode: 'offlineFirst' } },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
