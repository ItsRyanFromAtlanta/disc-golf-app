// User-facing error mapping for the privacy purge (Screen: Settings → Delete
// account). Pure and separate from the component so the cases below are
// testable without mounting React or reaching Supabase.
//
// This exists because of a real ordering hazard rather than a hypothetical
// one: `main` auto-deploys, and a migration cannot ride in the same atomic
// step as the client that calls it. So there is always a window — however
// short — where the UI is live and `public.delete_own_account()` is not. Left
// unmapped, that window shows the user the raw PostgREST string "Could not
// find the function public.delete_own_account without parameters in the schema
// cache", which reads like data loss to someone who just typed DELETE.

// PostgREST cannot find the function in its schema cache; Postgres does not
// know the function at all. Both mean the migration has not landed.
const MISSING_FUNCTION_CODES = new Set(['PGRST202', '42883'])

// 42501 is a bare permission denial; 28000 is the function's own guard for a
// call arriving with no `auth.uid()`. Both are session problems from the
// user's side, not server faults.
const SESSION_CODES = new Set(['42501', '28000'])

export const DELETE_ACCOUNT_MESSAGES = Object.freeze({
  UNAVAILABLE:
    'Account deletion is temporarily unavailable. Nothing was deleted and your data is unchanged — please try again shortly, or contact support if it persists.',
  SESSION:
    'Your session has expired. Nothing was deleted — sign out, sign back in, and try again.',
  OFFLINE:
    'Account deletion needs a connection and cannot be queued for later. Nothing was deleted — reconnect and try again.',
})

/**
 * Maps a failed `delete_own_account()` call to a message safe to show a user.
 *
 * Every branch states that nothing was deleted. The purge is irreversible by
 * design, so the one thing a failure message must never leave ambiguous is
 * whether it partially happened.
 *
 * @param {{ code?: string, message?: string } | null | undefined} error
 * @returns {string}
 */
export function describeDeleteAccountError(error) {
  if (!error) return DELETE_ACCOUNT_MESSAGES.UNAVAILABLE

  const code = error.code == null ? '' : String(error.code)
  const message = typeof error.message === 'string' ? error.message : ''

  if (MISSING_FUNCTION_CODES.has(code)) return DELETE_ACCOUNT_MESSAGES.UNAVAILABLE
  if (SESSION_CODES.has(code)) return DELETE_ACCOUNT_MESSAGES.SESSION

  // supabase-js surfaces a transport failure as a TypeError with no code, so
  // the message is the only signal available.
  if (!code && /failed to fetch|networkerror|load failed/i.test(message)) {
    return DELETE_ACCOUNT_MESSAGES.OFFLINE
  }

  // Codes are matched above rather than message text, so an unrecognized
  // failure keeps its original message: a support conversation is better
  // served by the real string than by a generic one.
  return message || DELETE_ACCOUNT_MESSAGES.UNAVAILABLE
}

/**
 * True when the failure means the feature itself is not deployed yet, as
 * opposed to this particular attempt failing. The panel uses this to stop
 * offering a button that cannot work.
 */
export function isDeleteAccountUnavailable(error) {
  return Boolean(error) && MISSING_FUNCTION_CODES.has(error.code == null ? '' : String(error.code))
}
