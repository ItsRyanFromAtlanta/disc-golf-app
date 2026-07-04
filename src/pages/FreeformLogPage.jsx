import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

function todayLocalDate() {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60 * 1000
  return new Date(now - offsetMs).toISOString().slice(0, 10)
}

export default function FreeformLogPage() {
  const { user, signOut } = useAuth()
  const [distance, setDistance] = useState('')
  const [makes, setMakes] = useState('')
  const [attempts, setAttempts] = useState('')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadTodaysLogs()
  }, [])

  async function loadTodaysLogs() {
    setLoading(true)
    setError(null)

    const { data: sessions, error: sessionError } = await supabase
      .from('putt_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('session_date', todayLocalDate())

    if (sessionError) {
      setError(sessionError.message)
      setLoading(false)
      return
    }

    const sessionIds = sessions.map((s) => s.id)
    if (sessionIds.length === 0) {
      setLogs([])
      setLoading(false)
      return
    }

    const { data: distanceLogs, error: logsError } = await supabase
      .from('putt_distance_logs')
      .select('id, distance_feet, makes, attempts, zone, created_at')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false })

    if (logsError) {
      setError(logsError.message)
      setLoading(false)
      return
    }

    setLogs(distanceLogs)
    setLoading(false)
  }

  async function getOrCreateTodaysSession() {
    const { data: existing, error: findError } = await supabase
      .from('putt_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('session_date', todayLocalDate())
      .limit(1)
      .maybeSingle()

    if (findError) throw findError
    if (existing) return existing.id

    const { data: created, error: createError } = await supabase
      .from('putt_sessions')
      .insert({ user_id: user.id, session_date: todayLocalDate() })
      .select('id')
      .single()

    if (createError) throw createError
    return created.id
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const sessionId = await getOrCreateTodaysSession()
      const { error: insertError } = await supabase.from('putt_distance_logs').insert({
        session_id: sessionId,
        user_id: user.id,
        distance_feet: Number(distance),
        makes: Number(makes),
        attempts: Number(attempts),
      })

      if (insertError) throw insertError

      setDistance('')
      setMakes('')
      setAttempts('')
      await loadTodaysLogs()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="practice-page">
      <header className="practice-header">
        <h1>Freeform Log</h1>
        <button type="button" className="link-button" onClick={signOut}>
          Sign out
        </button>
      </header>

      <p>
        <Link to="/practice">&larr; Practice menu</Link>
      </p>

      <form onSubmit={handleSubmit} className="putt-form">
        <label htmlFor="distance">Distance (feet)</label>
        <input
          id="distance"
          type="number"
          min="1"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          required
        />

        <label htmlFor="makes">Makes</label>
        <input
          id="makes"
          type="number"
          min="0"
          value={makes}
          onChange={(e) => setMakes(e.target.value)}
          required
        />

        <label htmlFor="attempts">Attempts</label>
        <input
          id="attempts"
          type="number"
          min="1"
          value={attempts}
          onChange={(e) => setAttempts(e.target.value)}
          required
        />

        {error && <p className="form-error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Log putts'}
        </button>
      </form>

      <h2>Today's session</h2>
      {loading ? (
        <p className="loading">Loading...</p>
      ) : logs.length === 0 ? (
        <p>No putts logged yet today.</p>
      ) : (
        <ul className="putt-log-list">
          {logs.map((log) => (
            <li key={log.id} className="putt-log-row">
              <span className="zone-badge">{log.zone}</span>
              <span>{log.distance_feet} ft</span>
              <span>
                {log.makes}/{log.attempts} ({Math.round((log.makes / log.attempts) * 100)}%)
              </span>
              <span className="log-time">
                {new Date(log.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
