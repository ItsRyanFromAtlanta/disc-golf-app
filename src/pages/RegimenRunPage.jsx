import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { fetchHistory, allPuttSamples } from '../lib/history'
import { decayWeightedForm } from '../lib/insights'
import { computeSetScore, computeCompletionBonus, inferPressurePuttMade } from '../lib/regimenScoring'
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

export default function RegimenRunPage() {
  const { regimenId } = useParams()
  const { user } = useAuth()

  const [regimen, setRegimen] = useState(null)
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [starting, setStarting] = useState(false)
  const [currentFormPct, setCurrentFormPct] = useState(null)
  const [silenced, setSilenced] = useState(false)
  const [diagnosticMode, setDiagnosticMode] = useState(false)
  const [pendingMiss, setPendingMiss] = useState(null)
  // A single batch-ribbon tap always accounts for the ENTIRE remaining
  // volume at once (it's "how did the rest of the stage go," not a partial
  // fill) — so `remaining` always hits 0 on the very same render the tap
  // fires. Without this flag, that would unmount BatchRibbon immediately,
  // before its own 3s confirm-then-advance can ever be seen. Reset whenever
  // a new stage starts.
  const [batchRibbonConfirming, setBatchRibbonConfirming] = useState(false)
  const [phase, setPhase] = useState('running')
  const [completedSets, setCompletedSets] = useState([])
  const [runningTotal, setRunningTotal] = useState(0)
  const [regimenRunId, setRegimenRunId] = useState(null)

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
    audio.setSilenced(silenced)
  }, [silenced, audio])

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

    async function load() {
      setLoading(true)
      setError(null)
      const [{ data: regimenData, error: regimenError }, { data: setsData, error: setsError }] = await Promise.all([
        supabase.from('putting_regimens').select('*').eq('id', regimenId).single(),
        supabase
          .from('putting_regimen_sets')
          .select('*')
          .eq('regimen_id', regimenId)
          .order('set_order', { ascending: true }),
      ])
      if (regimenError || setsError) {
        setError((regimenError || setsError).message)
        setLoading(false)
        return
      }
      setRegimen(regimenData)
      setSets(setsData)
      setLoading(false)
    }
    load()
  }, [regimenId, session.fsmStatus, session.activeRegimenSnapshot, session.parentIds])

  useEffect(() => {
    if (session.fsmStatus !== FSM_STATES.READY_DEFAULT) return
    fetchHistory(user.id)
      .then((data) => setCurrentFormPct(decayWeightedForm(allPuttSamples(data), new Date()).currentFormPct))
      .catch(() => {}) // non-critical — the card just omits the form line on failure
  }, [session.fsmStatus, user.id])

  if (loading) return <p className="loading">Loading...</p>
  if (error) return <p className="form-error">{error}</p>

  const currentSetIndex = session.sessionState?.stage.regimenSetIndex ?? 0
  const currentSet = sets[currentSetIndex]

  function handleStart() {
    setStarting(true)
    setBatchRibbonConfirming(false)
    const newRunId = crypto.randomUUID()
    setRegimenRunId(newRunId)
    setRunningTotal(0)
    setCompletedSets([])
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
    session.gestureMake(new Date().toISOString(), currentSet ? stageDistanceFt(currentSet) : null)
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
      { set: currentSet, makes: stageState.tally.makes, attempts: stageState.tally.attempts, points, cleanSet },
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
    const stageState = session.sessionState
    if (stageState.tally.attempts === 0) {
      session.endSession(null, { id: regimenRunId, _op: 'update', completed: false, completed_at: new Date().toISOString(), total_score: runningTotal })
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
    session.endSession(() => summaryRow, {
      id: regimenRunId,
      _op: 'update',
      completed: false,
      completed_at: new Date().toISOString(),
      total_score: finalTotal,
    })
  }

  if (phase === 'summary') {
    return (
      <section className="regimen-run-page">
        <h1>{regimen.name} complete!</h1>
        <p className="run-total">Total score: {runningTotal}</p>
        <ul className="run-summary-list">
          {completedSets.map((entry, i) => (
            <li key={entry.set.id} className="putt-log-row">
              <span>Set {i + 1}</span>
              <span>{distanceLabel(entry.set)}</span>
              <span>
                {entry.makes}/{entry.attempts}
              </span>
              {entry.cleanSet && <span className="zone-badge">Clean</span>}
              <span className="log-time">{entry.points} pts</span>
            </li>
          ))}
        </ul>
        <Link to="/practice/regimens" className="start-button">
          Back to regimens
        </Link>
      </section>
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
              syncStatus={session.syncStatus}
              onExit={handleAbandon}
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
    </section>
  )
}
