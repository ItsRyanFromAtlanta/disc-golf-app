// Sync ledger (Screen 10 divergence note): "local database sync" here is the
// InstantLaunch outbox (the shipped offline layer), not a separate concept.
// Shows how many captured writes are still waiting to reach Supabase and offers
// a manual [ SYNC NOW ] that drains them via the standalone flushOutbox.
export default function SyncLedger({ pendingCount, lastSyncedAt, syncing, syncError, onSyncNow }) {
  const allSynced = pendingCount === 0
  return (
    <section className="settings-card sync-ledger">
      <h2>Local sync</h2>
      <div className="sync-ledger-status">
        <span className={`sync-dot ${allSynced && !syncError ? 'sync-dot-ok' : 'sync-dot-pending'}`} aria-hidden />
        <div>
          <p className="sync-ledger-line">
            {allSynced ? 'All changes synced' : `${pendingCount} pending write${pendingCount === 1 ? '' : 's'}`}
          </p>
          {lastSyncedAt && (
            <p className="sync-ledger-sub">Last synced {new Date(lastSyncedAt).toLocaleTimeString()}</p>
          )}
          {syncError && (
            <p className="sync-ledger-sub sync-ledger-error">
              Some writes couldn’t sync — they’ll retry automatically next session.
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        className="secondary-button"
        onClick={onSyncNow}
        disabled={allSynced || syncing}
      >
        {syncing ? 'Syncing…' : 'Sync now'}
      </button>
    </section>
  )
}
