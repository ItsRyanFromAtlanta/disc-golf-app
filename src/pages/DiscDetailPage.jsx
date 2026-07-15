import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchDisc, fetchBags, fetchDiscBagIds, addDiscToBag, removeDiscFromBag, upsertDisc } from '../lib/discLocker'
import { effectiveFlightNumbers } from '../lib/discs'
import EditableSection from '../components/EditableSection'
import {
  assignShotTag,
  createShotTag,
  loadDiscShotTags,
  removeShotTagAssignment,
} from '../lib/repository/discTaxonomyRepository'
import { activeShotTagAssignments, assignedShotTags } from '../lib/discTaxonomy'

const STATUS_OPTIONS = ['in_locker', 'lost', 'retired', 'sold']

export default function DiscDetailPage() {
  const { discId } = useParams()
  const { user } = useAuth()

  const [disc, setDisc] = useState(null)
  const [bags, setBags] = useState(null)
  const [memberBagIds, setMemberBagIds] = useState(new Set())
  const [error, setError] = useState(null)
  const [shotTags, setShotTags] = useState([])
  const [shotTagAssignments, setShotTagAssignments] = useState([])
  const [newShotTag, setNewShotTag] = useState('')

  async function loadAll() {
    const [discData, bagsData, bagIds, taxonomy] = await Promise.all([
      fetchDisc(discId),
      fetchBags(user.id),
      fetchDiscBagIds(discId),
      loadDiscShotTags(discId),
    ])
    setDisc(discData)
    setBags(bagsData)
    setMemberBagIds(new Set(bagIds))
    setShotTags(taxonomy.tags)
    setShotTagAssignments(taxonomy.assignments)
  }

  useEffect(() => {
    loadAll().catch((err) => setError(err.message))
  }, [discId, user.id])

  async function handleToggleBag(bagId) {
    setError(null)
    const isMember = memberBagIds.has(bagId)
    try {
      if (isMember) await removeDiscFromBag(bagId, discId)
      else await addDiscToBag(bagId, discId)
      setMemberBagIds((prev) => {
        const next = new Set(prev)
        if (isMember) next.delete(bagId)
        else next.add(bagId)
        return next
      })
    } catch (err) {
      setError(err.message)
    }
  }

  async function saveFields(fields) {
    const updated = await upsertDisc(user.id, discId, fields)
    setDisc(updated)
  }

  async function toggleShotTag(tag) {
    try {
      const active = activeShotTagAssignments(shotTagAssignments)
      const assignment = active.find((row) => row.shot_tag_id === tag.id)
      if (assignment) await removeShotTagAssignment(assignment)
      else await assignShotTag(user.id, discId, tag.id)
      const taxonomy = await loadDiscShotTags(discId)
      setShotTagAssignments(taxonomy.assignments)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreateShotTag(e) {
    e.preventDefault()
    try {
      const tag = await createShotTag(user.id, newShotTag)
      setShotTags((current) => [...current, tag])
      setNewShotTag('')
      await assignShotTag(user.id, discId, tag.id)
      const taxonomy = await loadDiscShotTags(discId)
      setShotTagAssignments(taxonomy.assignments)
    } catch (err) {
      setError(err.message)
    }
  }

  if (error && !disc) return <p className="form-error">{error}</p>
  if (!disc) return <p className="loading">Loading...</p>

  const mold = disc.moldInfo
  const effective = effectiveFlightNumbers(disc, mold)
  const AXES = ['speed', 'glide', 'turn', 'fade']

  return (
    <section className="disc-detail-page">
      <header className="practice-header">
        <h1>{disc.nickname || mold?.mold_name || disc.mold}</h1>
        <Link to="/bag/locker" className="link-button">
          Locker
        </Link>
      </header>

      {error && <p className="form-error">{error}</p>}

      <p className="detail-date">
        {mold?.manufacturer ?? disc.manufacturer} {mold?.mold_name ?? disc.mold}
        {' · '}
        <span className={disc.status === 'in_locker' ? 'zone-badge' : 'abandoned-badge'}>{disc.status}</span>
      </p>

      <h2>Flight numbers</h2>
      <table className="flight-compare-table">
        <thead>
          <tr>
            <th></th>
            {AXES.map((axis) => (
              <th key={axis}>{axis}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Effective</td>
            {AXES.map((axis) => (
              <td key={axis}>
                <strong>{effective[axis] ?? '—'}</strong>
              </td>
            ))}
          </tr>
          <tr>
            <td>Stock ({mold?.mold_name ?? '—'})</td>
            {AXES.map((axis) => (
              <td key={axis}>{mold?.[axis] ?? '—'}</td>
            ))}
          </tr>
        </tbody>
      </table>

      <EditableSection
        title="Details"
        values={{
          nickname: disc.nickname ?? '',
          plastic: disc.plastic ?? '',
          weight_grams: disc.weight_grams ?? '',
          color: disc.color ?? '',
          condition: disc.condition ?? '',
          status: disc.status ?? 'in_locker',
          acquired_on: disc.acquired_on ?? '',
          provenance: disc.provenance ?? '',
          photo_url: disc.photo_url ?? '',
          notes: disc.notes ?? '',
        }}
        onSave={(draft) =>
          saveFields({
            nickname: draft.nickname.trim() || null,
            plastic: draft.plastic.trim() || null,
            weight_grams: draft.weight_grams === '' ? null : Number(draft.weight_grams),
            color: draft.color.trim() || null,
            condition: draft.condition.trim() || null,
            status: draft.status,
            acquired_on: draft.acquired_on || null,
            provenance: draft.provenance.trim() || null,
            photo_url: draft.photo_url.trim() || null,
            notes: draft.notes.trim() || null,
          })
        }
        renderView={(v) => (
          <>
            {v.photo_url && (
              <img src={v.photo_url} alt={v.nickname || 'Disc photo'} className="disc-detail-photo" />
            )}
            <dl className="profile-field-list">
              <div>
                <dt>Nickname</dt>
                <dd>{v.nickname || '—'}</dd>
              </div>
              <div>
                <dt>Plastic</dt>
                <dd>{v.plastic || '—'}</dd>
              </div>
              <div>
                <dt>Weight</dt>
                <dd>{v.weight_grams ? `${v.weight_grams}g` : '—'}</dd>
              </div>
              <div>
                <dt>Color</dt>
                <dd>{v.color || '—'}</dd>
              </div>
              <div>
                <dt>Condition</dt>
                <dd>{v.condition || '—'}</dd>
              </div>
              <div>
                <dt>Acquired</dt>
                <dd>{v.acquired_on || '—'}</dd>
              </div>
              <div>
                <dt>Provenance</dt>
                <dd>{v.provenance || '—'}</dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd>{v.notes || '—'}</dd>
              </div>
            </dl>
          </>
        )}
        renderEdit={(draft, setDraft) => (
          <div className="profile-edit-fields">
            <label htmlFor="d-nickname">Nickname</label>
            <input
              id="d-nickname"
              type="text"
              value={draft.nickname}
              onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
            />
            <label htmlFor="d-plastic">Plastic</label>
            <input
              id="d-plastic"
              type="text"
              value={draft.plastic}
              onChange={(e) => setDraft({ ...draft, plastic: e.target.value })}
            />
            <label htmlFor="d-weight">Weight (g)</label>
            <input
              id="d-weight"
              type="number"
              min="0"
              value={draft.weight_grams}
              onChange={(e) => setDraft({ ...draft, weight_grams: e.target.value })}
            />
            <label htmlFor="d-color">Color</label>
            <input id="d-color" type="text" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
            <label htmlFor="d-condition">Condition</label>
            <input
              id="d-condition"
              type="text"
              value={draft.condition}
              onChange={(e) => setDraft({ ...draft, condition: e.target.value })}
            />
            <label htmlFor="d-status">Status</label>
            <select id="d-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <label htmlFor="d-acquired">Acquired on</label>
            <input
              id="d-acquired"
              type="date"
              value={draft.acquired_on}
              onChange={(e) => setDraft({ ...draft, acquired_on: e.target.value })}
            />
            <label htmlFor="d-provenance">Provenance</label>
            <input
              id="d-provenance"
              type="text"
              value={draft.provenance}
              onChange={(e) => setDraft({ ...draft, provenance: e.target.value })}
            />
            <label htmlFor="d-photo">Photo URL</label>
            <input
              id="d-photo"
              type="text"
              value={draft.photo_url}
              onChange={(e) => setDraft({ ...draft, photo_url: e.target.value })}
            />
            <label htmlFor="d-notes">Notes</label>
            <textarea id="d-notes" rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </div>
        )}
      />

      <EditableSection
        title="Flight overrides"
        values={{
          override_speed: disc.override_speed ?? '',
          override_glide: disc.override_glide ?? '',
          override_turn: disc.override_turn ?? '',
          override_fade: disc.override_fade ?? '',
        }}
        onSave={(draft) =>
          saveFields({
            override_speed: draft.override_speed === '' ? null : Number(draft.override_speed),
            override_glide: draft.override_glide === '' ? null : Number(draft.override_glide),
            override_turn: draft.override_turn === '' ? null : Number(draft.override_turn),
            override_fade: draft.override_fade === '' ? null : Number(draft.override_fade),
          })
        }
        renderView={(v) => (
          <dl className="profile-field-list">
            {AXES.map((axis) => (
              <div key={axis}>
                <dt>{axis}</dt>
                <dd>{v[`override_${axis}`] === '' ? 'mold stock' : v[`override_${axis}`]}</dd>
              </div>
            ))}
          </dl>
        )}
        renderEdit={(draft, setDraft) => (
          <div className="flight-number-grid">
            {AXES.map((axis) => (
              <div key={axis}>
                <label htmlFor={`d-override-${axis}`}>{axis}</label>
                <input
                  id={`d-override-${axis}`}
                  type="number"
                  step="0.5"
                  placeholder={mold?.[axis] ?? ''}
                  value={draft[`override_${axis}`]}
                  onChange={(e) => setDraft({ ...draft, [`override_${axis}`]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
      />

      <h2>Bag memberships</h2>
      {bags.length === 0 ? (
        <p>You don't have any bags yet.</p>
      ) : (
        <ul className="bag-membership-list">
          {bags.map((bag) => {
            const isMember = memberBagIds.has(bag.id)
            return (
              <li key={bag.id} className="bag-membership-row">
                <span>
                  {bag.name}
                  {bag.is_default && <span className="log-time"> (default)</span>}
                </span>
                <button
                  type="button"
                  className={`chip ${isMember ? 'chip-active' : ''}`}
                  onClick={() => handleToggleBag(bag.id)}
                >
                  {isMember ? 'Equipped' : 'Equip'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <h2>Shot tags</h2>
      <p className="log-time">Assigned: {assignedShotTags(shotTags, shotTagAssignments).map((tag) => tag.label).join(', ') || 'none'}</p>
      <div className="chip-group">
        {shotTags.map((tag) => {
          const active = activeShotTagAssignments(shotTagAssignments).some((row) => row.shot_tag_id === tag.id)
          return (
            <button key={tag.id} type="button" className={`chip ${active ? 'chip-active' : ''}`} onClick={() => toggleShotTag(tag)}>
              {tag.label}
            </button>
          )
        })}
      </div>
      <form className="profile-section-actions" onSubmit={handleCreateShotTag}>
        <input value={newShotTag} required placeholder="Custom shot tag" onChange={(e) => setNewShotTag(e.target.value)} />
        <button type="submit">Add tag</button>
      </form>
    </section>
  )
}
