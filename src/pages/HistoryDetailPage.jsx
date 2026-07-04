import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import NotesTagsEditor from '../components/NotesTagsEditor'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function distanceLabel(set) {
  return set.distance_feet_min === set.distance_feet_max
    ? `${set.distance_feet_min} ft`
    : `${set.distance_feet_min}–${set.distance_feet_max} ft`
}

export default function HistoryDetailPage() {
  const { type, id } = useParams()
  const [entry, setEntry] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const query =
        type === 'freeform'
          ? supabase
              .from('putt_sessions')
              .select('id, session_date, notes, tags, created_at, putt_distance_logs(id, distance_feet, makes, attempts, zone, created_at)')
              .eq('id', id)
              .single()
          : supabase
              .from('putting_regimen_runs')
              .select(
                'id, started_at, completed, total_score, notes, tags, putting_regimens(name), putting_regimen_run_sets(id, makes, attempts, longest_streak, clean_set, pressure_putt_made, points_earned, putting_regimen_sets(set_order, distance_feet_min, distance_feet_max, reps_required, pressure_multiplier))',
              )
              .eq('id', id)
              .single()

      const { data, error } = await query
      if (error) setError(error.message)
      else setEntry(data)
    }
    load()
  }, [type, id])

  async function saveNotesTags({ notes, tags }) {
    const table = type === 'freeform' ? 'putt_sessions' : 'putting_regimen_runs'
    const { error } = await supabase.from(table).update({ notes, tags }).eq('id', id)
    if (error) throw error
  }

  if (error) return <p className="form-error">{error}</p>
  if (!entry) return <p className="loading">Loading...</p>

  const isFreeform = type === 'freeform'
  const title = isFreeform ? 'Freeform session' : (entry.putting_regimens?.name ?? 'Regimen run')
  const at = isFreeform ? entry.created_at : entry.started_at

  const runSets = isFreeform
    ? []
    : [...(entry.putting_regimen_run_sets ?? [])].sort(
        (a, b) => (a.putting_regimen_sets?.set_order ?? 0) - (b.putting_regimen_sets?.set_order ?? 0),
      )

  return (
    <section className="history-detail-page">
      <header className="practice-header">
        <h1>{title}</h1>
        <Link to="/practice/history" className="link-button">
          History
        </Link>
      </header>
      <p className="detail-date">
        {formatDate(at)}
        {!isFreeform && (
          <>
            {' · '}
            <span className={entry.completed ? 'zone-badge' : 'abandoned-badge'}>
              {entry.completed ? `Completed · ${entry.total_score} pts` : 'Abandoned'}
            </span>
          </>
        )}
      </p>

      {isFreeform ? (
        <ul className="putt-log-list">
          {(entry.putt_distance_logs ?? []).map((log) => (
            <li key={log.id} className="putt-log-row">
              <span className="zone-badge">{log.zone}</span>
              <span>{log.distance_feet} ft</span>
              <span>
                {log.makes}/{log.attempts} ({Math.round((log.makes / log.attempts) * 100)}%)
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="putt-log-list">
          {runSets.map((set) => (
            <li key={set.id} className="putt-log-row">
              <span>S{set.putting_regimen_sets?.set_order}</span>
              <span>{set.putting_regimen_sets ? distanceLabel(set.putting_regimen_sets) : ''}</span>
              <span>
                {set.makes}/{set.attempts}
              </span>
              <span>streak {set.longest_streak}</span>
              {set.clean_set && <span className="zone-badge">Clean</span>}
              <span className="log-time">
                {set.pressure_putt_made ? '✓' : '✗'} pressure · {set.points_earned} pts
              </span>
            </li>
          ))}
        </ul>
      )}

      <NotesTagsEditor
        key={`${entry.id}-${entry.notes ?? ''}-${(entry.tags ?? []).join()}`}
        initialNotes={entry.notes}
        initialTags={entry.tags}
        onSave={saveNotesTags}
      />
    </section>
  )
}
