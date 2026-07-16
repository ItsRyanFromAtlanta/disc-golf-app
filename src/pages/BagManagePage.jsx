import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  fetchBags,
  fetchUserDiscs,
  fetchBagDiscs,
  createBag,
} from '../lib/discLocker'
import {
  deleteBagWithReplacement,
  groupedSaveBag,
  loadBagVersions,
  restoreBagVersion,
} from '../lib/repository/bagHistoryRepository'
import { describeRestoreDiscIds, previewBagRestore } from '../lib/bagHistory'
import { bagDraftHasChanges, buildBagDraft } from '../lib/bags'
import { stabilityGaps } from '../lib/wishlist'
import { activeGhostSlots } from '../lib/discTaxonomy'
import { addGhostSlot, loadGhostSlots, removeGhostSlot } from '../lib/repository/discTaxonomyRepository'

export default function BagManagePage() {
  const { user } = useAuth()
  const [bags, setBags] = useState(null)
  const [discs, setDiscs] = useState([])
  const [membership, setMembership] = useState({}) // bagId -> Set of discIds
  const [error, setError] = useState(null)
  const [newBagName, setNewBagName] = useState('')
  const [creating, setCreating] = useState(false)
  const [historyByBag, setHistoryByBag] = useState({})
  const [restorePreview, setRestorePreview] = useState(null)
  const [ghostSlotsByBag, setGhostSlotsByBag] = useState({})
  const [editingBagId, setEditingBagId] = useState(null)
  const [bagDraft, setBagDraft] = useState(null)
  const [savingBagId, setSavingBagId] = useState(null)
  const [replacementByBag, setReplacementByBag] = useState({})

  async function loadAll() {
    const [bagsData, discsData] = await Promise.all([fetchBags(user.id), fetchUserDiscs(user.id)])
    setBags(bagsData)
    setDiscs(discsData)
    const entries = await Promise.all(
      bagsData.map(async (bag) => [bag.id, new Set((await fetchBagDiscs(bag.id)).map((d) => d.id))]),
    )
    setMembership(Object.fromEntries(entries))
  }

  useEffect(() => {
    loadAll().catch((err) => setError(err.message))
  }, [user.id])

  async function handleCreateBag(e) {
    e.preventDefault()
    setError(null)
    try {
      await createBag(user.id, { name: newBagName.trim(), is_default: (bags ?? []).length === 0 })
      setNewBagName('')
      setCreating(false)
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  function startEditingBag(bag) {
    setEditingBagId(bag.id)
    setBagDraft(buildBagDraft(bag, [...(membership[bag.id] ?? [])]))
    setError(null)
  }

  function cancelEditingBag() {
    setEditingBagId(null)
    setBagDraft(null)
    setError(null)
  }

  function toggleDraftMembership(discId) {
    setBagDraft((current) => ({
      ...current,
      discIds: current.discIds.includes(discId)
        ? current.discIds.filter((id) => id !== discId)
        : [...current.discIds, discId],
    }))
  }

  async function saveBag(bag) {
    setError(null)
    setSavingBagId(bag.id)
    try {
      await groupedSaveBag(bag.id, bagDraft)
      setEditingBagId(null)
      setBagDraft(null)
      await loadAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingBagId(null)
    }
  }

  async function handleDeleteBag(bag) {
    setError(null)
    if (!window.confirm(`Delete ${bag.name}? This cannot be undone.`)) return
    try {
      const replacementId = bag.is_default ? replacementByBag[bag.id] : null
      await deleteBagWithReplacement(bag.id, replacementId || null)
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function showHistory(bagId) {
    setError(null)
    try {
      const versions = await loadBagVersions(bagId)
      setHistoryByBag((prev) => ({ ...prev, [bagId]: versions }))
    } catch (err) {
      setError(err.message)
    }
  }

  function previewRestore(bagId, version) {
    const snapshotDiscIds = (version.bag_version_discs ?? []).map((row) => row.disc_id)
    const preview = previewBagRestore({
      currentDiscIds: [...(membership[bagId] ?? [])],
      snapshotDiscIds,
      availableDiscIds: discs.filter((disc) => disc.status === 'in_locker').map((disc) => disc.id),
    })
    setRestorePreview({
      bagId,
      version,
      ...preview,
      labels: describeRestoreDiscIds(preview, discs),
    })
  }

  async function applyRestore() {
    try {
      await restoreBagVersion(restorePreview.version)
      setRestorePreview(null)
      await loadAll()
      await showHistory(restorePreview.bagId)
    } catch (err) {
      setError(err.message)
    }
  }

  async function showGhostSlots(bagId) {
    try {
      const rows = await loadGhostSlots(bagId)
      setGhostSlotsByBag((prev) => ({ ...prev, [bagId]: rows }))
    } catch (err) {
      setError(err.message)
    }
  }

  async function addNextGhostSlot(bagId) {
    const bagDiscs = discs.filter((disc) => membership[bagId]?.has(disc.id))
    const persisted = activeGhostSlots(ghostSlotsByBag[bagId] ?? [])
    const next = stabilityGaps(bagDiscs, { limit: 12 }).find(
      (gap) => !persisted.some((slot) => slot.speed_class === gap.speedClass && slot.stability_class === gap.stabilityClass),
    )
    if (!next) return setError('No uncovered flight slot remains for this bag.')
    try {
      await addGhostSlot(user.id, bagId, {
        speed_class: next.speedClass,
        stability_class: next.stabilityClass,
        target_speed: next.exampleFlightNumbers.speed,
        target_glide: next.exampleFlightNumbers.glide,
        target_turn: next.exampleFlightNumbers.turn,
        target_fade: next.exampleFlightNumbers.fade,
      })
      await showGhostSlots(bagId)
    } catch (err) {
      setError(err.message)
    }
  }

  if (error && !bags) return <p className="form-error">{error}</p>
  if (!bags) return <p className="loading">Loading...</p>

  return (
    <section className="bag-manage-page">
      <header className="practice-header">
        <h1>Manage Bags</h1>
        <Link to="/bag" className="link-button">
          Bag
        </Link>
      </header>

      {error && <p className="form-error">{error}</p>}

      {bags.map((bag) => (
        <div key={bag.id} className="bag-manage-card">
          <section className="profile-section">
            <div className="profile-section-header">
              <h2>{bag.name}</h2>
              {bag.is_default && <span className="zone-badge">Main bag</span>}
              {editingBagId !== bag.id && (
                <button type="button" className="link-button" onClick={() => startEditingBag(bag)}>Edit</button>
              )}
            </div>
            {editingBagId === bag.id ? (
              <div className="profile-section-edit">
                <div className="profile-edit-fields">
                  <label htmlFor={`name-${bag.id}`}>Private bag name</label>
                  <input id={`name-${bag.id}`} type="text" required value={bagDraft.name}
                    onChange={(e) => setBagDraft({ ...bagDraft, name: e.target.value })} />
                  <label htmlFor={`desc-${bag.id}`}>Description</label>
                  <input id={`desc-${bag.id}`} type="text" value={bagDraft.description}
                    onChange={(e) => setBagDraft({ ...bagDraft, description: e.target.value })} />
                  <label htmlFor={`type-${bag.id}`}>Type</label>
                  <input id={`type-${bag.id}`} type="text" placeholder="tournament, practice, all-purpose..."
                    value={bagDraft.bagType} onChange={(e) => setBagDraft({ ...bagDraft, bagType: e.target.value })} />
                  <label htmlFor={`cap-${bag.id}`}>Display capacity</label>
                  <input id={`cap-${bag.id}`} type="number" min="0" max="35" value={bagDraft.capacity}
                    onChange={(e) => setBagDraft({ ...bagDraft, capacity: Number(e.target.value) })} />
                  <label className="bag-main-toggle">
                    <input type="checkbox" checked={bagDraft.makeDefault}
                      disabled={bag.is_default}
                      onChange={(e) => setBagDraft({ ...bagDraft, makeDefault: e.target.checked })} />
                    Main bag {bag.is_default && '(promote another bag to change)'}
                  </label>
                </div>

                <span className="editor-label">Discs · {bagDraft.discIds.length}/35</span>
                {discs.length === 0 ? <p className="loading">No discs in your collection yet.</p> : (
                  <ul className="bag-membership-list">
                    {discs.map((disc) => (
                      <li key={disc.id}>
                        <label>
                          <input type="checkbox" checked={bagDraft.discIds.includes(disc.id)}
                            disabled={!bagDraft.discIds.includes(disc.id) && bagDraft.discIds.length >= 35}
                            onChange={() => toggleDraftMembership(disc.id)} />{' '}
                          {disc.nickname || disc.moldInfo?.mold_name || disc.mold}
                          {disc.status !== 'in_locker' && <span className="log-time"> ({disc.status} · unavailable)</span>}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="log-time">One save updates this bag and creates one immutable version.</p>
                <div className="profile-section-actions">
                  <button type="button" onClick={() => saveBag(bag)}
                    disabled={savingBagId === bag.id || !bagDraft.name.trim()
                      || !bagDraftHasChanges(bag, [...(membership[bag.id] ?? [])], bagDraft)}>
                    {savingBagId === bag.id ? 'Saving…' : 'Save changes'}
                  </button>
                  <button type="button" className="link-button" onClick={cancelEditingBag}
                    disabled={savingBagId === bag.id}>Cancel</button>
                </div>
              </div>
            ) : (
              <dl className="profile-field-list">
                <div>
                  <dt>Description</dt>
                  <dd>{bag.description || '—'}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{bag.bag_type || '—'}</dd>
                </div>
                <div>
                  <dt>Capacity</dt>
                  <dd>{bag.capacity ?? 35}</dd>
                </div>
                <div><dt>Discs</dt><dd>{membership[bag.id]?.size ?? 0}</dd></div>
              </dl>
            )}
          </section>

          <div className="bag-manage-actions">
            {bag.is_default && bags.length > 1 && (
              <select aria-label={`Replacement main bag for ${bag.name}`}
                value={replacementByBag[bag.id] ?? ''}
                onChange={(e) => setReplacementByBag((current) => ({ ...current, [bag.id]: e.target.value }))}>
                <option value="">Choose replacement main bag</option>
                {bags.filter((candidate) => candidate.id !== bag.id).map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                ))}
              </select>
            )}
            <button type="button" className="link-button" onClick={() => handleDeleteBag(bag)}
              disabled={bags.length <= 1 || (bag.is_default && !replacementByBag[bag.id])}>
              Delete bag
            </button>
          </div>

          <div className="bag-history-controls">
            <button type="button" className="link-button" onClick={() => showHistory(bag.id)}>
              Version history
            </button>
            {(historyByBag[bag.id] ?? []).map((version) => (
              <button
                key={version.id}
                type="button"
                className="link-button"
                onClick={() => previewRestore(bag.id, version)}
              >
                v{version.version} · {new Date(version.created_at).toLocaleDateString()}
              </button>
            ))}
          </div>
          <div className="bag-history-controls">
            <button type="button" className="link-button" onClick={() => showGhostSlots(bag.id)}>Ghost slots</button>
            <button type="button" className="link-button" onClick={() => addNextGhostSlot(bag.id)}>Add next gap</button>
            {activeGhostSlots(ghostSlotsByBag[bag.id] ?? []).map((slot) => (
              <button
                key={slot.id}
                type="button"
                className="ghost-slot-card"
                onClick={async () => { await removeGhostSlot(slot); await showGhostSlots(bag.id) }}
              >
                👻 {slot.stability_class} {slot.speed_class} · remove
              </button>
            ))}
          </div>
        </div>
      ))}

      {restorePreview && (
        <div className="bag-manage-card" role="dialog" aria-label="Restore bag version preview">
          <h2>Restore v{restorePreview.version.version}?</h2>
          <p>This applies historical metadata and membership as a new current version.</p>
          <dl className="profile-field-list">
            <div><dt>Name</dt><dd>{restorePreview.version.name}</dd></div>
            <div><dt>Type</dt><dd>{restorePreview.version.bag_type || '—'}</dd></div>
            <div><dt>Capacity</dt><dd>{restorePreview.version.capacity ?? 35}</dd></div>
          </dl>
          {['additions', 'removals', 'unavailable'].map((group) => (
            <div key={group} className="bag-restore-group">
              <h3>{group === 'additions' ? 'Add' : group === 'removals' ? 'Remove' : 'Unavailable placeholders'} · {restorePreview.labels[group].length}</h3>
              {restorePreview.labels[group].length > 0 && (
                <ul>{restorePreview.labels[group].map((disc) => <li key={disc.id}>{disc.label}</li>)}</ul>
              )}
            </div>
          ))}
          {restorePreview.unavailable.length > 0 && <p className="log-time">Unavailable historical discs remain visible here but are excluded from the restored current bag.</p>}
          <div className="profile-section-actions">
            <button type="button" onClick={applyRestore}>Apply as new version</button>
            <button type="button" className="link-button" onClick={() => setRestorePreview(null)}>Cancel</button>
          </div>
        </div>
      )}

      {creating ? (
        <form onSubmit={handleCreateBag} className="putt-form">
          <label htmlFor="new-bag-name">New bag name</label>
          <input id="new-bag-name" type="text" required value={newBagName} onChange={(e) => setNewBagName(e.target.value)} />
          <div className="profile-section-actions">
            <button type="submit">Create</button>
            <button type="button" className="link-button" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="start-button" onClick={() => setCreating(true)}>
          New bag
        </button>
      )}
    </section>
  )
}
