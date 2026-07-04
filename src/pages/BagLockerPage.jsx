import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { IconLayoutGrid, IconList } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { fetchUserDiscs, fetchBags, fetchBagDiscs, addDiscToBag, removeDiscFromBag } from '../lib/discLocker'
import { filterDiscs, sortDiscs } from '../lib/discFilters'
import { getViewMode, setViewMode } from '../lib/viewPreference'
import DiscCard from '../components/DiscCard'

const STATUS_FILTERS = ['all', 'in_locker', 'lost', 'retired', 'sold']

export default function BagLockerPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const addToBagId = searchParams.get('addToBag')

  const [discs, setDiscs] = useState(null)
  const [error, setError] = useState(null)
  const [viewMode, setViewModeState] = useState(getViewMode)

  const [query, setQuery] = useState('')
  const [manufacturer, setManufacturer] = useState('all')
  const [speedFilter, setSpeedFilter] = useState('all')
  const [stabilityFilter, setStabilityFilter] = useState('all')
  const [status, setStatus] = useState('all')
  const [sortKey, setSortKey] = useState('recent')

  // Picker mode (arrived via /bag/locker?addToBag=<bagId>): shows an
  // Add/Added toggle per disc instead of navigating into disc detail.
  const [pickerBag, setPickerBag] = useState(null)
  const [pickerMemberIds, setPickerMemberIds] = useState(new Set())

  useEffect(() => {
    fetchUserDiscs(user.id)
      .then(setDiscs)
      .catch((err) => setError(err.message))
  }, [user.id])

  useEffect(() => {
    if (!addToBagId) {
      setPickerBag(null)
      return
    }
    Promise.all([fetchBags(user.id), fetchBagDiscs(addToBagId)])
      .then(([bags, members]) => {
        setPickerBag(bags.find((b) => b.id === addToBagId) ?? null)
        setPickerMemberIds(new Set(members.map((m) => m.id)))
      })
      .catch((err) => setError(err.message))
  }, [addToBagId, user.id])

  function toggleView(mode) {
    setViewModeState(mode)
    setViewMode(mode)
  }

  async function handleTogglePicked(discId) {
    setError(null)
    const isMember = pickerMemberIds.has(discId)
    try {
      if (isMember) await removeDiscFromBag(addToBagId, discId)
      else await addDiscToBag(addToBagId, discId)
      setPickerMemberIds((prev) => {
        const next = new Set(prev)
        if (isMember) next.delete(discId)
        else next.add(discId)
        return next
      })
    } catch (err) {
      setError(err.message)
    }
  }

  const manufacturers = useMemo(() => {
    if (!discs) return []
    const set = new Set(discs.map((d) => d.moldInfo?.manufacturer ?? d.manufacturer).filter(Boolean))
    return [...set].sort()
  }, [discs])

  const visible = useMemo(() => {
    if (!discs) return []
    const filtered = filterDiscs(discs, { query, manufacturer, speedClass: speedFilter, stability: stabilityFilter, status })
    return sortDiscs(filtered, sortKey)
  }, [discs, query, manufacturer, speedFilter, stabilityFilter, status, sortKey])

  if (error && !discs) return <p className="form-error">{error}</p>
  if (!discs) return <p className="loading">Loading...</p>

  return (
    <section className="bag-locker-page">
      <header className="practice-header">
        <h1>{pickerBag ? `Add to ${pickerBag.name}` : 'Locker'}</h1>
        {pickerBag ? (
          <Link to="/bag" className="link-button">
            Done
          </Link>
        ) : (
          <Link to="/bag" className="link-button">
            Bag
          </Link>
        )}
      </header>

      {error && <p className="form-error">{error}</p>}

      {!pickerBag && (
        <p>
          <Link to="/bag/discs/new" className="start-button">
            Add a disc
          </Link>
        </p>
      )}

      <div className="locker-toolbar">
        <input
          type="text"
          className="locker-search"
          placeholder="Search your discs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="view-toggle">
          <button
            type="button"
            className={`view-toggle-btn ${viewMode === 'grid' ? 'view-toggle-btn-active' : ''}`}
            onClick={() => toggleView('grid')}
            title="Grid view"
          >
            <IconLayoutGrid size={20} stroke={1.75} />
          </button>
          <button
            type="button"
            className={`view-toggle-btn ${viewMode === 'list' ? 'view-toggle-btn-active' : ''}`}
            onClick={() => toggleView('list')}
            title="List view"
          >
            <IconList size={20} stroke={1.75} />
          </button>
        </div>
      </div>

      <div className="locker-filters">
        <select value={manufacturer} onChange={(e) => setManufacturer(e.target.value)}>
          <option value="all">All manufacturers</option>
          {manufacturers.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select value={speedFilter} onChange={(e) => setSpeedFilter(e.target.value)}>
          <option value="all">All speeds</option>
          <option value="putter">Putter</option>
          <option value="midrange">Midrange</option>
          <option value="fairway">Fairway</option>
          <option value="distance">Distance</option>
        </select>
        <select value={stabilityFilter} onChange={(e) => setStabilityFilter(e.target.value)}>
          <option value="all">All stability</option>
          <option value="understable">Understable</option>
          <option value="stable">Stable</option>
          <option value="overstable">Overstable</option>
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
          <option value="recent">Recently added</option>
          <option value="speed">Speed</option>
          <option value="stability">Stability</option>
        </select>
      </div>

      <div className="chip-row">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            className={`chip ${status === s ? 'chip-active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p>No discs match.</p>
      ) : (
        <div className={viewMode === 'grid' ? 'disc-grid' : 'disc-list'}>
          {visible.map((disc) =>
            pickerBag ? (
              <DiscCard
                key={disc.id}
                disc={disc}
                variant={viewMode}
                action={
                  <button
                    type="button"
                    className={`chip disc-card-action ${pickerMemberIds.has(disc.id) ? 'chip-active' : ''}`}
                    onClick={() => handleTogglePicked(disc.id)}
                  >
                    {pickerMemberIds.has(disc.id) ? 'Added' : 'Add'}
                  </button>
                }
              />
            ) : (
              <DiscCard key={disc.id} disc={disc} variant={viewMode} to={`/bag/discs/${disc.id}`} />
            ),
          )}
        </div>
      )}
    </section>
  )
}
