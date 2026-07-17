import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { buildCareerSummary } from '../lib/careerSummary'
import { fetchCareerData } from '../lib/repository/careerRepository'
import SkillRadar from '../components/SkillRadar'

const pct = (value) => value == null ? '—' : `${Math.round(value * 100)}%`
const discName = (disc) => disc.nickname || disc.moldInfo?.mold_name || disc.mold || 'Unnamed putter'

export default function CareerHubPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchCareerData(user.id).then(setData).catch((err) => setError(err.message))
  }, [user.id])

  if (error) return <p className="form-error">Career summary unavailable: {error}</p>
  if (!data) return <p className="loading">Loading career summary…</p>
  const summary = buildCareerSummary(data)
  const { profile } = data
  const ratingProgress = profile.current_rating && profile.target_rating
    ? Math.min(100, Math.round(profile.current_rating / profile.target_rating * 100)) : null

  return (
    <section className="career-page">
      <div className="career-actions">
        <Link className="link-button" to="/profile/trophies">Trophies</Link>
        <Link className="link-button" to="/profile/details">Edit profile</Link>
        <Link className="link-button" to="/profile/settings">Settings</Link>
        <Link className="link-button" to="/profile/goals">Goals</Link>
        <Link className="link-button" to="/profile/reports">Reports</Link>
      </div>
      <section className="career-identity" aria-labelledby="career-player-name">
        <span className="career-avatar" aria-hidden="true">🥏</span>
        <div><h1 id="career-player-name">{profile.username || user.email?.split('@')[0] || 'Player'}</h1>
          <p>{profile.pdga_number ? `PDGA #${profile.pdga_number}` : 'PDGA number not linked'}{profile.division ? ` · ${profile.division}` : ''}</p></div>
        {profile.pdga_number && <span className="career-linked-badge">Linked</span>}
        <div className="career-rating"><span>Current {profile.current_rating ?? '—'}</span><span>Target {profile.target_rating ?? '—'}</span>
          <div className="career-progress" aria-label={ratingProgress == null ? 'Rating progress unavailable' : `Rating progress ${ratingProgress}%`}><span style={{ width: `${ratingProgress ?? 0}%` }} /></div></div>
      </section>
      <h2>Career telemetry</h2>
      <div className="career-stat-grid">
        <article><strong>{summary.lifetime.attempts.toLocaleString()}</strong><span>Lifetime putts</span></article>
        <article><strong>{pct(summary.lifetime.accuracy)}</strong><span>Lifetime conversion</span></article>
        <article><strong>{summary.sessionCount}</strong><span>Practice sessions</span></article>
      </div>
      <section className="career-panel"><h2>Skill radar</h2><p className="career-note">Personal evidence only; division benchmarks remain unavailable.</p><SkillRadar axes={summary.axes} /></section>
      <section className="career-panel"><h2>Most trusted putter</h2>
        {summary.trustedPutter ? <div className="career-trusted"><strong>{discName(summary.trustedPutter)}</strong><span>{summary.trustedPutter.total_chain_hits.toLocaleString()} chain hits · {pct(summary.trustedPutter.accuracy.pct)} across {summary.trustedPutter.accuracy.attempts} attributed putts</span></div>
          : <p className="career-note">Log real-time putts with a selected putter to unlock this audit. Batch totals cannot be attributed to a physical disc.</p>}
      </section>
    </section>
  )
}
