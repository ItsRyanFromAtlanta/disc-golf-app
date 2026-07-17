import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { availableGoalActions, GOAL_DEFINITIONS } from '../lib/goals'
import { goalRepository } from '../lib/repository/goalRepository'

const today = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}
const actionLabel = { active: 'Resume', paused: 'Pause', completed: 'Complete', cancelled: 'Cancel' }

export default function GoalsPage() {
  const { user } = useAuth()
  const [snapshot, setSnapshot] = useState(null)
  const [type, setType] = useState(GOAL_DEFINITIONS[0].type)
  const [target, setTarget] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setSnapshot(await goalRepository.list(user.id))
  }, [user.id])
  useEffect(() => { load().catch((err) => setError(err.message)) }, [load])

  async function submit(event) {
    event.preventDefault()
    const definition = GOAL_DEFINITIONS.find((item) => item.type === type)
    setBusy(true); setError(null)
    try {
      await goalRepository.create({ type, targetValue: Number(target), unit: definition.unit, startsOn: today(), targetDate })
      setTarget(''); setTargetDate(''); await load()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function transition(goal, status) {
    if (['completed', 'cancelled'].includes(status) && !window.confirm(`${actionLabel[status]} this goal? This status is final.`)) return
    setBusy(true); setError(null)
    try { await goalRepository.transition(goal, status); await load() }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  if (!snapshot && !error) return <p className="loading">Loading goals…</p>
  const goals = snapshot?.goals ?? []
  const eventsByGoal = new Map(goals.map((goal) => [goal.id, (snapshot?.events ?? []).filter((event) => event.goal_id === goal.id)]))

  return <section className="goals-page">
    {error && <p className="form-error">{error}</p>}
    <form className="goal-create-form" onSubmit={submit}>
      <h2>Create a goal</h2>
      <label htmlFor="goal-type">Goal type</label>
      <select id="goal-type" value={type} onChange={(event) => setType(event.target.value)}>{GOAL_DEFINITIONS.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}</select>
      <label htmlFor="goal-target">Target ({GOAL_DEFINITIONS.find((item) => item.type === type).suffix})</label>
      <input id="goal-target" type="number" min="0.01" step="0.01" required value={target} onChange={(event) => setTarget(event.target.value)} />
      <label htmlFor="goal-date">Target date (optional)</label>
      <input id="goal-date" type="date" min={today()} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
      <button className="btn-primary" type="submit" disabled={busy}>Create goal</button>
    </form>
    <section aria-labelledby="goal-list-title"><h2 id="goal-list-title">Your goals</h2>
      {goals.length === 0 ? <p className="career-note">No goals yet. Choose one measurable target to begin.</p> : <div className="goal-lifecycle-list">{goals.map((goal) => {
        const definition = GOAL_DEFINITIONS.find((item) => item.type === goal.goal_type)
        return <article className="goal-lifecycle-card" key={goal.id}>
          <div className="goal-lifecycle-head"><div><h3>{definition?.label ?? goal.goal_type}</h3><strong>{Number(goal.target_value).toLocaleString()} {definition?.suffix}</strong></div><span className={`status-chip status-${goal.status}`}>{goal.status}</span></div>
          <p>Started {new Date(`${goal.starts_on}T00:00:00`).toLocaleDateString()}{goal.target_date ? ` · target ${new Date(`${goal.target_date}T00:00:00`).toLocaleDateString()}` : ''}</p>
          <div className="goal-lifecycle-actions">{availableGoalActions(goal.status).map((status) => <button type="button" key={status} disabled={busy} className={status === 'cancelled' ? 'goal-cancel' : 'link-button'} onClick={() => transition(goal, status)}>{actionLabel[status]}</button>)}</div>
          <details><summary>History ({eventsByGoal.get(goal.id)?.length ?? 0})</summary><ol className="goal-event-list">{(eventsByGoal.get(goal.id) ?? []).map((event) => <li key={event.id}><strong>{event.previous_status ? `${event.previous_status} → ${event.new_status}` : `Created ${event.new_status}`}</strong><time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString()}</time></li>)}</ol></details>
        </article>
      })}</div>}
    </section>
  </section>
}
