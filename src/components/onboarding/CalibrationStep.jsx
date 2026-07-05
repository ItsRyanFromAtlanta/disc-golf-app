import { useState } from 'react'
import { usePuttHaptics } from '../../hooks/usePuttHaptics'
import { upsertProfileFields } from '../../lib/profile'
import { UNIT_OPTIONS } from '../../lib/onboarding'
import ChipGroup from '../ChipGroup'

export default function CalibrationStep({ userId, onFinish }) {
  const { supported, vibrateMake } = usePuttHaptics()
  const [units, setUnits] = useState('feet')
  const [tested, setTested] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function handleTest() {
    vibrateMake()
    setTested(true)
  }

  async function handleFinish() {
    setSaving(true)
    setError(null)
    try {
      await upsertProfileFields(userId, { units })
      onFinish()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="onboarding-step">
      <h1>Sensory calibration</h1>
      <p className="splash-tagline">Train the thumb for eyes-free scoring.</p>

      <button type="button" className="haptic-test-pad" onClick={handleTest}>
        📳 Tap to test scoring pulse
      </button>
      {!supported && (
        <p className="form-info">
          Your browser doesn't support vibration feedback — scoring still works fine with on-screen taps.
        </p>
      )}
      {supported && tested && <p className="form-info">Felt that? That's your make pulse.</p>}

      <span className="editor-label">Units</span>
      <ChipGroup
        options={UNIT_OPTIONS}
        getKey={(o) => o.value}
        getLabel={(o) => o.label}
        isActive={(o) => o.value === units}
        onSelect={(o) => setUnits(o.value)}
      />

      {error && <p className="form-error">{error}</p>}

      <button type="button" className="btn-primary" disabled={saving} onClick={handleFinish}>
        {saving ? 'Finishing...' : 'Finish'}
      </button>
    </div>
  )
}
