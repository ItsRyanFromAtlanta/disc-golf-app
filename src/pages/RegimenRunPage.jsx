import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { computeSetScore, computeCompletionBonus, isCleanSet } from '../lib/regimenScoring'

function distanceLabel(set) {
  return set.distance_feet_min === set.distance_feet_max
    ? `${set.distance_feet_min} ft`
    : `${set.distance_feet_min}–${set.distance_feet_max} ft`
}

export default function RegimenRunPage() {
  const { regimenId } = useParams()
  const { user } = useAuth()

  const [regimen, setRegimen] = useState(null)
  const [sets, setSets] = useState([])
  const [runId, setRunId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [attempts, setAttempts] = useState('')
  const [makes, setMakes] = useState('')
  const [longestStreak, setLongestStreak] = useState('')
  const [pressurePuttMade, setPressurePuttMade] = useState(false)
  const [saving, setSaving] = useState(false)

  const [completedSets, setCompletedSets] = useState([])
  const [runningTotal, setRunningTotal] = useState(0)
  const [phase, setPhase] = useState('running') // 'running' | 'summary'

  useEffect(() => {
    async function init() {
      setLoading(true)
      setError(null)

      const [{ data: regimenData, error: regimenError }, { data: setsData, error: setsError }] =
        await Promise.all([
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
      setAttempts(String(setsData[0]?.reps_required ?? ''))
      setLoading(false)
    }

    init()
  }, [regimenId])

  const currentSet = sets[currentIndex]
  const numMakes = Number(makes)
  const numAttempts = Number(attempts)
  const clean = attempts !== '' && makes !== '' && isCleanSet(numMakes, numAttempts)
  const pressureLocked = numAttempts > 0 && (numMakes === numAttempts || numMakes === 0)
  const effectivePressureMade = numMakes === numAttempts && numAttempts > 0 ? true : numMakes === 0 ? false : pressurePuttMade

  function resetFormForSet(set) {
    setAttempts(String(set?.reps_required ?? ''))
    setMakes('')
    setLongestStreak('')
    setPressurePuttMade(false)
  }

  async function handleLogSet(e) {
    e.preventDefault()
    setError(null)

    if (numAttempts <= 0 || numMakes < 0 || numMakes > numAttempts) {
      setError('Makes must be between 0 and attempts.')
      return
    }

    const streakValue = longestStreak === '' ? 0 : Number(longestStreak)
    if (streakValue < 0 || streakValue > numMakes) {
      setError('Streak cannot exceed makes.')
      return
    }

    setSaving(true)

    // Create the run lazily on the first logged set so abandoned or
    // double-mounted run pages never leave empty runs behind.
    let activeRunId = runId
    if (!activeRunId) {
      const { data: run, error: runError } = await supabase
        .from('putting_regimen_runs')
        .insert({ user_id: user.id, regimen_id: regimenId })
        .select('id')
        .single()

      if (runError) {
        setError(runError.message)
        setSaving(false)
        return
      }
      activeRunId = run.id
      setRunId(activeRunId)
    }

    const { points, cleanSet } = computeSetScore(regimen, currentSet, {
      makes: numMakes,
      attempts: numAttempts,
      longestStreak: streakValue,
      pressurePuttMade: effectivePressureMade,
    })

    const { error: insertError } = await supabase.from('putting_regimen_run_sets').insert({
      run_id: activeRunId,
      regimen_set_id: currentSet.id,
      makes: numMakes,
      attempts: numAttempts,
      longest_streak: streakValue,
      clean_set: cleanSet,
      pressure_putt_made: effectivePressureMade,
      points_earned: points,
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    const newTotal = runningTotal + points
    const newCompletedSets = [
      ...completedSets,
      { set: currentSet, makes: numMakes, attempts: numAttempts, points, cleanSet },
    ]
    setCompletedSets(newCompletedSets)
    setRunningTotal(newTotal)

    const isLastSet = currentIndex === sets.length - 1

    if (isLastSet) {
      const completionBonus = computeCompletionBonus(regimen, true)
      const finalTotal = newTotal + completionBonus

      const { error: updateError } = await supabase
        .from('putting_regimen_runs')
        .update({ completed: true, completed_at: new Date().toISOString(), total_score: finalTotal })
        .eq('id', activeRunId)

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      setRunningTotal(finalTotal)
      setPhase('summary')
      setSaving(false)
      return
    }

    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)
    resetFormForSet(sets[nextIndex])
    setSaving(false)
  }

  if (loading) return <p className="loading">Loading...</p>
  if (error && !regimen) return <p className="form-error">{error}</p>

  if (phase === 'summary') {
    const completionBonus = regimen.completion_bonus
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
          <li className="putt-log-row">
            <span>Completion bonus</span>
            <span className="log-time">+{completionBonus} pts</span>
          </li>
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
        <h1>{regimen.name}</h1>
        <span>
          Set {currentIndex + 1} / {sets.length}
        </span>
      </header>

      <p>
        Distance: <strong>{distanceLabel(currentSet)}</strong> &middot; Reps:{' '}
        <strong>{currentSet.reps_required}</strong> &middot; Pressure putt &times;
        {currentSet.pressure_multiplier}
      </p>

      <form onSubmit={handleLogSet} className="putt-form">
        <label htmlFor="attempts">Attempts</label>
        <input
          id="attempts"
          type="number"
          min="1"
          value={attempts}
          onChange={(e) => setAttempts(e.target.value)}
          required
        />

        <label htmlFor="makes">Makes</label>
        <input
          id="makes"
          type="number"
          min="0"
          max={attempts || undefined}
          value={makes}
          onChange={(e) => setMakes(e.target.value)}
          required
        />

        <label htmlFor="streak">Longest streak (consecutive makes)</label>
        <input
          id="streak"
          type="number"
          min="0"
          max={makes || undefined}
          value={longestStreak}
          onChange={(e) => setLongestStreak(e.target.value)}
        />

        <label htmlFor="pressure">
          <input
            id="pressure"
            type="checkbox"
            checked={effectivePressureMade}
            disabled={pressureLocked}
            onChange={(e) => setPressurePuttMade(e.target.checked)}
          />{' '}
          Pressure putt (last attempt) made
          {pressureLocked && ' — inferred from makes/attempts'}
        </label>

        {clean && <p className="form-info">Clean set — bonus applies.</p>}
        {error && <p className="form-error">{error}</p>}

        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : currentIndex === sets.length - 1 ? 'Finish regimen' : 'Log set & next'}
        </button>
      </form>
    </section>
  )
}
