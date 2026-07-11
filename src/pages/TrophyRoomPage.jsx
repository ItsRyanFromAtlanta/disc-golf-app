import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  fetchTrophyRoomData,
  buildBadgeViewModels,
  activePursuits,
  filterCounts,
  applyFilter,
} from '../lib/gamification/trophyRoom'
import XpLevelBar from '../components/trophyRoom/XpLevelBar'
import XpLedgerModal from '../components/trophyRoom/XpLedgerModal'
import ActivePursuits from '../components/trophyRoom/ActivePursuits'
import TrophyWall from '../components/trophyRoom/TrophyWall'
import BadgeInspectDrawer from '../components/trophyRoom/BadgeInspectDrawer'

// Screen 12 — Trophy Room & Progression. RPG XP/level bar + ledger, Active
// Pursuits carousel, and the 4-way filtered trophy wall. (Virtual Bag Tag + QR
// Beam challenge are parked with the Social module — see SCREEN_SPECS.md.)
export default function TrophyRoomPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [inspecting, setInspecting] = useState(null)

  useEffect(() => {
    fetchTrophyRoomData(user.id)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [user.id])

  const viewModels = useMemo(
    () => (data ? buildBadgeViewModels(data.badges, data.progressRows) : []),
    [data],
  )
  const pursuits = useMemo(() => activePursuits(viewModels), [viewModels])
  const counts = useMemo(() => filterCounts(viewModels), [viewModels])
  const visibleBadges = useMemo(() => applyFilter(viewModels, filter), [viewModels, filter])

  // Launch a pursuit drill: drop into the freeform scoring canvas, preconfigured
  // to the badge's relevant distance when it has one (see pursuitDistanceFor).
  function launchPursuit(distanceFt) {
    const query = distanceFt != null ? `?distance=${distanceFt}` : ''
    navigate(`/practice/freeform${query}`)
  }

  if (error) return <p className="form-error">{error}</p>
  if (!data) return <p className="loading">Loading...</p>

  return (
    <section className="trophy-room-page">
      <header className="practice-header">
        <h1>Trophy Room</h1>
        <Link to="/profile" className="link-button">
          Pro
        </Link>
      </header>

      <XpLevelBar xp={Number(data.profile.xp ?? 0)} onOpenLedger={() => setLedgerOpen(true)} />

      <ActivePursuits pursuits={pursuits} onLaunch={launchPursuit} />

      <TrophyWall
        badges={visibleBadges}
        filter={filter}
        counts={counts}
        onFilterChange={setFilter}
        onInspect={setInspecting}
      />

      {ledgerOpen && <XpLedgerModal ledger={data.ledger} onClose={() => setLedgerOpen(false)} />}
      {inspecting && (
        <BadgeInspectDrawer badge={inspecting} onLaunch={launchPursuit} onClose={() => setInspecting(null)} />
      )}
    </section>
  )
}
