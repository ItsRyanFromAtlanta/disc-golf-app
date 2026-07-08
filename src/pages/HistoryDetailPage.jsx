import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { fetchHistory, sessionAggregate, regimenRunAggregate, distanceSamples } from '../lib/history'
import { distanceDropOff, putterBreakdown } from '../lib/insights'
import { fetchUserDiscs } from '../lib/discLocker'
import SessionReport from '../components/sessionReport/SessionReport'

const BASELINE_WINDOW_DAYS = 30

function distanceLabel(set) {
  return set.distance_feet_min === set.distance_feet_max
    ? `${set.distance_feet_min} ft`
    : `${set.distance_feet_min}–${set.distance_feet_max} ft`
}

function discLabel(disc) {
  if (!disc) return 'Unknown disc'
  return disc.nickname || disc.moldInfo?.mold_name || disc.mold
}

export default function HistoryDetailPage() {
  const { type, id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isFreeform = type === 'freeform'

  const [entry, setEntry] = useState(null)
  const [puttEvents, setPuttEvents] = useState([])
  const [discsById, setDiscsById] = useState(new Map())
  const [baselineSamples, setBaselineSamples] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const entryQuery = isFreeform
        ? supabase
            .from('putt_sessions')
            .select(
              'id, session_date, notes, tags, created_at, putt_distance_logs(id, distance_feet, makes, attempts, zone, created_at)',
            )
            .eq('id', id)
            .single()
        : supabase
            .from('putting_regimen_runs')
            .select(
              'id, regimen_id, started_at, completed, total_score, notes, tags, putting_regimens(name), putting_regimen_run_sets(id, makes, attempts, longest_streak, clean_set, pressure_putt_made, points_earned, putting_regimen_sets(set_order, distance_feet_min, distance_feet_max, reps_required, pressure_multiplier))',
            )
            .eq('id', id)
            .single()

      const puttEventsQuery = isFreeform
        ? supabase.from('putt_events').select('outcome, putter_disc_id').eq('freeform_session_id', id)
        : supabase.from('putt_events').select('outcome, putter_disc_id').eq('regimen_run_id', id)

      const [{ data: entryData, error: entryError }, { data: eventsData, error: eventsError }, discs, allHistory] =
        await Promise.all([entryQuery, puttEventsQuery, fetchUserDiscs(user.id), fetchHistory(user.id)])

      if (entryError) {
        setError(entryError.message)
        return
      }
      if (eventsError) {
        setError(eventsError.message)
        return
      }

      setEntry(entryData)
      setPuttEvents(eventsData ?? [])
      setDiscsById(new Map(discs.map((d) => [d.id, d])))

      // Rolling baseline: everything else within 30 days of THIS entry's own
      // timestamp (not "now") — an old history entry compares against its
      // own contemporaneous window, not today's.
      const at = isFreeform ? entryData.created_at : entryData.started_at
      const atMs = new Date(at).getTime()
      const windowMs = BASELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000
      const inWindow = (iso) => {
        const ms = new Date(iso).getTime()
        return ms <= atMs && ms >= atMs - windowMs
      }
      const baselineSessions = allHistory.sessions.filter((s) => s.id !== id && inWindow(s.created_at))
      const baselineRuns = allHistory.runs.filter((r) => r.id !== id && inWindow(r.started_at))
      setBaselineSamples(distanceSamples({ sessions: baselineSessions, runs: baselineRuns }))
    }
    load().catch((err) => setError(err.message))
  }, [type, id, user.id, isFreeform])

  async function saveNotesTags({ notes, tags }) {
    const table = isFreeform ? 'putt_sessions' : 'putting_regimen_runs'
    const { error: saveError } = await supabase.from(table).update({ notes, tags }).eq('id', id)
    if (saveError) throw saveError
  }

  if (error) return <p className="form-error">{error}</p>
  if (!entry) return <p className="loading">Loading...</p>

  const title = isFreeform ? 'Freeform session' : (entry.putting_regimens?.name ?? 'Regimen run')
  const at = isFreeform ? entry.created_at : entry.started_at
  const hero = isFreeform ? sessionAggregate(entry) : regimenRunAggregate(entry)
  const todaySamples = isFreeform
    ? distanceSamples({ sessions: [entry], runs: [] })
    : distanceSamples({ sessions: [], runs: [entry] })

  const rows = isFreeform
    ? (entry.putt_distance_logs ?? []).map((log) => ({
        label: log.zone,
        detail: `${log.distance_feet} ft`,
        makes: log.makes,
        attempts: log.attempts,
      }))
    : [...(entry.putting_regimen_run_sets ?? [])]
        .sort((a, b) => (a.putting_regimen_sets?.set_order ?? 0) - (b.putting_regimen_sets?.set_order ?? 0))
        .map((set, i) => ({
          label: `Set ${i + 1}`,
          detail: set.putting_regimen_sets ? distanceLabel(set.putting_regimen_sets) : '',
          makes: set.makes,
          attempts: set.attempts,
          cleanSet: set.clean_set,
          pointsEarned: set.points_earned,
        }))

  const putterRows = putterBreakdown(puttEvents).map((p) => ({ ...p, label: discLabel(discsById.get(p.putterDiscId)) }))
  const dropOffRows = distanceDropOff(todaySamples, baselineSamples)

  return (
    <SessionReport
      title={title}
      headerAction={
        <Link to="/practice/history" className="link-button">
          History
        </Link>
      }
      at={at}
      completed={isFreeform ? null : entry.completed}
      totalScore={isFreeform ? null : entry.total_score}
      hero={hero}
      rows={rows}
      putterRows={putterRows}
      dropOffRows={dropOffRows}
      notes={entry.notes}
      tags={entry.tags}
      onSaveNotesTags={saveNotesTags}
      onReplay={() => navigate(isFreeform ? '/practice/freeform' : `/practice/regimens/${entry.regimen_id}/run`)}
      onDashboard={() => navigate('/practice')}
    />
  )
}
