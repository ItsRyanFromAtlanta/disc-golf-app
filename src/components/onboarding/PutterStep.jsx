import { useEffect, useState } from 'react'
import { fetchPutterMolds, createBag, upsertDisc, addDiscToBag } from '../../lib/discLocker'
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
} from '../../lib/onboarding'
import ChipGroup from '../ChipGroup'

export default function PutterStep({ userId, onNext }) {
  const [brand, setBrand] = useState(DEFAULT_BRAND)
  const [molds, setMolds] = useState([])
  const [selectedMold, setSelectedMold] = useState(null)
  const [weight, setWeight] = useState(DEFAULT_WEIGHT_GRAMS)
  const [loadingMolds, setLoadingMolds] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoadingMolds(true)
    fetchPutterMolds(brand)
      .then((results) => {
        if (cancelled) return
        setMolds(results)
        setSelectedMold(pickDefaultMold(results))
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoadingMolds(false))
    return () => {
      cancelled = true
    }
  }, [brand])

  async function provision() {
    const bag = await createBag(userId, { name: PRACTICE_STACK_BAG_NAME, is_default: true })
    if (!selectedMold) return bag

    const disc = await upsertDisc(
      userId,
      null,
      buildPutterDiscFields({
        moldId: selectedMold.id,
        manufacturer: selectedMold.manufacturer,
        moldName: selectedMold.mold_name,
        weightGrams: weight,
      }),
    )
    await addDiscToBag(bag.id, disc.id)
    updateInstantLaunchState(applySetProfileDefaults, { favoritePutterDiscId: disc.id })
    return bag
  }

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      await provision()
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
      await createBag(userId, { name: PRACTICE_STACK_BAG_NAME, is_default: true })
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
      {loadingMolds ? (
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
