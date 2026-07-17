import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { fetchHistory, allPuttSamples, distanceSamples } from '../lib/history'
import { decayWeightedForm, distanceDropOff, putterBreakdown } from '../lib/insights'
import { computeSetScore, computeCompletionBonus, inferPressurePuttMade } from '../lib/regimenScoring'
import { suggestBackupSwap } from '../lib/scoringCanvas'
import { useInstantLaunchSession } from '../hooks/useInstantLaunchSession'
import { usePuttAudio } from '../hooks/usePuttAudio'
import { usePuttHaptics } from '../hooks/usePuttHaptics'
import { syncRows, deleteRowById } from '../lib/instantLaunch/supabaseSync'
import { makeTerritoryPct } from '../lib/instantLaunch/sessionReducer'
import { GESTURE_CONFIG } from '../lib/gestureEngine/config'
import { FSM_STATES } from '../lib/instantLaunch/fsm'
import { fetchUserDiscs } from '../lib/discLocker'
import { regimenRepository } from '../lib/repository/regimenRepository'
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

const BASELINE_WINDOW_DAYS = 30

function distanceLabel(set) {
  return set.distance_feet_min === set.distance_feet_max
    ? `${set.distance_feet_min} ft`
    : `${set.distance_feet_min}–${set.distance_feet_max} ft`
}

function stageDistanceFt(regimenSet) {
  return Math.round((regimenSet.distance_feet_min + regimenSet.distance_feet_max) / 2)
}

function stageFromSet(regimenSet, index) {
  return {
    label: `Set ${index + 1}`,
    distanceFt: stageDistanceFt(regimenSet),
    volumePlanned: regimenSet.reps_required,
    historicalAvgMakePct: null,
    regimenSetIndex: index,
    // The real putting_regimen_sets.set_order value (not the array index) —
    // denormalized onto each putt_events row for this stage so 2.5's
    // miss-tendency diagnostics can group by set without re-joining.
    regimenSetOrder: regimenSet.set_order,
  }
}

function discLabel(disc) {
  if (!disc) return null
  return disc.nickname || disc.moldInfo?.mold_name || disc.mold
}

