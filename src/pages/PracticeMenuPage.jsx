import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChartBar, IconHistory, IconListNumbers, IconTargetArrow, IconUserCircle } from '@tabler/icons-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import ModeCard from '../components/ModeCard'

const MODES = [
  {
    to: '/practice/freeform',
    icon: IconTargetArrow,
    title: 'Freeform Log',
    description: 'Log makes and attempts at any distance',
  },
  {
    to: '/practice/regimens',
    icon: IconListNumbers,
    title: 'Regimens',
    description: 'Structured sets with scoring and streak bonuses',
  },
  {
    to: '/practice/history',
    icon: IconHistory,
    title: 'History',
    description: 'Every session and run, with streaks and insights',
  },
]

function activityDate(value) {
  // Date-only strings (putt_sessions.session_date) must parse as local time,
  // not UTC midnight, or they display as the previous day in western timezones.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function PracticeMenuPage() {
  const { user, signOut } = useAuth()
  const [recent, setRecent] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  useEffect(() => {
    async function loadRecent() {
      const [{ data: sessions }, { data: runs }] = await Promise.all([
        supabase
          .from('putt_sessions')
          .select('id, session_date, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('putting_regimen_runs')
          .select('id, started_at, completed, total_score, putting_regimens(name)')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(3),
      ])

      const merged = [
        ...(sessions ?? []).map((s) => ({
          id: `session-${s.id}`,
          at: s.created_at,
          label: 'Freeform session',
          detail: null,
        })),
        ...(runs ?? []).map((r) => ({
          id: `run-${r.id}`,
          at: r.started_at,
          label: r.putting_regimens?.name ?? 'Regimen run',
          detail: r.completed ? `${r.total_score} pts` : 'In progress',
        })),
      ]
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, 3)

      setRecent(merged)
      setLoadingRecent(false)
    }

    loadRecent()
  }, [user.id])

  return (
    <section className="practice-menu-page">
      <header className="practice-header">
        <h1>Putting</h1>
        <span className="header-actions">
          <Link to="/profile" className="stats-shortcut" title="Profile">
            <IconUserCircle size={22} stroke={1.75} />
          </Link>
          <Link to="/practice/stats" className="stats-shortcut" title="Confidence map">
            <IconChartBar size={22} stroke={1.75} />
          </Link>
          <button type="button" className="link-button" onClick={signOut}>
            Sign out
          </button>
        </span>
      </header>

      <nav className="mode-card-list">
        {MODES.map((mode) => (
          <ModeCard key={mode.to} {...mode} />
        ))}
      </nav>

      <h2>Recent activity</h2>
      {loadingRecent ? (
        <p className="loading">Loading...</p>
      ) : recent.length === 0 ? (
        <p>No practice logged yet — pick a mode above to get started.</p>
      ) : (
        <ul className="putt-log-list">
          {recent.map((entry) => (
            <li key={entry.id} className="putt-log-row">
              <span>{entry.label}</span>
              <span className="log-time">
                {entry.detail ? `${entry.detail} · ` : ''}
                {activityDate(entry.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
