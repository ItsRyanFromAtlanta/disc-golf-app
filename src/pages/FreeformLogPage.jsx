import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { fetchHistory, distanceSamples, allPuttSamples } from '../lib/history'
import { suggestNextSession, distanceDropOff, putterBreakdown } from '../lib/insights'
import { suggestBackupSwap } from '../lib/scoringCanvas'
import { useInstantLaunchSession } from '../hooks/useInstantLaunchSession'
import { usePuttAudio } from '../hooks/usePuttAudio'
import { usePuttHaptics } from '../hooks/usePuttHaptics'
import { syncRows, deleteRowById } from '../lib/instantLaunch/supabaseSync'
import { makeTerritoryPct } from '../lib/instantLaunch/sessionReducer'
import { GESTURE_CONFIG } from '../lib/gestureEngine/config'
import { FSM_STATES } from '../lib/instantLaunch/fsm'
import { fetchUserDiscs } from '../lib/discLocker'
import { awardPostSession } from '../lib/gamification/badgeEvaluatorService'
import { celebrationEventsFor } from '../lib/gamification/celebration'
import { XP_SOURCE } from '../lib/gamification/constants'
import SessionLauncher from '../components/puttingCanvas/SessionLauncher'
import PuttingCanvas from '../components/puttingCanvas/PuttingCanvas'
import CanvasContextBar from '../components/puttingCanvas/CanvasContextBar'
import CanvasToolbar from '../components/puttingCanvas/CanvasToolbar'
import StackTracker from '../components/puttingCanvas/StackTracker'
import TapZone from '../components/puttingCanvas/TapZone'
import GestureZone from '../components/puttingCanvas/GestureZone'
import PanicZone from '../components/puttingCanvas/PanicZone'
import EditTallyDrawer from '../components/puttingCanvas/EditTallyDrawer'
import BatchRibbon from '../components/puttingCanvas/BatchRibbon'
import DiagnosticZonePicker from '../components/puttingCanvas/DiagnosticZonePicker'
import SessionReport from '../components/sessionReport/SessionReport'

const DEFAULT_VOLUME = 10
const BASELINE_WINDOW_DAYS = 30
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

function discLabel(disc) {
  if (!disc) return null
  return disc.nickname || disc.moldInfo?.mold_name || disc.mold
}

