import { GOAL_OPTIONS } from '../../lib/onboarding'

export default function GoalStep({ goal, onSelectGoal, onNext }) {
  return (
    <div className="onboarding-step">
      <h1>What's your main focus?</h1>
      <p className="splash-tagline">We'll tailor your dashboard around this.</p>

      <div className="goal-card-list">
        {GOAL_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`goal-card ${goal === option.id ? 'goal-card-active' : ''}`}
            onClick={() => onSelectGoal(option.id)}
          >
            <span className="goal-card-title">{option.label}</span>
            <span className="goal-card-description">{option.description}</span>
          </button>
        ))}
      </div>

      <button type="button" className="btn-primary" disabled={!goal} onClick={onNext}>
        Continue
      </button>
    </div>
  )
}
