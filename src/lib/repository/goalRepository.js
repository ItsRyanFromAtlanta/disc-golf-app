import { db as defaultDb } from '../db/dexieDb'
import { supabase as defaultSupabase } from '../supabaseClient'

export function createGoalRepository({ database = defaultDb, client = defaultSupabase } = {}) {
  async function list(userId) {
    const [goalsResult, eventsResult] = await Promise.all([
      client.from('goals').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
      client.from('goal_events').select('*').eq('user_id', userId).order('occurred_at', { ascending: false }),
    ])
    if (!goalsResult.error && !eventsResult.error) {
      await database.transaction('rw', database.goals, database.goalEvents, async () => {
        await database.goals.bulkPut(goalsResult.data ?? [])
        await database.goalEvents.bulkPut(eventsResult.data ?? [])
      })
      return { goals: goalsResult.data ?? [], events: eventsResult.data ?? [] }
    }
    const [goals, events] = await Promise.all([
      database.goals.where('user_id').equals(userId).reverse().sortBy('updated_at'),
      database.goalEvents.where('user_id').equals(userId).reverse().sortBy('occurred_at'),
    ])
    if (goals.length || events.length) return { goals, events }
    throw goalsResult.error ?? eventsResult.error
  }

  async function create({ type, targetValue, unit, startsOn, targetDate }) {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const { data, error } = await client.rpc('goal_create', {
      p_goal_id: id, p_goal_type: type, p_target_value: targetValue, p_target_unit: unit,
      p_starts_on: startsOn, p_target_date: targetDate || null, p_occurred_at: now,
      p_idempotency_key: `goal-create:${id}`, p_event_id: crypto.randomUUID(),
      p_event_idempotency_key: `goal-event:create:${id}`,
    })
    if (error) throw error
    return data
  }

  async function transition(goal, nextStatus) {
    const eventId = crypto.randomUUID()
    const { data, error } = await client.rpc('goal_transition', {
      p_goal_id: goal.id, p_expected_version: goal.version, p_new_status: nextStatus,
      p_occurred_at: new Date().toISOString(), p_source: 'manual_entry', p_reason: null,
      p_metadata: {}, p_event_id: eventId, p_idempotency_key: `goal-event:${eventId}`,
    })
    if (error) throw error
    return data
  }

  return { list, create, transition }
}

export const goalRepository = createGoalRepository()