export default function RegimenRunPage() {
  const { regimenId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [regimen, setRegimen] = useState(null)
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [starting, setStarting] = useState(false)
  const [currentFormPct, setCurrentFormPct] = useState(null)
  const [silenced, setSilenced] = useState(false)
  const [diagnosticMode, setDiagnosticMode] = useState(false)
  const [inputMode, setInputMode] = useState('tap')
  const [pendingMiss, setPendingMiss] = useState(null)
  // A single batch-ribbon tap always accounts for the ENTIRE remaining
  // volume at once (it's "how did the rest of the stage go," not a partial
  // fill) — so `remaining` always hits 0 on the very same render the tap
  // fires. Without this flag, that would unmount BatchRibbon immediately,
  // before its own 3s confirm-then-advance can ever be seen. Reset whenever
  // a new stage starts.
  const [batchRibbonConfirming, setBatchRibbonConfirming] = useState(false)
  const [phase, setPhase] = useState('running')
  const [runCompleted, setRunCompleted] = useState(true)
  const [completedSets, setCompletedSets] = useState([])
  const [runningTotal, setRunningTotal] = useState(0)
  const [regimenRunId, setRegimenRunId] = useState(null)

  // Screen 8: mid-round adjustments. allDiscs backs both the active-putter
  // label and the weather->backup swap suggestion; activePutterDiscId is
  // mutable session state (distinct from the profile-level favorite), since
  // an ad-hoc SWAP or accepted weather suggestion changes it mid-round.
  const [allDiscs, setAllDiscs] = useState([])
  const [activePutterDiscId, setActivePutterDiscId] = useState(null)
  const [weatherCondition, setWeatherCondition] = useState(null)
  const [windMph, setWindMph] = useState(null)
  const [swapSuggestionDismissed, setSwapSuggestionDismissed] = useState(false)
  const [showEditDrawer, setShowEditDrawer] = useState(false)

  // Session Summary (Screen 9) — populated once the run reaches 'summary'.
  const [reportPutterRows, setReportPutterRows] = useState([])
  const [reportDropOffRows, setReportDropOffRows] = useState([])
  // Layer 5 gamification: XP/badge banners for the celebration overlay, filled
  // in by the best-effort post-session award below.
  const [celebrationEvents, setCelebrationEvents] = useState([])

  const writeAdapter = useMemo(
    () => ({
      syncParentWrites: (rows) => syncRows('putting_regimen_runs', rows),
      syncSummaryWrites: (rows) => syncRows('putting_regimen_run_sets', rows),
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

  // Active putter starts as the profile favorite, but only once per session
  // (an ad-hoc swap must not get stomped back by this effect re-running).
  useEffect(() => {
    if (session.fsmStatus === FSM_STATES.ACTIVE_SESSION && activePutterDiscId === null) {
      setActivePutterDiscId(session.profileDefaults.favoritePutterDiscId ?? null)
    }
  }, [session.fsmStatus, session.profileDefaults.favoritePutterDiscId, activePutterDiscId])

  // Regimen + sets: skipped when resuming from the cached snapshot — crash
  // recovery must not depend on the network (see the plan's decision #11).
  useEffect(() => {
    if (session.fsmStatus === FSM_STATES.ACTIVE_SESSION && session.activeRegimenSnapshot) {
      setRegimen(session.activeRegimenSnapshot.regimen)
      setSets(session.activeRegimenSnapshot.sets)
      // A fresh mount (e.g. resuming after a killed-and-relaunched PWA) has
      // no regimenRunId in this page's own state yet — recover it from the
      // persisted crash-recovery buffer rather than the component state that
      // only gets set by handleStart within the same page lifetime.
      setRegimenRunId(session.parentIds?.regimenRunId ?? null)
      setLoading(false)
      return
    }

    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const snapshot = await regimenRepository.getWithSets(regimenId, user.id)
        if (!cancelled) {
          setRegimen(snapshot.regimen)
          setSets(snapshot.sets)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message)
          setLoading(false)
        }
        return
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [regimenId, session.fsmStatus, session.activeRegimenSnapshot, session.parentIds, user.id])

  useEffect(() => {
    if (session.fsmStatus !== FSM_STATES.READY_DEFAULT) return
    fetchHistory(user.id)
      .then((data) => setCurrentFormPct(decayWeightedForm(allPuttSamples(data), new Date()).currentFormPct))
      .catch(() => {}) // non-critical — the card just omits the form line on failure
  }, [session.fsmStatus, user.id])

  // Session Summary data: putter breakdown needs this run's putt_events
  // (gesture-captured only, per the data-split rule — may still be mid-sync
  // for an offline finish, in which case this simply under-counts until the
  // outbox flushes and the same run is later viewed via History). The
  // baseline is everything else within 30 days of "now" (this run's own
  // started_at isn't known here without a re-fetch, and "just finished" is
  // near enough to "now" that the difference is immaterial).
  useEffect(() => {
    if (phase !== 'summary' || !regimenRunId) return
    const nowMs = Date.now()
    const windowMs = BASELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000

    Promise.all([
      supabase.from('putt_events').select('outcome, putter_disc_id').eq('regimen_run_id', regimenRunId),
      fetchHistory(user.id),
    ])
      .then(([{ data: events }, history]) => {
        setReportPutterRows(putterBreakdown(events ?? []))
        const baselineSessions = history.sessions.filter((s) => nowMs - new Date(s.created_at).getTime() <= windowMs)
        const baselineRuns = history.runs.filter(
          (r) => r.id !== regimenRunId && nowMs - new Date(r.started_at).getTime() <= windowMs,
        )
        const baseline = distanceSamples({ sessions: baselineSessions, runs: baselineRuns })
        const today = distanceSamples({
          sessions: [],
          runs: [{ putting_regimen_run_sets: completedSets.map((e) => ({ makes: e.makes, attempts: e.attempts, putting_regimen_sets: e.set })) }],
        })
        setReportDropOffRows(distanceDropOff(today, baseline))
      })
      .catch(() => {}) // non-critical — the report just omits these sections on failure
    // completedSets is intentionally excluded: it's only read once, synchronously
    // stable by the time phase flips to 'summary' (the run has already ended).
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, regimenRunId, user.id])

  // Layer 5: award XP + evaluate badges once the run ends. Best-effort and
  // idempotent (session XP keyed by the run id, badge unlocks by earned_at) —
  // an offline finish or a strict-mode double-invoke can't double-count, and a
  // failed award just means no banner now; the Trophy Room's own on-load
  // evaluation reconciles later. Mirrors the summary-data effect's shape.
  useEffect(() => {
    if (phase !== 'summary' || !regimenRunId) return
    const makes = completedSets.reduce((sum, e) => sum + e.makes, 0)
    const cleanStages = completedSets.filter((e) => e.cleanSet).length
    awardPostSession({
      userId: user.id,
      sourceType: XP_SOURCE.REGIMEN_RUN,
      sourceRef: regimenRunId,
      makes,
      cleanStages,
    })
      .then((result) => setCelebrationEvents(celebrationEventsFor(result)))
      .catch(() => {}) // non-critical — XP/badges reconcile on the Trophy Room's next load
    // completedSets excluded for the same reason as the effect above.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, regimenRunId, user.id])

  if (loading) return <p className="loading">Loading...</p>
  if (error) return <p className="form-error">{error}</p>

  const currentSetIndex = session.sessionState?.stage.regimenSetIndex ?? 0
  const currentSet = sets[currentSetIndex]

  const activePutter = allDiscs.find((d) => d.id === activePutterDiscId) ?? null
  const suggestedSwapDisc = swapSuggestionDismissed
    ? null
    : suggestBackupSwap({ weatherCondition, windMph, discs: allDiscs, activePutterDiscId })

  function handleStart() {
    setStarting(true)
    setBatchRibbonConfirming(false)
    setRunCompleted(true)
    setPhase('running')
    const newRunId = crypto.randomUUID()
    setRegimenRunId(newRunId)
    setRunningTotal(0)
    setCompletedSets([])
    setCelebrationEvents([]) // clear the previous session's banner before this one starts
    session.startSession({
      sessionType: 'regimen',
      parentIds: { regimenRunId: newRunId, regimenId },
      activeRegimenSnapshot: { regimen, sets },
      initialStage: stageFromSet(sets[0], 0),
      parentWriteRow: {
        id: newRunId,
        _op: 'insert',
        user_id: user.id,
        regimen_id: regimenId,
        started_at: new Date().toISOString(),
      },
    })
    setStarting(false)
  }

  function handleGestureMake() {
    audio.playMake()
    haptics.vibrateMake()
    session.gestureMake(new Date().toISOString(), currentSet ? stageDistanceFt(currentSet) : null, activePutterDiscId)
  }

  // Sound/haptic feedback fires immediately regardless of diagnostic mode —
  // feel shouldn't wait on the zone picker. The actual putt_events row is
  // deferred until the zone is picked or skipped when diagnostic mode is on,
  // rather than recording it now and patching it afterward (see
  // DiagnosticZonePicker's comment for why).
  function handleGestureMiss() {
    audio.playMiss()
    haptics.vibrateMiss()
    const occurredAt = new Date().toISOString()
    const distanceFt = currentSet ? stageDistanceFt(currentSet) : null
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

  // Computes the current stage's score synchronously (using session.sessionState
  // directly, not a value read back later) so both the summary row and — on the
  // final set — the run's total_score can be built with the real, final number
  // before handing off to the hook, rather than relying on a setState value
  // that wouldn't have committed yet within this same call.
  function handleFinishStage() {
    setBatchRibbonConfirming(false)
    const stageState = session.sessionState
    const isLastSet = currentSetIndex === sets.length - 1
    const pressurePuttMade = inferPressurePuttMade(stageState.tally.makes, stageState.tally.attempts)
    const { points, cleanSet } = computeSetScore(regimen, currentSet, {
      makes: stageState.tally.makes,
      attempts: stageState.tally.attempts,
      longestStreak: stageState.longestStreak,
      pressurePuttMade,
    })

    const summaryRow = {
      id: crypto.randomUUID(),
      _op: 'insert',
      run_id: regimenRunId,
      regimen_set_id: currentSet.id,
      makes: stageState.tally.makes,
      attempts: stageState.tally.attempts,
      longest_streak: stageState.longestStreak,
      clean_set: cleanSet,
      pressure_putt_made: pressurePuttMade,
      points_earned: points,
    }

    setCompletedSets((prev) => [
      ...prev,
      {
        set: currentSet,
        makes: stageState.tally.makes,
        attempts: stageState.tally.attempts,
        points,
        cleanSet,
        longestStreak: stageState.longestStreak,
      },
    ])

    if (isLastSet) {
      const finalTotal = runningTotal + points + computeCompletionBonus(regimen, true)
      setRunningTotal(finalTotal)
      audio.announceStage(currentSetIndex + 1, sets.length, null)
      session.endSession(() => summaryRow, {
        id: regimenRunId,
        _op: 'update',
        completed: true,
        completed_at: new Date().toISOString(),
        total_score: finalTotal,
        weather_condition: weatherCondition,
        wind_mph: windMph,
      })
      setPhase('summary')
    } else {
      setRunningTotal((prev) => prev + points)
      const nextSet = sets[currentSetIndex + 1]
      audio.announceStage(currentSetIndex + 1, sets.length, stageDistanceFt(nextSet))
      session.advanceStage(stageFromSet(nextSet, currentSetIndex + 1), () => summaryRow)
    }
  }

  // Voluntary early exit — distinct from finishing a stage. Finalizes the
  // current (partial) stage's summary row same as usual, but marks the run
  // abandoned (completed: false, same status HistoryPage already renders)
  // rather than completed.
  function handleAbandon() {
    setBatchRibbonConfirming(false)
    setRunCompleted(false)
    const stageState = session.sessionState
    if (stageState.tally.attempts === 0) {
      session.endSession(null, {
        id: regimenRunId,
        _op: 'update',
        completed: false,
        completed_at: new Date().toISOString(),
        total_score: runningTotal,
        weather_condition: weatherCondition,
        wind_mph: windMph,
      })
      setPhase('summary')
      return
    }
    const pressurePuttMade = inferPressurePuttMade(stageState.tally.makes, stageState.tally.attempts)
    const { points, cleanSet } = computeSetScore(regimen, currentSet, {
      makes: stageState.tally.makes,
      attempts: stageState.tally.attempts,
      longestStreak: stageState.longestStreak,
      pressurePuttMade,
    })
    const summaryRow = {
      id: crypto.randomUUID(),
      _op: 'insert',
      run_id: regimenRunId,
      regimen_set_id: currentSet.id,
      makes: stageState.tally.makes,
      attempts: stageState.tally.attempts,
      longest_streak: stageState.longestStreak,
      clean_set: cleanSet,
      pressure_putt_made: pressurePuttMade,
      points_earned: points,
    }
    const finalTotal = runningTotal + points
    setCompletedSets((prev) => [
      ...prev,
      { set: currentSet, makes: stageState.tally.makes, attempts: stageState.tally.attempts, points, cleanSet, longestStreak: stageState.longestStreak },
    ])
    setRunningTotal(finalTotal)
    session.endSession(() => summaryRow, {
      id: regimenRunId,
      _op: 'update',
      completed: false,
      completed_at: new Date().toISOString(),
      total_score: finalTotal,
      weather_condition: weatherCondition,
      wind_mph: windMph,
    })
    setPhase('summary')
  }

  if (phase === 'summary') {
    const hero = {
      makes: completedSets.reduce((sum, e) => sum + e.makes, 0),
      attempts: completedSets.reduce((sum, e) => sum + e.attempts, 0),
      longestStreak: completedSets.reduce((max, e) => Math.max(max, e.longestStreak ?? 0), 0),
    }
    const rows = completedSets.map((entry, i) => ({
      label: `Set ${i + 1}`,
      detail: distanceLabel(entry.set),
      makes: entry.makes,
      attempts: entry.attempts,
      cleanSet: entry.cleanSet,
      pointsEarned: entry.points,
    }))
    const putterRows = reportPutterRows.map((p) => ({
      ...p,
      label: discLabel(allDiscs.find((d) => d.id === p.putterDiscId)) ?? 'Unknown disc',
    }))

    return (
      <SessionReport
        title={`${regimen.name} complete!`}
        at={new Date().toISOString()}
        completed={runCompleted}
        totalScore={runningTotal}
        hero={hero}
        rows={rows}
        putterRows={putterRows}
        dropOffRows={reportDropOffRows}
        celebrationEvents={celebrationEvents}
        onSaveNotesTags={async ({ notes, tags }) => {
          const { error: saveError } = await supabase
            .from('putting_regimen_runs')
            .update({ notes, tags })
            .eq('id', regimenRunId)
          if (saveError) throw saveError
        }}
        onReplay={handleStart}
        onDashboard={() => navigate('/practice')}
      />
    )
  }

  return (
    <section className="regimen-run-page">
      <header className="practice-header">
        <h1>{regimen?.name}</h1>
        <Link to="/practice/regimens" className="link-button">
          Regimens
        </Link>
      </header>

      {session.fsmStatus === FSM_STATES.READY_DEFAULT && (
        <SessionLauncher
          userId={user.id}
          title="Ready when you are"
          suggestion={{ currentFormPct }}
          presets={session.profileDefaults.quickModPresets}
          favoritePutterId={session.profileDefaults.favoritePutterDiscId}
          onSelectPutter={(discId) => session.updateProfileDefaults({ favoritePutterDiscId: discId })}
          onSelectPreset={() => {}}
          onStart={handleStart}
          starting={starting}
        />
      )}

      {session.fsmStatus === FSM_STATES.ACTIVE_SESSION && session.sessionState && (
        <PuttingCanvas
          contextBar={
            <CanvasContextBar
              stageLabel={session.sessionState.stage.label}
              stageIndex={currentSetIndex + 1}
              stageCount={sets.length}
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
              onExit={handleAbandon}
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
              hasPressureLast={(currentSet?.pressure_multiplier ?? 1) > 1}
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
          batchRibbon={(() => {
            const remaining = session.sessionState.stage.volumePlanned - session.sessionState.tally.attempts
            return remaining > 0 || batchRibbonConfirming ? (
              <BatchRibbon
                volumePlanned={remaining}
                historicalAvgMakePct={session.sessionState.stage.historicalAvgMakePct}
                onComplete={(makes, attempts) => {
                  setBatchRibbonConfirming(true)
                  session.batchComplete(makes, attempts)
                }}
                onAdvance={handleFinishStage}
              />
            ) : (
              <button type="button" className="start-button" onClick={handleFinishStage}>
                {currentSetIndex === sets.length - 1 ? 'Finish regimen' : 'Finish set & next'}
              </button>
            )
          })()}
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
    </section>
  )
}
