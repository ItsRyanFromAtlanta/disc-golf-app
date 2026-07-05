import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { fetchHistory, distanceSamples, allPuttSamples } from '../lib/history'
import { suggestNextSession } from '../lib/insights'
import { useInstantLaunchSession } from '../hooks/useInstantLaunchSession'
import { usePuttAudio } from '../hooks/usePuttAudio'
import { usePuttHaptics } from '../hooks/usePuttHaptics'
import { syncRows, deleteRowById } from '../lib/instantLaunch/supabaseSync'
import { makeTerritoryPct } from '../lib/instantLaunch/sessionReducer'
import { GESTURE_CONFIG } from '../lib/gestureEngine/config'
import { FSM_STATES } from '../lib/instantLaunch/fsm'
import SessionLauncher from '../components/puttingCanvas/SessionLauncher'
import PuttingCanvas from '../components/puttingCanvas/PuttingCanvas'
import CanvasContextBar from '../components/puttingCanvas/CanvasContextBar'
import GestureZone from '../components/puttingCanvas/GestureZone'
import BatchRibbon from '../components/puttingCanvas/BatchRibbon'
import DiagnosticZonePicker from '../components/puttingCanvas/DiagnosticZonePicker'

const DEFAULT_VOLUME = 10
const QUICK_DISTANCE_PRESETS = [
  { label: '10 ft', distanceFt: 10 },
  { label: '20 ft', distanceFt: 20 },
  { label: '33 ft (C1 edge)', distanceFt: 33 },
]

function todayLocalDate() {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60 * 1000
  return new Date(now - offsetMs).toISOString().slice(0, 10)
}

function stageAt(distanceFt, volumePlanned) {
  return { label: `${distanceFt} ft`, distanceFt, volumePlanned, historicalAvgMakePct: null }
}

