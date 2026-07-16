import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchBags, fetchBagDiscs, fetchUserDiscs } from '../lib/discLocker'
import { bagViewDiscs, flightChartPoints, capacityTier } from '../lib/bags'
import FlightChart from '../components/FlightChart'
import ChipGroup from '../components/ChipGroup'
import PutterLineup from '../components/putterLineup/PutterLineup'
import UniverseBrowser from '../components/discUniverse/UniverseBrowser'
import BagLockerPage from './BagLockerPage'

const TABS = [
  { key: 'collection', label: 'Collection' },
  { key: 'mybags', label: 'Bags' },
  { key: 'putters', label: '🎯 Putters' },
  { key: 'universe', label: 'Universe' },
]

export default function BagPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('collection')
  const [bags, setBags] = useState(null)
  const [selectedBagId, setSelectedBagId] = useState(null)
  const [discs, setDiscs] = useState([])
  const [allDiscs, setAllDiscs] = useState(null)
  const [baggedDiscIds, setBaggedDiscIds] = useState(new Set())
  const [error, setError] = useState(null)
  const [loadingDiscs, setLoadingDiscs] = useState(false)

  useEffect(() => {
    fetchBags(user.id)
      .then((data) => {
        setBags(data)
        const defaultBag = data.find((b) => b.is_default) ?? data[0]
        setSelectedBagId(defaultBag?.id ?? null)
        return Promise.all(data.map((bag) => fetchBagDiscs(bag.id)))
      })
      .then((bagDiscs) => {
        setBaggedDiscIds(new Set(bagDiscs.flat().map((disc) => disc.id)))
      })
      .catch((err) => setError(err.message))
  }, [user.id])

  // Bag-agnostic: the Universe tab's ghost-slot wishlist and the Putters tab
  // both reason over every owned disc, not just the currently selected bag.
  useEffect(() => {
    fetchUserDiscs(user.id)
      .then(setAllDiscs)
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

  const header = (
    <header className="practice-header">
      <h1>Discs</h1>
    </header>
  )

  const tabHeader = (
    <ChipGroup
      options={TABS}
      getKey={(t) => t.key}
      getLabel={(t) => t.label}
      isActive={(t) => tab === t.key}
      onSelect={(t) => setTab(t.key)}
    />
  )

  if (tab === 'collection') {
    const active = (allDiscs ?? []).filter((disc) => disc.status === 'in_locker')
    const lost = (allDiscs ?? []).filter((disc) => disc.status === 'lost')
    const recent = [...(allDiscs ?? [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3)
    return (
      <section className="bag-page discs-hub-page">
        {header}
        {tabHeader}
        <div className="discs-hub-summary" aria-label="Collection summary">
          <div><strong>{allDiscs?.length ?? 0}</strong><span>Total discs</span></div>
          <div><strong>{active.length}</strong><span>Active</span></div>
          <div><strong>{baggedDiscIds.size}</strong><span>Bagged</span></div>
          <div><strong>{lost.length}</strong><span>Lost</span></div>
        </div>
        <div className="discs-hub-actions">
          <Link to="/bag/lost-found" className="link-button">Lost &amp; Found</Link>
          <Link to="/bag/compare" className="link-button">Compare</Link>
        </div>
        {recent.length > 0 && <p className="log-time">Recently added: {recent.map((disc) => disc.nickname || disc.moldInfo?.mold_name || disc.mold).join(', ')}</p>}
        <BagLockerPage embedded />
      </section>
    )
  }

  if (tab === 'putters') {
    return (
      <section className="bag-page">
        {header}
        {tabHeader}
        <PutterLineup userId={user.id} />
      </section>
    )
  }

  if (tab === 'universe') {
    return (
      <section className="bag-page">
        {header}
        {tabHeader}
        <UniverseBrowser discs={allDiscs ?? []} />
      </section>
    )
  }

  if (bags.length === 0) {
    return (
      <section className="bag-page">
        {header}
        {tabHeader}
        <p>You don't have a bag yet.</p>
        <Link to="/bag/manage" className="start-button">
          Create your first bag
        </Link>
      </section>
    )
  }

  const selectedBag = bags.find((b) => b.id === selectedBagId)
  const discsWithMolds = discs.filter((d) => d.moldInfo).map((disc) => ({ disc, mold: disc.moldInfo }))
  const points = flightChartPoints(discsWithMolds)
  const cap = selectedBag?.capacity ?? 35
  const tier = capacityTier(discs.length, cap)

  return (
    <section className="bag-page">
      {header}
      {tabHeader}

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
        <Link to="/bag/lost-found" className="link-button">
          Lost &amp; Found
        </Link>
      </div>

      <div className="capacity-indicator">
        <span className={tier === 'full' ? 'form-error' : 'log-time'}>
          {discs.length} / {cap} discs
        </span>
        <div className="capacity-bar-track">
          <div
            className={`capacity-bar-fill capacity-bar-fill-${tier}`}
            style={{ width: `${Math.min(100, (discs.length / cap) * 100)}%` }}
          />
        </div>
      </div>

      {tier === 'full' ? (
        <p>
          <span className="start-button" aria-disabled="true">
            Bag full — remove a disc to add another
          </span>
        </p>
      ) : (
        <p>
          <Link to={`/bag/locker?addToBag=${selectedBagId}`} className="start-button">
            Add from locker
          </Link>
        </p>
      )}

      {loadingDiscs ? (
        <p className="loading">Loading...</p>
      ) : discs.length === 0 ? (
        <p>No discs in this bag yet.</p>
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
