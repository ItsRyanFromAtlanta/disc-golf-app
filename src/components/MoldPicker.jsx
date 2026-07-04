import { useState } from 'react'
import { searchMolds, createMold } from '../lib/discLocker'

export default function MoldPicker({ selectedMold, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newMold, setNewMold] = useState({ manufacturer: '', mold_name: '', speed: '', glide: '', turn: '', fade: '' })
  const [error, setError] = useState(null)

  async function handleSearch(value) {
    setQuery(value)
    setError(null)
    if (!value.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      setResults(await searchMolds(value))
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  async function handleCreateMold(e) {
    e.preventDefault()
    setError(null)
    try {
      const mold = await createMold({
        manufacturer: newMold.manufacturer.trim(),
        mold_name: newMold.mold_name.trim(),
        speed: newMold.speed === '' ? null : Number(newMold.speed),
        glide: newMold.glide === '' ? null : Number(newMold.glide),
        turn: newMold.turn === '' ? null : Number(newMold.turn),
        fade: newMold.fade === '' ? null : Number(newMold.fade),
      })
      onSelect(mold)
      setCreating(false)
    } catch (err) {
      setError(err.message)
    }
  }

  if (selectedMold) {
    return (
      <div className="mold-picker-selected">
        <span>
          <strong>{selectedMold.manufacturer}</strong> {selectedMold.mold_name}
          {selectedMold.speed != null && (
            <span className="log-time">
              {' '}
              ({selectedMold.speed}/{selectedMold.glide}/{selectedMold.turn}/{selectedMold.fade})
            </span>
          )}
        </span>
        <button type="button" className="link-button" onClick={() => onSelect(null)}>
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="mold-picker">
      <label htmlFor="mold-search">Mold</label>
      <input
        id="mold-search"
        type="text"
        placeholder="Search manufacturer or mold name..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />
      {searching && <p className="loading">Searching...</p>}
      {results.length > 0 && (
        <ul className="mold-picker-results">
          {results.map((mold) => (
            <li key={mold.id}>
              <button type="button" className="mold-picker-result" onClick={() => onSelect(mold)}>
                <strong>{mold.manufacturer}</strong> {mold.mold_name}
                <span className="log-time">
                  {mold.speed}/{mold.glide}/{mold.turn}/{mold.fade}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="form-error">{error}</p>}

      {!creating ? (
        <button type="button" className="link-button" onClick={() => setCreating(true)}>
          Can't find it? Add a new mold
        </button>
      ) : (
        <form onSubmit={handleCreateMold} className="mold-picker-create">
          <label htmlFor="new-mold-manufacturer">Manufacturer</label>
          <input
            id="new-mold-manufacturer"
            type="text"
            required
            value={newMold.manufacturer}
            onChange={(e) => setNewMold({ ...newMold, manufacturer: e.target.value })}
          />
          <label htmlFor="new-mold-name">Mold name</label>
          <input
            id="new-mold-name"
            type="text"
            required
            value={newMold.mold_name}
            onChange={(e) => setNewMold({ ...newMold, mold_name: e.target.value })}
          />
          <div className="flight-number-grid">
            {['speed', 'glide', 'turn', 'fade'].map((axis) => (
              <div key={axis}>
                <label htmlFor={`new-mold-${axis}`}>{axis}</label>
                <input
                  id={`new-mold-${axis}`}
                  type="number"
                  step="0.5"
                  value={newMold[axis]}
                  onChange={(e) => setNewMold({ ...newMold, [axis]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="profile-section-actions">
            <button type="submit">Create mold</button>
            <button type="button" className="link-button" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
