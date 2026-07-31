import { useEffect, useMemo, useState } from 'react'
import { filterCatalogMolds, useCatalog } from '../../lib/repository/catalogRepository'
import { updateInstantLaunchState } from '../../lib/instantLaunch/storage'
import { applySetProfileDefaults } from '../../lib/instantLaunch/stateReducer'
import {
  PUTTER_BRANDS,
  DEFAULT_BRAND,
  PRACTICE_STACK_BAG_NAME,
  MIN_WEIGHT_GRAMS,
  MAX_WEIGHT_GRAMS,
  WEIGHT_STEP_GRAMS,
  DEFAULT_WEIGHT_GRAMS,
  pickDefaultMold,
  clampWeight,
  buildPutterDiscFields,
  provisionPracticeStack,
} from '../../lib/onboarding'
import ChipGroup from '../ChipGroup'

export default function PutterStep({ userId, onNext }) {
  const [brand, setBrand] = useState(DEFAULT_BRAND)
  const [selectedMold, setSelectedMold] = useState(null)
  const [weight, setWeight] = useState(DEFAULT_WEIGHT_GRAMS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const catalog = useCatalog()
  // Minted once per mount, never per attempt — this is what makes a retry a
  // *replay* of the same logical create rather than a second one, on both
  // provisioning paths (D-04). Same reason `createRepository.useCreate` holds a
  // mount-stable `clientId`, and the same reason `D-22`'s course duplicate
  // happens without one.
  const [ids] = useState(() => ({ bagId: crypto.randomUUID(), discId: crypto.randomUUID() }))
  const molds = useMemo(
    () => (catalog.data ? filterCatalogMolds(catalog.data, { manufacturer: brand, category: 'putter' }) : []),
    [brand, catalog.data],
  )

  useEffect(() => {
    setSelectedMold(pickDefaultMold(molds))
  }, [molds])

  // One call for both buttons, differing only in whether a disc is supplied.
  // It is atomic where `provision_practice_stack` is deployed and convergent
  // where it is not, so a second tap after a failed one replays rather than
  // colliding with `bags_one_default_per_user` (D-04).
  async function provision(disc) {
    const result = await provisionPracticeStack(userId, {
      bagId: ids.bagId,
      bagName: PRACTICE_STACK_BAG_NAME,
      discId: ids.discId,
      disc,
    })
    if (result.discId) {
      updateInstantLaunchState(applySetProfileDefaults, { favoritePutterDiscId: result.discId })
    }
    return result
  }

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      await provision(
        selectedMold
          ? buildPutterDiscFields({
              moldId: selectedMold.id,
              manufacturer: selectedMold.manufacturer,
              moldName: selectedMold.mold_name,
              weightGrams: weight,
            })
          : null,
      )
      onNext()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSkip() {
    setSaving(true)
    setError(null)
    try {
      // Skip Setup still genesis-creates the empty Practice Stack bag — that
      // bag's existence is what tells useOnboardingGate this user has been
      // through onboarding at all, so skipping the putter can't also skip
      // that signal or the wizard would loop forever on next launch.
      await provision(null)
      onNext()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="onboarding-step">
      <h1>Select your primary putter</h1>
      <p className="splash-tagline">We'll auto-build your instant Practice Stack.</p>

      <span className="editor-label">1. Brand</span>
      <ChipGroup
        options={PUTTER_BRANDS}
        isActive={(b) => b === brand}
        onSelect={setBrand}
      />

      <span className="editor-label">2. Mold</span>
      {catalog.isLoading ? (
        <p className="loading">Loading molds...</p>
      ) : (
        <div className="mold-radio-list">
          {molds.map((mold) => (
            <button
              key={mold.id}
              type="button"
              className={`mold-radio-card ${selectedMold?.id === mold.id ? 'mold-radio-card-active' : ''}`}
              onClick={() => setSelectedMold(mold)}
            >
              <span>{mold.mold_name}</span>
              <span className="log-time">
                {mold.speed}/{mold.glide}/{mold.turn}/{mold.fade}
              </span>
            </button>
          ))}
        </div>
      )}

      {catalog.error && <p className="form-error">{catalog.error.message}</p>}

      <span className="editor-label">3. Weight (grams)</span>
      <div className="weight-stepper">
        <button
          type="button"
          onClick={() => setWeight((w) => clampWeight(w - WEIGHT_STEP_GRAMS))}
          disabled={weight <= MIN_WEIGHT_GRAMS}
        >
          −
        </button>
        <span className="weight-stepper-value">{weight}g</span>
        <button
          type="button"
          onClick={() => setWeight((w) => clampWeight(w + WEIGHT_STEP_GRAMS))}
          disabled={weight >= MAX_WEIGHT_GRAMS}
        >
          +
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <button type="button" className="btn-primary" disabled={saving} onClick={handleConfirm}>
        {saving ? 'Setting up...' : 'Confirm & Continue'}
      </button>
      <button type="button" className="link-button" disabled={saving} onClick={handleSkip}>
        Skip setup — I'll configure later
      </button>
    </div>
  )
}
