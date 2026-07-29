import { createContext, useContext } from 'react'

// The context object lives here rather than beside AuthProvider so that
// `src/context/AuthContext.jsx` exports nothing but the component itself.
// Mixing a component export with a hook/constant export in one module
// degrades React Fast Refresh for every consumer of that module
// (react/only-export-components).
export const AuthContext = createContext(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
