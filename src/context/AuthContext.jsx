import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { AuthContext } from '../hooks/useAuth'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const user = session?.user ?? null
  const isGuest = user?.is_anonymous ?? false

  const value = {
    session,
    user,
    isGuest,
    loading,
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),

    // Privacy purge. The RPC takes no arguments and derives its subject from
    // the JWT, so a caller cannot target another account. It permanently
    // removes the auth identity, every owner-scoped row that cascades from it,
    // and the user's private photo objects. See the 20260727120000 migration.
    deleteAccount: () => supabase.rpc('delete_own_account'),

    // Screen 2 — passwordless email OTP. shouldCreateUser covers both sign-in
    // and create-account with the same call; Supabase treats a first-time
    // address as a signup automatically.
    signInWithOtp: (email) => supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }),
    verifyOtp: (email, token) => supabase.auth.verifyOtp({ email, token, type: 'email' }),

    signInWithOAuth: (provider) =>
      supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/practice` } }),

    // Guest escape hatch: Supabase anonymous sign-in survives device loss
    // (standing divergence #4) unlike a Dexie-only shadow profile.
    signInAnonymously: () => supabase.auth.signInAnonymously(),

    // Guest -> permanent account conversion, preserving local progress since
    // it's the SAME user id throughout — just adds an identity to it rather
    // than creating a new user. updateUser({ email }) on an anonymous user
    // sends a confirmation OTP to that address instead of changing it
    // outright; verifyOtp's 'email_change' type completes the claim.
    convertGuestWithOtp: (email) => supabase.auth.updateUser({ email }),
    verifyGuestConversion: (email, token) => supabase.auth.verifyOtp({ email, token, type: 'email_change' }),
    linkGuestWithOAuth: (provider) =>
      supabase.auth.linkIdentity({ provider, options: { redirectTo: `${window.location.origin}/practice` } }),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
