import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { persistOnboardingGoal } from '../lib/onboarding'
import GoalStep from '../components/onboarding/GoalStep'
import PutterStep from '../components/onboarding/PutterStep'
import CalibrationStep from '../components/onboarding/CalibrationStep'

const TOTAL_STEPS = 3

// Screen 3 (OnboardingWizardView). A single page with internal step state,
// matching the blueprint's single progress bar rather than three sub-routes
// — there's nothing here worth deep-linking to mid-wizard.
export default function OnboardingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [goal, setGoal] = useState(null)

  // Persisted at Finish, not the moment the choice is made in Step 1: every
  // other provisioning write already happens on the step that owns it (bag +
  // putter at Step 2's `Confirm & Continue`, units at Step 3's `Finish`), and
  // landing the goal there too keeps `profiles` writes for one wizard run in
  // wizard order rather than sending the very first user action straight to
  // the network ahead of everything else.
  //
  // Fire-and-forget (defect register `D-15`): the write is best-effort profile
  // metadata, not something the wizard is gated on, so it must never hold up
  // — or fail — a user who has already finished every step. See
  // `persistOnboardingGoal` in `src/lib/onboarding.js` for why the deploy-lag
  // case resolves quietly and everything else is still swallowed here rather
  // than surfaced, on the same reasoning.
  function handleFinish() {
    persistOnboardingGoal(user.id, goal).catch(() => {})
    navigate('/practice', { replace: true })
  }

  return (
    <section className="onboarding-page">
      <div className="onboarding-progress-track">
        <div className="onboarding-progress-fill" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
      </div>
      <span className="onboarding-progress-label">
        Step {step} of {TOTAL_STEPS}
      </span>

      {step === 1 && <GoalStep goal={goal} onSelectGoal={setGoal} onNext={() => setStep(2)} />}
      {step === 2 && <PutterStep userId={user.id} onNext={() => setStep(3)} />}
      {step === 3 && <CalibrationStep userId={user.id} onFinish={handleFinish} />}
    </section>
  )
}
