import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { IconPlus } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { createCustomRegimen, fetchRegimenWithSets } from '../lib/regimens'
import {
  blankStage,
  buildRegimenPayload,
  canAddStage,
  maxScorePreview,
  totalPutts,
  MAX_PUTTS,
} from '../lib/routineBuilder'
import StageCard from '../components/routineBuilder/StageCard'

const BONUS_TOGGLES = [
  { key: 'streak', label: '🔥 Streak bonus' },
  { key: 'clean', label: '✨ Clean-set bonus' },
  { key: 'completion', label: '🏁 Completion bonus' },
]

// Reconstructs builder state from a saved regimen + its sets (Clone & Tweak).
// Custom routines store distance as min==max and pressure as a >1 multiplier, so
// the mapping is lossless for builder-created routines and a faithful approximation
// for the fixed 5.
function builderStateFromRegimen(regimen, sets) {
  return {
    name: `${regimen.name} (copy)`,
    stages: sets.map((s) => ({
      distanceFt: s.distance_feet_min,
      putts: s.reps_required,
      pressure: (s.pressure_multiplier ?? 1) > 1,
    })),
    bonuses: {
      streak: (regimen.streak_step ?? 0) > 0,
      clean: (regimen.no_miss_bonus_pct ?? 0) > 0,
      completion: (regimen.completion_bonus ?? 0) > 0,
    },
  }
}

export default function RoutineBuilderPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const cloneId = searchParams.get('clone')

  const [name, setName] = useState('')
  const [stages, setStages] = useState([blankStage()])
  const [bonuses, setBonuses] = useState({ streak: false, clean: false, completion: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Clone & Tweak prefill.
  useEffect(() => {
    if (!cloneId) return
    fetchRegimenWithSets(cloneId)
      .then(({ regimen, sets }) => {
        const state = builderStateFromRegimen(regimen, sets)
        setName(state.name)
        setStages(state.stages.length ? state.stages : [blankStage()])
        setBonuses(state.bonuses)
      })
      .catch((err) => setError(err.message))
  }, [cloneId])

  function updateStage(index, next) {
    setStages((prev) => prev.map((s, i) => (i === index ? next : s)))
  }

  function deleteStage(index) {
    setStages((prev) => prev.filter((_, i) => i !== index))
  }

  function addStage() {
    // Duplicate the last stage's settings (blueprint: "DUPLICATES STAGE 1 SETTINGS").
    setStages((prev) => [...prev, { ...prev[prev.length - 1] }])
  }

  function toggleBonus(key) {
    setBonuses((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSave(launch) {
    setSaving(true)
    setError(null)
    try {
      const { regimen, sets } = buildRegimenPayload(user.id, { name, stages, bonuses })
      const newId = await createCustomRegimen(user.id, { regimen, sets })
      navigate(launch ? `/practice/regimens/${newId}/run` : '/practice', { replace: true })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const putts = totalPutts(stages)
  const preview = maxScorePreview({ stages, bonuses })
  const addDisabled = !canAddStage(stages)
  const saveDisabled = saving || !name.trim() || stages.length === 0

  return (
    <section className="routine-builder-page">
      <header className="practice-header">
        <h1>Build Routine</h1>
        <Link to="/practice" className="link-button">
          Cancel
        </Link>
      </header>

      {error && <p className="form-error">{error}</p>}

      <label htmlFor="routine-name" className="editor-label">
        Routine name
      </label>
      <input
        id="routine-name"
        type="text"
        className="locker-search"
        placeholder="Morning C1 Calibration"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <span className="editor-label">Scoring bonuses</span>
      <div className="chip-row">
        {BONUS_TOGGLES.map((b) => (
          <button
            key={b.key}
            type="button"
            className={`chip ${bonuses[b.key] ? 'chip-active' : ''}`}
            onClick={() => toggleBonus(b.key)}
          >
            {b.label}
          </button>
        ))}
      </div>

      {stages.map((stage, index) => (
        <StageCard
          key={index}
          index={index}
          stage={stage}
          onChange={(next) => updateStage(index, next)}
          onDelete={() => deleteStage(index)}
          canDelete={stages.length > 1}
        />
      ))}

      <button type="button" className="add-stage-button" onClick={addStage} disabled={addDisabled}>
        <IconPlus size={18} stroke={2} /> Add next stage
        {addDisabled && <span className="log-time"> (100-putt max)</span>}
      </button>

      <div className="routine-totalizer">
        <div className="routine-totalizer-stats">
          <span>
            {stages.length} stage{stages.length === 1 ? '' : 's'}
          </span>
          <span className={putts > MAX_PUTTS ? 'form-error' : ''}>
            {putts} / {MAX_PUTTS} putts
          </span>
          <span>≈ {preview} pts max</span>
        </div>
        <div className="routine-totalizer-actions">
          <button type="button" className="start-button" onClick={() => handleSave(true)} disabled={saveDisabled}>
            {saving ? 'Saving...' : 'Save & Launch'}
          </button>
          <button type="button" className="link-button" onClick={() => handleSave(false)} disabled={saveDisabled}>
            Save for later
          </button>
        </div>
      </div>
    </section>
  )
}
