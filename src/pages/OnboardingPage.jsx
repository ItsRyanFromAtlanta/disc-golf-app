import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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
      {step === 3 && <CalibrationStep userId={user.id} onFinish={() => navigate('/practice', { replace: true })} />}
    </section>
  )
}
