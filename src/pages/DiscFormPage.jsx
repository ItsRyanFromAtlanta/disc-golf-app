import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createDiscCopies } from '../lib/discLocker'
import { useCatalog } from '../lib/repository/catalogRepository'
import MoldPicker from '../components/MoldPicker'

const STATUS_OPTIONS = ['in_locker', 'lost', 'retired', 'sold']

const BLANK_FORM = {
  nickname: '',
  weight_grams: '',
  color: '',
  override_speed: '',
  override_glide: '',
  override_turn: '',
  override_fade: '',
  photo_url: '',
  acquired_on: '',
  provenance: '',
  status: 'in_locker',
  condition: '',
  plastic: '',
  notes: '',
}

// Creation only — editing an existing disc's attributes, overrides, and bag
// memberships happens on DiscDetailPage.
export default function DiscFormPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [mold, setMold] = useState(null)
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState(null)
  const catalog = useCatalog()

  // Universe tab hand-off (?mold=<id>&plastic=<name>): prefill the mold and
  // plastic fields rather than building a separate weight-selection drawer.
  useEffect(() => {
    const moldId = searchParams.get('mold')
    if (!moldId) return
    if (catalog.data) {
      const selected = catalog.data.molds.find((candidate) => candidate.id === moldId)
      if (selected) setMold(selected)
      else setError('That mold is no longer in the approved catalog.')
    }
    const plastic = searchParams.get('plastic')
    if (plastic) setForm((prev) => ({ ...prev, plastic }))
  }, [catalog.data, searchParams])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!mold) {
      setError('Pick an approved mold first.')
      return
    }
    setSaving(true)
    setError(null)

    const numOrNull = (v) => (v === '' ? null : Number(v))

    try {
      const saved = await createDiscCopies(user.id, {
        mold_id: mold.id,
        manufacturer: mold.manufacturer,
        mold: mold.mold_name,
        nickname: form.nickname.trim() || null,
        weight_grams: numOrNull(form.weight_grams),
        color: form.color.trim() || null,
        override_speed: numOrNull(form.override_speed),
        override_glide: numOrNull(form.override_glide),
        override_turn: numOrNull(form.override_turn),
        override_fade: numOrNull(form.override_fade),
        photo_url: form.photo_url.trim() || null,
        acquired_on: form.acquired_on || null,
        provenance: form.provenance.trim() || null,
        status: form.status,
        condition: form.condition.trim() || null,
        plastic: form.plastic.trim() || null,
        notes: form.notes.trim() || null,
      }, quantity)
      navigate(saved.length === 1 ? `/bag/discs/${saved[0].id}` : '/bag', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="disc-form-page">
      <header className="practice-header">
        <h1>Add Disc</h1>
        <Link to="/bag/locker" className="link-button">
          Locker
        </Link>
      </header>

      <form onSubmit={handleSubmit} className="putt-form">
        <MoldPicker selectedMold={mold} onSelect={setMold} />

        <label htmlFor="quantity">Physical copies</label>
        <select id="quantity" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}
        </select>
        <p className="log-time">Each copy gets its own identity, photos, lifecycle, and odometer. Creation is all-or-nothing.</p>

        <label htmlFor="nickname">Nickname</label>
        <input
          id="nickname"
          type="text"
          value={form.nickname}
          onChange={(e) => setForm({ ...form, nickname: e.target.value })}
        />

        <label htmlFor="plastic">Plastic</label>
        <input
          id="plastic"
          type="text"
          value={form.plastic}
          onChange={(e) => setForm({ ...form, plastic: e.target.value })}
        />

        <label htmlFor="weight_grams">Weight (g)</label>
        <input
          id="weight_grams"
          type="number"
          min="0"
          value={form.weight_grams}
          onChange={(e) => setForm({ ...form, weight_grams: e.target.value })}
        />

        <label htmlFor="color">Color</label>
        <input id="color" type="text" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />

        <span className="editor-label">
          Flight overrides {mold && <span className="log-time">(blank = mold stock: {mold.speed}/{mold.glide}/{mold.turn}/{mold.fade})</span>}
        </span>
        <div className="flight-number-grid">
          {['speed', 'glide', 'turn', 'fade'].map((axis) => (
            <div key={axis}>
              <label htmlFor={`override_${axis}`}>{axis}</label>
              <input
                id={`override_${axis}`}
                type="number"
                step="0.5"
                placeholder={mold?.[axis] ?? ''}
                value={form[`override_${axis}`]}
                onChange={(e) => setForm({ ...form, [`override_${axis}`]: e.target.value })}
              />
            </div>
          ))}
        </div>

        <label htmlFor="condition">Condition</label>
        <input
          id="condition"
          type="text"
          placeholder="new, worn, beat-in..."
          value={form.condition}
          onChange={(e) => setForm({ ...form, condition: e.target.value })}
        />

        <label htmlFor="status">Status</label>
        <select id="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        <label htmlFor="acquired_on">Acquired on</label>
        <input
          id="acquired_on"
          type="date"
          value={form.acquired_on}
          onChange={(e) => setForm({ ...form, acquired_on: e.target.value })}
        />

        <label htmlFor="provenance">Provenance</label>
        <input
          id="provenance"
          type="text"
          placeholder="bought new, traded, found..."
          value={form.provenance}
          onChange={(e) => setForm({ ...form, provenance: e.target.value })}
        />

        <label htmlFor="photo_url">Photo URL</label>
        <input
          id="photo_url"
          type="text"
          value={form.photo_url}
          onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
        />

        <label htmlFor="notes">Notes</label>
        <textarea id="notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

        {error && <p className="form-error">{error}</p>}

        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : `Add ${quantity} physical ${quantity === 1 ? 'disc' : 'discs'}`}
        </button>
      </form>
    </section>
  )
}
