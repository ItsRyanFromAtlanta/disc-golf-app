import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchBags, fetchBagDiscs } from '../lib/discLocker'
import { bagViewDiscs, flightChartPoints } from '../lib/bags'
import FlightChart from '../components/FlightChart'

export default function BagPage() {
  const { user } = useAuth()
  const [bags, setBags] = useState(null)
  const [selectedBagId, setSelectedBagId] = useState(null)
  const [discs, setDiscs] = useState([])
  const [error, setError] = useState(null)
  const [loadingDiscs, setLoadingDiscs] = useState(false)

  useEffect(() => {
    fetchBags(user.id)
      .then((data) => {
        setBags(data)
        const defaultBag = data.find((b) => b.is_default) ?? data[0]
        setSelectedBagId(defaultBag?.id ?? null)
      })
      .catch((err) => setError(err.message))
  }, [user.id])

  useEffect(() => {
    if (!selectedBagId) return
    setLoadingDiscs(true)
    fetchBagDiscs(selectedBagId)
      .then((data) => setDiscs(bagViewDiscs(data)))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingDiscs(false))
  }, [selectedBagId])

  if (error) return <p className="form-error">{error}</p>
  if (!bags) return <p className="loading">Loading...</p>

  if (bags.length === 0) {
    return (
      <section className="bag-page">
        <header className="practice-header">
          <h1>Bag</h1>
          <Link to="/practice" className="link-button">
            Practice menu
          </Link>
        </header>
        <p>You don't have a bag yet.</p>
        <Link to="/bag/manage" className="start-button">
          Create your first bag
        </Link>
      </section>
    )
  }

  const discsWithMolds = discs.filter((d) => d.moldInfo).map((disc) => ({ disc, mold: disc.moldInfo }))
  const points = flightChartPoints(discsWithMolds)

  return (
    <section className="bag-page">
      <header className="practice-header">
        <h1>Bag</h1>
        <Link to="/practice" className="link-button">
          Practice menu
        </Link>
      </header>

      <div className="bag-switcher-row">
        <select value={selectedBagId ?? ''} onChange={(e) => setSelectedBagId(e.target.value)}>
          {bags.map((bag) => (
            <option key={bag.id} value={bag.id}>
              {bag.name}
              {bag.is_default ? ' (default)' : ''}
            </option>
          ))}
        </select>
        <Link to="/bag/manage" className="link-button">
          Manage bags
        </Link>
        <Link to="/bag/locker" className="link-button">
          Locker
        </Link>
      </div>

      {loadingDiscs ? (
        <p className="loading">Loading...</p>
      ) : discs.length === 0 ? (
        <p>No discs in this bag yet — add some from your locker in Manage bags.</p>
      ) : (
        <>
          <FlightChart points={points} />
          <ul className="putt-log-list">
            {discs.map((disc) => (
              <li key={disc.id}>
                <Link to={`/bag/discs/${disc.id}`} className="putt-log-row history-row">
                  <span>{disc.nickname || disc.moldInfo?.mold_name || disc.mold}</span>
                  <span className="log-time">{disc.moldInfo?.manufacturer ?? disc.manufacturer}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
