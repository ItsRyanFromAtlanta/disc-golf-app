import { db as defaultDb } from '../db/dexieDb'
import { supabase as defaultSupabase } from '../supabaseClient'

export function createFatigueCheckinRepository({ database = defaultDb, client = defaultSupabase } = {}) {
  async function record(checkin) {
    await database.practiceFatigueCheckins.put(checkin)
    const { error } = await client.from('practice_fatigue_checkins').insert(checkin)
    if (error) return { ...checkin, sync_state: 'pending' }
    return { ...checkin, sync_state: 'synced' }
  }

  async function listForParent({ puttSessionId, regimenRunId }) {
    const field = puttSessionId ? 'putt_session_id' : 'regimen_run_id'
    const value = puttSessionId ?? regimenRunId
    const local = await database.practiceFatigueCheckins.where(field).equals(value).sortBy('recorded_at')
    const { data } = await client.from('practice_fatigue_checkins').select('*').eq(field, value).order('recorded_at')
    if (data?.length) await database.practiceFatigueCheckins.bulkPut(data)
    return data ?? local
  }

  return { record, listForParent }
}

export const fatigueCheckinRepository = createFatigueCheckinRepository()
