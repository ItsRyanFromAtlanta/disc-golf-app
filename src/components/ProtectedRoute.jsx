import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { shouldShowGuestNudge } from '../lib/guestNudge'

// D-10: a guest's conversion mechanism (AuthContext's convertGuestWithOtp /
// verifyGuestConversion / linkGuestWithOAuth, and AuthPage's `isGuest`
// branch) was complete but unreachable — nothing anywhere navigated a
// signed-in guest to `/login`, so it only worked if a user typed the URL by
// hand. `shouldShowGuestNudge` lives in `lib/guestNudge.js`, not here,
// so mixing a function export with this component export doesn't degrade
// Fast Refresh — the same reason `useAuth` was split out of
// `AuthContext.jsx` (see that file's own comment).
//
// ProtectedRoute wraps every authenticated screen in the app — directly for
// `/onboarding`, and via AppShell for everything else (AppShell.jsx:87) — so
// it is the one place a persistent, low-friction affordance reaches a guest
// regardless of which screen they're on, without adding a bespoke entry
// point to any individual screen.
function GuestConversionNudge() {
  return (
    <Link
      to="/login"
      className="guest-conversion-nudge"
      style={{
        position: 'fixed',
        right: '12px',
        bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 12px)',
        zIndex: 15,
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 'var(--tap-target-min)',
        padding: '0 16px',
        borderRadius: '999px',
        border: 'var(--border-width) solid var(--color-border-default)',
        background: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
        boxShadow: '0 4px 14px rgb(0 0 0 / 18%)',
        textDecoration: 'none',
        fontSize: '13px',
        fontWeight: 600,
      }}
    >
      Save progress
    </Link>
  )
}

export default function ProtectedRoute({ children }) {
  const { user, loading, isGuest } = useAuth()
  const { pathname } = useLocation()

  if (loading) return <p className="loading">Loading...</p>
  if (!user) return <Navigate to="/login" replace />

  return (
    <>
      {children}
      {shouldShowGuestNudge(isGuest, pathname) && <GuestConversionNudge />}
    </>
  )
}
