import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  fetchBags,
  fetchUserDiscs,
  fetchBagDiscs,
  createBag,
  updateBag,
  deleteBag,
  setDefaultBag,
  addDiscToBag,
  removeDiscFromBag,
} from '../lib/discLocker'
import EditableSection from '../components/EditableSection'
import { loadBagVersions, restoreBagVersion, captureBagVersion } from '../lib/repository/bagHistoryRepository'
import { previewBagRestore } from '../lib/bagHistory'
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

  async function handleSetDefault(bagId) {
    setError(null)
    try {
      await setDefaultBag(bags, bagId)
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteBag(bagId) {
    setError(null)
    try {
      await deleteBag(bagId)
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleToggleMembership(bagId, discId, isMember) {
    setError(null)
    try {
      if (isMember) await removeDiscFromBag(bagId, discId)
      else await addDiscToBag(bagId, discId)
      setMembership((prev) => {
        const next = new Set(prev[bagId])
        if (isMember) next.delete(discId)
        else next.add(discId)
        return { ...prev, [bagId]: next }
      })
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
    setRestorePreview({
      bagId,
      version,
      ...previewBagRestore({
        currentDiscIds: [...(membership[bagId] ?? [])],
        snapshotDiscIds,
        availableDiscIds: discs.filter((disc) => disc.status === 'in_locker').map((disc) => disc.id),
      }),
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
          <EditableSection
            title={bag.name}
            values={{
              name: bag.name,
              description: bag.description ?? '',
              bag_type: bag.bag_type ?? '',
              capacity: bag.capacity ?? '',
            }}
            onSave={async (draft) => {
              await updateBag(bag.id, {
                name: draft.name.trim(),
                description: draft.description.trim() || null,
                bag_type: draft.bag_type.trim() || null,
                capacity: draft.capacity === '' ? null : Number(draft.capacity),
              })
              await captureBagVersion(bag.id)
              await loadAll()
            }}
            renderView={(v) => (
              <dl className="profile-field-list">
                <div>
                  <dt>Description</dt>
                  <dd>{v.description || '—'}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{v.bag_type || '—'}</dd>
                </div>
                <div>
                  <dt>Capacity</dt>
                  <dd>{v.capacity || '—'}</dd>
                </div>
              </dl>
            )}
            renderEdit={(draft, setDraft) => (
              <div className="profile-edit-fields">
                <label htmlFor={`name-${bag.id}`}>Name</label>
                <input
                  id={`name-${bag.id}`}
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
                <label htmlFor={`desc-${bag.id}`}>Description</label>
                <input
                  id={`desc-${bag.id}`}
                  type="text"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
                <label htmlFor={`type-${bag.id}`}>Type</label>
                <input
                  id={`type-${bag.id}`}
                  type="text"
                  placeholder="tournament, practice, all-purpose..."
                  value={draft.bag_type}
                  onChange={(e) => setDraft({ ...draft, bag_type: e.target.value })}
                />
                <label htmlFor={`cap-${bag.id}`}>Capacity</label>
                <input
                  id={`cap-${bag.id}`}
                  type="number"
                  min="0"
                  value={draft.capacity}
                  onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
                />
              </div>
            )}
          />

          <div className="bag-manage-actions">
            {bag.is_default ? (
              <span className="zone-badge">Default</span>
            ) : (
              <button type="button" className="link-button" onClick={() => handleSetDefault(bag.id)}>
                Set as default
              </button>
            )}
            <button type="button" className="link-button" onClick={() => handleDeleteBag(bag.id)}>
              Delete bag
            </button>
          </div>

          <span className="editor-label">Discs in this bag</span>
          {discs.length === 0 ? (
            <p className="loading">No discs in your locker yet.</p>
          ) : (
            <ul className="bag-membership-list">
              {discs.map((disc) => {
                const isMember = membership[bag.id]?.has(disc.id) ?? false
                return (
                  <li key={disc.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={isMember}
                        onChange={() => handleToggleMembership(bag.id, disc.id, isMember)}
                      />{' '}
                      {disc.nickname || disc.moldInfo?.mold_name || disc.mold}
                      {disc.status !== 'in_locker' && <span className="log-time"> ({disc.status})</span>}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}

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
          <p>Add {restorePreview.additions.length} · Remove {restorePreview.removals.length}</p>
          {restorePreview.unavailable.length > 0 && (
            <p>{restorePreview.unavailable.length} unavailable historical disc(s) will remain excluded.</p>
          )}
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