export default function FreeformLogPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // A Trophy Room "Launch pursuit drill" can deep-link a target distance
  // (?distance=NN) to preconfigure the launcher. Seeds pendingDistance below so
  // it wins over the auto-suggested warm-up distance.
  const pursuitDistance = Number(searchParams.get('distance')) || null
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [error, setError] = useState(null)
  const [suggestion, setSuggestion] = useState(null)
  const [pendingDistance, setPendingDistance] = useState(pursuitDistance)
  const [starting, setStarting] = useState(false)
  const [silenced, setSilenced] = useState(false)
  const [diagnosticMode, setDiagnosticMode] = useState(false)
  const [inputMode, setInputMode] = useState('tap')
  const [pendingMiss, setPendingMiss] = useState(null)
  // See RegimenRunPage's identical comment: a batch tap always finishes the
  // whole remaining volume in one shot, so without this the ribbon would be
  // unmounted before its own 3s confirm-then-advance is ever visible.
  const [batchRibbonConfirming, setBatchRibbonConfirming] = useState(false)
  const [nextDistanceInput, setNextDistanceInput] = useState('')
  const [freeformSessionId, setFreeformSessionId] = useState(null)

  // Screen 8: mid-round adjustments — see RegimenRunPage's identical comment.
  const [allDiscs, setAllDiscs] = useState([])
  const [activePutterDiscId, setActivePutterDiscId] = useState(null)
  const [weatherCondition, setWeatherCondition] = useState(null)
  const [windMph, setWindMph] = useState(null)
  const [swapSuggestionDismissed, setSwapSuggestionDismissed] = useState(false)
  const [showEditDrawer, setShowEditDrawer] = useState(false)

  // Session Summary (Screen 9) — freeform previously had no post-session
  // report at all; completedDistances mirrors RegimenRunPage's completedSets
  // (local, since putt_distance_logs rows only exist once synced).
  const [phase, setPhase] = useState('running')
  const [completedDistances, setCompletedDistances] = useState([])
  const [reportPutterRows, setReportPutterRows] = useState([])
  const [reportDropOffRows, setReportDropOffRows] = useState([])
  // Layer 5 gamification: XP/badge banners for the celebration overlay.
  const [celebrationEvents, setCelebrationEvents] = useState([])

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
    setInputMode(session.profileDefaults.inputModeDefault)
  }, [session.profileDefaults.inputModeDefault])

  useEffect(() => {
    audio.setSilenced(silenced)
  }, [silenced, audio])

  useEffect(() => {
    fetchUserDiscs(user.id)
      .then(setAllDiscs)
      .catch(() => {}) // non-critical — swap suggestion/label just stay unavailable
  }, [user.id])

  useEffect(() => {
    if (session.fsmStatus === FSM_STATES.ACTIVE_SESSION && activePutterDiscId === null) {
      setActivePutterDiscId(session.profileDefaults.favoritePutterDiscId ?? null)
    }
  }, [session.fsmStatus, session.profileDefaults.favoritePutterDiscId, activePutterDiscId])

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
        // A pursuit-drill distance (deep-linked) always wins over the auto
        // suggestion; otherwise track the latest suggestion. Keyed off the
        // stable pursuitDistance (not prev) so the launcher's shown distance and
        // the distance the session actually starts at can never diverge.
        setPendingDistance(pursuitDistance ?? s.suggestedDistanceFt)
      })
      .catch(() => {}) // non-critical — the card just shows a plain start with no suggestion
  }, [session.fsmStatus, user.id, pursuitDistance])

  // Session Summary data — see RegimenRunPage's identical comment on the lag
  // this can have for an offline finish (under-counts until the outbox
  // flushes; the same session viewed later via History shows the full picture).
  useEffect(() => {
    if (phase !== 'summary' || !freeformSessionId) return
    const nowMs = Date.now()
    const windowMs = BASELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000

    Promise.all([
      supabase.from('putt_events').select('outcome, putter_disc_id').eq('freeform_session_id', freeformSessionId),
      fetchHistory(user.id),
    ])
      .then(([{ data: events }, history]) => {
        setReportPutterRows(putterBreakdown(events ?? []))
        const baselineSessions = history.sessions.filter(
          (s) => s.id !== freeformSessionId && nowMs - new Date(s.created_at).getTime() <= windowMs,
        )
        const baselineRuns = history.runs.filter((r) => nowMs - new Date(r.started_at).getTime() <= windowMs)
        const baseline = distanceSamples({ sessions: baselineSessions, runs: baselineRuns })
        const today = completedDistances.map((d) => ({
          distanceFeet: d.distanceFt,
          makes: d.makes,
          attempts: d.attempts,
        }))
        setReportDropOffRows(distanceDropOff(today, baseline))
      })
      .catch(() => {}) // non-critical — the report just omits these sections on failure
    // completedDistances is read once, synchronously stable by the time phase
    // flips to 'summary' (the session has already ended).
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, freeformSessionId, user.id])

  // Layer 5: award XP + evaluate badges once the session ends. Freeform has no
  // clean-stage concept (that's a regimen construct), so only per-make XP
  // accrues here. Best-effort + idempotent — see RegimenRunPage's identical
  // comment for the offline/double-invoke reasoning.
  useEffect(() => {
    if (phase !== 'summary' || !freeformSessionId) return
    const makes = completedDistances.reduce((sum, d) => sum + d.makes, 0)
    awardPostSession({
      userId: user.id,
      sourceType: XP_SOURCE.FREEFORM_SESSION,
      sourceRef: freeformSessionId,
      makes,
      cleanStages: 0,
    })
      .then((result) => setCelebrationEvents(celebrationEventsFor(result)))
      .catch(() => {}) // non-critical — reconciles on the Trophy Room's next load
    // completedDistances excluded for the same reason as the effect above.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, freeformSessionId, user.id])

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
    setPhase('running')
    setCompletedDistances([])
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
    session.gestureMake(new Date().toISOString(), session.sessionState?.stage.distanceFt, activePutterDiscId)
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
      session.gestureMiss(occurredAt, distanceFt, null, activePutterDiscId)
    }
  }

  function handleResolveMissZone(missZone) {
    if (pendingMiss) session.gestureMiss(pendingMiss.occurredAt, pendingMiss.distanceFt, missZone, activePutterDiscId)
    setPendingMiss(null)
  }

  function handleUndo() {
    haptics.vibrateUndo()
    session.undo()
  }

  function handleSetWeather({ condition, windMph: nextWindMph }) {
    setWeatherCondition(condition)
    setWindMph(nextWindMph)
    setSwapSuggestionDismissed(false)
  }

  function handleAcceptSwap() {
    if (suggestedSwapDisc) setActivePutterDiscId(suggestedSwapDisc.id)
    setSwapSuggestionDismissed(true)
  }

  function handleEditApply(deltaMakes, deltaAttempts) {
    session.batchComplete(deltaMakes, deltaAttempts)
    setShowEditDrawer(false)
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

  function captureCompletedDistance() {
    const stageState = session.sessionState
    if (stageState.tally.attempts === 0) return
    setCompletedDistances((prev) => [
      ...prev,
      { distanceFt: stageState.stage.distanceFt, makes: stageState.tally.makes, attempts: stageState.tally.attempts },
    ])
  }

  function handleNewDistance() {
    const nextDistanceFt = Number(nextDistanceInput)
    if (!nextDistanceFt || nextDistanceFt <= 0) return
    setBatchRibbonConfirming(false)
    captureCompletedDistance()
    audio.announceStage(1, 1, nextDistanceFt)
    session.advanceStage(stageAt(nextDistanceFt, DEFAULT_VOLUME), buildDistanceLogRow)
    setNextDistanceInput('')
  }

  function handleEndSession() {
    setBatchRibbonConfirming(false)
    captureCompletedDistance()
    const weatherUpdate =
      weatherCondition != null
        ? { id: freeformSessionId, _op: 'update', weather_condition: weatherCondition, wind_mph: windMph }
        : null
    session.endSession(buildDistanceLogRow, weatherUpdate)
    loadTodaysLogs()
    setPhase('summary')
  }

  const activePutter = allDiscs.find((d) => d.id === activePutterDiscId) ?? null
  const suggestedSwapDisc = swapSuggestionDismissed
    ? null
    : suggestBackupSwap({ weatherCondition, windMph, discs: allDiscs, activePutterDiscId })

  // When a pursuit drill deep-linked a distance, show THAT as the launcher's
  // suggested distance (not the algorithmic warm-up) so the label matches the
  // distance the session actually starts at.
  const launcherSuggestion =
    pursuitDistance != null ? { ...(suggestion ?? {}), suggestedDistanceFt: pursuitDistance } : suggestion

  if (phase === 'summary') {
    const hero = {
      makes: completedDistances.reduce((sum, d) => sum + d.makes, 0),
      attempts: completedDistances.reduce((sum, d) => sum + d.attempts, 0),
    }
    const rows = completedDistances.map((d) => ({
      label: `${d.distanceFt} ft`,
      detail: '',
      makes: d.makes,
      attempts: d.attempts,
    }))
    const putterRows = reportPutterRows.map((p) => ({
      ...p,
      label: discLabel(allDiscs.find((d) => d.id === p.putterDiscId)) ?? 'Unknown disc',
    }))

    return (
      <SessionReport
        title="Freeform session complete!"
        at={new Date().toISOString()}
        completed={null}
        totalScore={null}
        hero={hero}
        rows={rows}
        putterRows={putterRows}
        dropOffRows={reportDropOffRows}
        celebrationEvents={celebrationEvents}
        onSaveNotesTags={async ({ notes, tags }) => {
          const { error: saveError } = await supabase
            .from('putt_sessions')
            .update({ notes, tags })
            .eq('id', freeformSessionId)
          if (saveError) throw saveError
        }}
        onReplay={handleStart}
        onDashboard={() => navigate('/practice')}
      />
    )
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
          suggestion={launcherSuggestion}
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
              inputMode={inputMode}
              onChangeInputMode={setInputMode}
              syncStatus={session.syncStatus}
              onExit={handleEndSession}
            />
          }
          toolbar={
            <CanvasToolbar
              userId={user.id}
              activePutterDiscId={activePutterDiscId}
              activePutterLabel={discLabel(activePutter)}
              onSelectPutter={setActivePutterDiscId}
              weatherCondition={weatherCondition}
              windMph={windMph}
              onSetWeather={handleSetWeather}
              suggestedSwapDisc={suggestedSwapDisc}
              onAcceptSwap={handleAcceptSwap}
              onDismissSwap={() => setSwapSuggestionDismissed(true)}
              onEdit={() => setShowEditDrawer(true)}
            />
          }
          stackTracker={
            <StackTracker
              volumePlanned={session.sessionState.stage.volumePlanned}
              events={session.sessionState.events}
              attemptsTotal={session.sessionState.tally.attempts}
              hasPressureLast={false}
            />
          }
          gestureZone={
            inputMode === 'panic' ? (
              <PanicZone onMake={handleGestureMake} onMiss={handleGestureMiss} />
            ) : inputMode === 'gesture' ? (
              <GestureZone
                onMake={handleGestureMake}
                onMiss={handleGestureMiss}
                onUndo={handleUndo}
                makeTerritoryPct={makeTerritoryPct(session.sessionState.consecutiveMakes)}
                growthCap={GESTURE_CONFIG.ZONE_GROWTH_CAP_PCT}
              />
            ) : (
              <TapZone
                onMake={handleGestureMake}
                onMiss={handleGestureMiss}
                onUndo={handleUndo}
                consecutiveMakes={session.sessionState.consecutiveMakes}
              />
            )
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

      {showEditDrawer && session.sessionState && (
        <EditTallyDrawer
          currentMakes={session.sessionState.tally.makes}
          currentAttempts={session.sessionState.tally.attempts}
          onApply={handleEditApply}
          onCancel={() => setShowEditDrawer(false)}
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
