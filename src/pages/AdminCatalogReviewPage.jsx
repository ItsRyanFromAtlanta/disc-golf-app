import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listStagedBatches, listStagedCandidates, promoteBatch, reviewCandidate } from '../lib/catalogAdmin'

const DECISIONS = [
  { value: 'approved', label: 'Approve' },
  { value: 'needs_changes', label: 'Needs changes' },
  { value: 'rejected', label: 'Reject' },
]

function CandidateRow({ candidate, onReview }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function decide(decision) {
    setBusy(true)
    setError(null)
    try {
      await onReview({ candidateId: candidate.id, decision, reason })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="admin-candidate-row">
      <div className="admin-candidate-summary">
        <span className="admin-candidate-identity">{candidate.identity_key}</span>
        <span className={`admin-candidate-status admin-candidate-status-${candidate.review_status}`}>
          {candidate.review_status}
        </span>
      </div>
      <pre className="admin-candidate-fields">{JSON.stringify(candidate.normalized_fields, null, 2)}</pre>
      <div className="admin-candidate-meta">
        <span>confidence: {candidate.confidence}</span>
        <span>source: {candidate.source_reference}</span>
      </div>
      <textarea
        className="admin-candidate-reason"
        placeholder="Reason (required)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={busy}
      />
      <div className="admin-candidate-actions">
        {DECISIONS.map(({ value, label }) => (
          <button key={value} type="button" disabled={busy || !reason.trim()} onClick={() => decide(value)}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className="admin-error">{error}</p>}
    </li>
  )
}

export default function AdminCatalogReviewPage() {
  const [batches, setBatches] = useState(null)
  const [batchesError, setBatchesError] = useState(null)
  const [selectedBatchId, setSelectedBatchId] = useState(null)
  const [candidates, setCandidates] = useState(null)
  const [candidatesError, setCandidatesError] = useState(null)
  const [promoteError, setPromoteError] = useState(null)
  const [promoting, setPromoting] = useState(false)

  const loadBatches = useCallback(async () => {
    try {
      setBatches(await listStagedBatches())
      setBatchesError(null)
    } catch (err) {
      setBatchesError(err)
    }
  }, [])

  const loadCandidates = useCallback(async (batchId) => {
    try {
      setCandidates(await listStagedCandidates(batchId))
      setCandidatesError(null)
    } catch (err) {
      setCandidatesError(err)
    }
  }, [])

  useEffect(() => {
    loadBatches()
  }, [loadBatches])

  function selectBatch(batchId) {
    setSelectedBatchId(batchId)
    setCandidates(null)
    setPromoteError(null)
    loadCandidates(batchId)
  }

  async function handleReview({ candidateId, decision, reason }) {
    await reviewCandidate({ candidateId, decision, reason })
    await loadCandidates(selectedBatchId)
  }

  async function handlePromote() {
    setPromoting(true)
    setPromoteError(null)
    try {
      await promoteBatch(selectedBatchId)
      await Promise.all([loadBatches(), loadCandidates(selectedBatchId)])
    } catch (err) {
      setPromoteError(err.message)
    } finally {
      setPromoting(false)
    }
  }

  if (batchesError) {
    return (
      <div className="admin-catalog-page">
        <Link to="/practice">← Back</Link>
        <h1>Catalog review</h1>
        {batchesError.code === 'catalog_admin_required' ? (
          <p>You're not on the catalog ingestion admin allowlist.</p>
        ) : (
          <p className="admin-error">{batchesError.message}</p>
        )}
      </div>
    )
  }

  return (
    <div className="admin-catalog-page">
      <Link to="/practice">← Back</Link>
      <h1>Catalog review</h1>

      {batches === null ? (
        <p>Loading…</p>
      ) : batches.length === 0 ? (
        <p>No staged batches.</p>
      ) : (
        <ul className="admin-batch-list">
          {batches.map((batch) => (
            <li key={batch.id}>
              <button
                type="button"
                className={`admin-batch-row${batch.id === selectedBatchId ? ' admin-batch-row-selected' : ''}`}
                onClick={() => selectBatch(batch.id)}
              >
                <span>{batch.adapter_name} {batch.adapter_version}</span>
                <span>{batch.catalog_sources?.name ?? batch.source_id}</span>
                <span>{batch.status} · {batch.row_count} rows</span>
                <span>{new Date(batch.captured_at).toLocaleString()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedBatchId && (
        <section className="admin-candidate-section">
          <div className="admin-candidate-section-header">
            <h2>Candidates</h2>
            <button type="button" className="btn-primary" disabled={promoting} onClick={handlePromote}>
              {promoting ? 'Promoting…' : 'Promote batch'}
            </button>
          </div>
          {promoteError && <p className="admin-error">{promoteError}</p>}
          {candidatesError && <p className="admin-error">{candidatesError.message}</p>}
          {candidates === null ? (
            <p>Loading…</p>
          ) : (
            <ul className="admin-candidate-list">
              {candidates.map((candidate) => (
                <CandidateRow key={candidate.id} candidate={candidate} onReview={handleReview} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
