import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { db } from '../lib/db/dexieDb'
import { purgeDeviceData } from '../lib/localPurge'
import { describeDeleteAccountError, isDeleteAccountUnavailable } from '../lib/accountDeletion'

const CONFIRM_PHRASE = 'DELETE'

// In-app account deletion. Required by App Store Guideline 5.1.1(v) for any
// app that creates accounts, and by the roadmap's own privacy rule that a
// purge truly removes scoped data rather than soft-hiding it.
//
// Deliberately not a soft delete: soft deletion is what activities use for
// recovery/audit, and it is the wrong contract here. Once this succeeds there
// is nothing to restore.
export default function DeleteAccountPanel() {
  const { deleteAccount, signOut } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  // Set once we learn the RPC is not deployed. `main` auto-deploys and a
  // migration cannot land in the same step as the client that calls it, so
  // there is always a window where this button exists and its function does
  // not. Re-offering the button through that window just invites a second
  // identical failure.
  const [unavailable, setUnavailable] = useState(false)

  async function handleDelete() {
    setStatus('working')
    setError(null)
    try {
      const { error: rpcError } = await deleteAccount()
      if (rpcError) {
        // Handled here rather than thrown: wrapping it in a plain Error would
        // discard `code`, which is the only reliable way to tell "not deployed"
        // from "your session expired" from "the purge itself failed".
        setStatus('error')
        setUnavailable(isDeleteAccountUnavailable(rpcError))
        setError(describeDeleteAccountError(rpcError))
        return
      }

      // Only after the server confirms: clear this device so the next person
      // to open the app cannot see the deleted account's practice data and no
      // stale outbox row replays against a user that no longer exists.
      await purgeDeviceData({
        storage: typeof localStorage === 'undefined' ? null : localStorage,
        database: db,
      })

      // The identity is already gone, so this call may legitimately fail with
      // an invalid session. Clearing local auth state is what matters.
      await signOut().catch(() => {})

      // Full reload rather than a route change: every provider, cache, and
      // open Dexie handle in memory still belongs to the deleted user.
      window.location.replace('/')
    } catch (err) {
      // Reached when the purge succeeded server-side but a local step threw.
      setStatus('error')
      setError(describeDeleteAccountError(err))
    }
  }

  return (
    <section className="profile-section delete-account-panel" aria-labelledby="delete-account-title">
      <div className="profile-section-header"><h2 id="delete-account-title">Delete account</h2></div>
      <p className="settings-note">
        Permanently deletes your account, practice and round history, discs, bags, photos, goals, and
        reports. Courses you added stay available to other players without your name attached. This
        cannot be undone — export your data first if you want a copy.
      </p>

      {!confirming ? (
        <div className="profile-section-actions">
          <button type="button" className="btn-danger" onClick={() => setConfirming(true)}>
            Delete my account
          </button>
        </div>
      ) : (
        <div className="delete-account-confirm">
          <label htmlFor="delete-account-phrase">
            Type <strong>{CONFIRM_PHRASE}</strong> to confirm
          </label>
          <input
            id="delete-account-phrase"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            autoComplete="off"
            aria-describedby="delete-account-title"
          />
          <div className="profile-section-actions">
            <button
              type="button"
              className="btn-danger"
              disabled={phrase !== CONFIRM_PHRASE || status === 'working' || unavailable}
              onClick={handleDelete}
            >
              {status === 'working' ? 'Deleting…' : 'Permanently delete'}
            </button>
            <button
              type="button"
              className="link-button"
              disabled={status === 'working'}
              onClick={() => { setConfirming(false); setPhrase(''); setError(null); setStatus('idle') }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* No "Account not deleted:" prefix — every mapped message says so
          itself, and the one thing this must never leave ambiguous is whether
          an irreversible purge partially happened. */}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}
