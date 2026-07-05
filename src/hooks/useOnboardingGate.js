import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchBags } from '../lib/discLocker'
import { needsOnboarding } from '../lib/onboarding'

// Checked once per app load (same ref-guard pattern as
// useCrashRecoveryRedirect) — a user with zero bags has never finished
// Screen 3, so this sends them there instead of into the tab-barred shell.
// Fails open on a fetch error: a transient network hiccup should not trap an
// already-onboarded user in a redirect loop.
export function useOnboardingGate() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const checked = useRef(false)

  useEffect(() => {
    if (checked.current || !user || location.pathname === '/onboarding') return
    checked.current = true

    fetchBags(user.id)
      .then((bags) => {
        if (needsOnboarding(bags)) {
          navigate('/onboarding', { replace: true })
        }
      })
      .catch(() => {})
    // Mount-once by design (see comment above).
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [user])
}