export default function FreeformLogPage() {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [error, setError] = useState(null)
  const [suggestion, setSuggestion] = useState(null)
  const [pendingDistance, setPendingDistance] = useState(null)
  const [starting, setStarting] = useState(false)
  const [silenced, setSilenced] = useState(false)
  const [diagnosticMode, setDiagnosticMode] = useState(false)
  const [pendingMiss, setPendingMiss] = useState(null)
  // See RegimenRunPage's identical comment: a batch tap always finishes the
  // whole remaining volume in one shot, so without this the ribbon would be
  // unmounted before its own 3s confirm-then-advance is ever visible.
  const [batchRibbonConfirming, setBatchRibbonConfirming] = useState(false)
  const [nextDistanceInput, setNextDistanceInput] = useState('')
  const [freeformSessionId, setFreeformSessionId] = useState(null)

  const writeAdapter = useMemo(
    () => ({
      syncParentWrites: (rows) => syncRows('putt_sessions', rows),
      syncSummaryWrites: (rows) => syncRows('putt_distance_logs', rows),
      syncPuttEvents: (rows) => syncRows('putt_events', rows),
      deletePuttEvent: (id) => deleteRowById('putt_events', id),
    }),
    [],
  )

  const session = useInstantLaunchSession(writeAdapter, user.id)
  const audio = usePuttAudio()
  const haptics = usePuttHaptics()

  useEffect(() => {
    setDiagnosticMode(session.profileDefaults.diagnosticModeDefault)
  }, [session.profileDefaults.diagnosticModeDefault])

  useEffect(() => {
    audio.setSilenced(silenced)
  }, [silenced, audio])

  useEffect(() => {
    if (session.fsmStatus === FSM_STATES.ACTIVE_SESSION) {
      setFreeformSessionId(session.parentIds?.freeformSessionId ?? null)
    }
  }, [session.fsmStatus, session.parentIds])

  useEffect(() => {
    loadTodaysLogs()
    // Mount-once fetch, same pattern the original page used — loadTodaysLogs
    // is redefined every render, so listing it as a dep would refetch on
    // every render instead of once.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (session.fsmStatus !== FSM_STATES.READY_DEFAULT) return
    fetchHistory(user.id)
      .then((data) => {
        const s = suggestNextSession(data.runs, distanceSamples(data), allPuttSamples(data), new Date())
        setSuggestion(s)
        setPendingDistance(s.suggestedDistanceFt)
      })
      .catch(() => {}) // non-critical — the card just shows a plain start with no suggestion
  }, [session.fsmStatus, user.id])

  async function loadTodaysLogs() {
    setLoadingLogs(true)
    setError(null)

    const { data: sessions, error: sessionError } = await supabase
      .from('putt_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('session_date', todayLocalDate())

    if (sessionError) {
      setError(sessionError.message)
      setLoadingLogs(false)
      return
    }

    const sessionIds = sessions.map((s) => s.id)
    if (sessionIds.length === 0) {
      setLogs([])
      setLoadingLogs(false)
      return
    }

    const { data: distanceLogs, error: logsError } = await supabase
      .from('putt_distance_logs')
      .select('id, distance_feet, makes, attempts, zone, created_at')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false })

    if (logsError) {
      setError(logsError.message)
      setLoadingLogs(false)
      return
    }

    setLogs(distanceLogs)
    setLoadingLogs(false)
  }

  function handleStart() {
    setStarting(true)
    setBatchRibbonConfirming(false)
    const newSessionId = crypto.randomUUID()
    setFreeformSessionId(newSessionId)
    session.startSession({
      sessionType: 'freeform',
      parentIds: { freeformSessionId: newSessionId },
      initialStage: stageAt(pendingDistance, DEFAULT_VOLUME),
      parentWriteRow: {
        id: newSessionId,
        _op: 'insert',
        user_id: user.id,
        session_date: todayLocalDate(),
      },
    })
    setStarting(false)
  }

  function handleGestureMake() {
    audio.playMake()
    haptics.vibrateMake()
    session.gestureMake(new Date().toISOString(), session.sessionState?.stage.distanceFt)
  }

  // See RegimenRunPage's identical comment: feedback is immediate, but the
  // putt_events row itself waits on the zone picker when diagnostic mode is on.
  function handleGestureMiss() {
    audio.playMiss()
    haptics.vibrateMiss()
    const occurredAt = new Date().toISOString()
    const distanceFt = session.sessionState?.stage.distanceFt
    if (diagnosticMode) {
      setPendingMiss({ occurredAt, distanceFt })
    } else {
      session.gestureMiss(occurredAt, distanceFt, null)
    }
  }

  function handleResolveMissZone(missZone) {
    if (pendingMiss) session.gestureMiss(pendingMiss.occurredAt, pendingMiss.distanceFt, missZone)
    setPendingMiss(null)
  }

  function handleUndo() {
    haptics.vibrateUndo()
    session.undo()
  }

  // Returns null (finalize nothing) when nothing was actually logged at this
  // distance — putt_distance_logs requires attempts > 0, so a would-be
  // zero-attempt row needs to be skipped, not sent (see the hook's guard).
  function buildDistanceLogRow(stageState) {
    if (stageState.tally.attempts === 0) return null
    return {
      id: crypto.randomUUID(),
      _op: 'insert',
      session_id: freeformSessionId,
      user_id: user.id,
      distance_feet: stageState.stage.distanceFt,
      makes: stageState.tally.makes,
      attempts: stageState.tally.attempts,
    }
  }

  function handleNewDistance() {
    const nextDistanceFt = Number(nextDistanceInput)
    if (!nextDistanceFt || nextDistanceFt <= 0) return
    setBatchRibbonConfirming(false)
    audio.announceStage(1, 1, nextDistanceFt)
    session.advanceStage(stageAt(nextDistanceFt, DEFAULT_VOLUME), buildDistanceLogRow)
    setNextDistanceInput('')
  }

  function handleEndSession() {
    setBatchRibbonConfirming(false)
    session.endSession(buildDistanceLogRow, null)
    loadTodaysLogs()
  }

  return (
    <section className="practice-page">
      <header className="practice-header">
        <h1>Freeform Log</h1>
        <Link to="/practice" className="link-button">
          Practice menu
        </Link>
      </header>

      {error && <p className="form-error">{error}</p>}

      {session.fsmStatus === FSM_STATES.READY_DEFAULT && (
        <SessionLauncher
          userId={user.id}
          title="Ready when you are"
          suggestion={suggestion}
          presets={QUICK_DISTANCE_PRESETS.map((p) => ({ label: p.label }))}
          favoritePutterId={session.profileDefaults.favoritePutterDiscId}
          onSelectPutter={(discId) => session.updateProfileDefaults({ favoritePutterDiscId: discId })}
          onSelectPreset={(preset) => {
            const match = QUICK_DISTANCE_PRESETS.find((p) => p.label === preset.label)
            if (match) setPendingDistance(match.distanceFt)
          }}
          onStart={handleStart}
          starting={starting}
        />
      )}

      {session.fsmStatus === FSM_STATES.ACTIVE_SESSION && session.sessionState && (
        <PuttingCanvas
          contextBar={
            <CanvasContextBar
              stageLabel={session.sessionState.stage.label}
              stageIndex={1}
              stageCount={1}
              distanceFt={session.sessionState.stage.distanceFt}
              makes={session.sessionState.tally.makes}
              attempts={session.sessionState.tally.attempts}
              volumePlanned={session.sessionState.stage.volumePlanned}
              silenced={silenced}
              onToggleSilence={() => setSilenced((v) => !v)}
              diagnosticMode={diagnosticMode}
              onToggleDiagnostic={() => setDiagnosticMode((v) => !v)}
              syncStatus={session.syncStatus}
              onExit={handleEndSession}
            />
          }
          gestureZone={
            <GestureZone
              onMake={handleGestureMake}
              onMiss={handleGestureMiss}
              onUndo={handleUndo}
              makeTerritoryPct={makeTerritoryPct(session.sessionState.consecutiveMakes)}
              growthCap={GESTURE_CONFIG.ZONE_GROWTH_CAP_PCT}
            />
          }
          batchRibbon={
            <>
              {(session.sessionState.stage.volumePlanned - session.sessionState.tally.attempts > 0 ||
                batchRibbonConfirming) && (
                <BatchRibbon
                  volumePlanned={session.sessionState.stage.volumePlanned - session.sessionState.tally.attempts}
                  historicalAvgMakePct={session.sessionState.stage.historicalAvgMakePct}
                  onComplete={(makes, attempts) => {
                    setBatchRibbonConfirming(true)
                    session.batchComplete(makes, attempts)
                  }}
                />
              )}
              {/* Freeform has no fixed next distance, so the volume target is a
                  nominal default (DEFAULT_VOLUME), not a hard gate — the user
                  can always move to a new distance or end early. */}
              <div className="freeform-next-distance">
                <label htmlFor="next-distance">Next distance (ft)</label>
                <input
                  id="next-distance"
                  type="number"
                  min="1"
                  value={nextDistanceInput}
                  onChange={(e) => setNextDistanceInput(e.target.value)}
                />
                <button type="button" className="start-button" onClick={handleNewDistance}>
                  New distance
                </button>
                <button type="button" className="link-button" onClick={handleEndSession}>
                  End session
                </button>
              </div>
            </>
          }
        />
      )}

      {pendingMiss && (
        <DiagnosticZonePicker
          onSelectZone={handleResolveMissZone}
          onDismiss={() => handleResolveMissZone(null)}
        />
      )}

      <h2>Today's session</h2>
      {loadingLogs ? (
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
                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
