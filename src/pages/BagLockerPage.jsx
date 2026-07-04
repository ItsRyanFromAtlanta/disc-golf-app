import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchUserDiscs } from '../lib/discLocker'

const FILTERS = ['All', 'In Locker', 'Lost', 'Retired', 'Sold']
const FILTER_TO_STATUS = {
  'In Locker': 'in_locker',
  Lost: 'lost',
  Retired: 'retired',
  Sold: 'sold',
}

export default function BagLockerPage() {
  const { user } = useAuth()
  const [discs, setDiscs] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    fetchUserDiscs(user.id)
      .then(setDiscs)
      .catch((err) => setError(err.message))
  }, [user.id])

  if (error) return <p className="form-error">{error}</p>
  if (!discs) return <p className="loading">Loading...</p>

  const visible = filter === 'All' ? discs : discs.filter((d) => d.status === FILTER_TO_STATUS[filter])

  return (
    <section className="bag-locker-page">
      <header className="practice-header">
        <h1>Locker</h1>
        <Link to="/bag" className="link-button">
          Bag
        </Link>
      </header>

      <p>
        <Link to="/bag/discs/new" className="start-button">
          Add a disc
        </Link>
      </p>

      <div className="chip-row">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`chip ${filter === f ? 'chip-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p>No discs here.</p>
      ) : (
        <ul className="putt-log-list">
          {visible.map((disc) => (
            <li key={disc.id}>
              <Link to={`/bag/discs/${disc.id}`} className="putt-log-row history-row">
                <span>{disc.nickname || disc.moldInfo?.mold_name || disc.mold}</span>
                <span className="log-time">{disc.moldInfo?.manufacturer ?? disc.manufacturer}</span>
                <span className={disc.status === 'in_locker' ? 'zone-badge' : 'abandoned-badge'}>{disc.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
