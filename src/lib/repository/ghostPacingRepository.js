import { supabase } from '../supabaseClient'
import { buildHistoricalGhostProfile } from '../ghostPacing'

function rows(result) {
  if (result.error) throw result.error
  return result.data ?? []
}

export async function fetchGhostPacingProfile(userId, regimenId) {
  const [activitiesResult, runsResult] = await Promise.all([
    supabase.from('activities').select('id').eq('user_id', userId)
      .eq('type', 'putting_regimen').eq('state', 'completed').is('hidden_at', null),
    supabase.from('putting_regimen_runs').select('id, total_score, started_at, completed_at')
      .eq('user_id', userId).eq('regimen_id', regimenId).eq('completed', true),
  ])
  const visibleIds = new Set(rows(activitiesResult).map((activity) => activity.id))
  const runs = rows(runsResult).filter((run) => visibleIds.has(run.id))
  if (!runs.length) return null

  const eventsResult = await supabase.from('putt_events')
    .select('id, regimen_run_id, outcome, set_order, sequence, occurred_at')
    .eq('user_id', userId)
    .in('regimen_run_id', runs.map((run) => run.id))
  return buildHistoricalGhostProfile(runs, rows(eventsResult))
}
