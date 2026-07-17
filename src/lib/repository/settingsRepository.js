import { db as defaultDb } from '../db/dexieDb'
import { supabase as defaultSupabase } from '../supabaseClient'

export function createSettingsRepository({ database = defaultDb, client = defaultSupabase } = {}) {
  async function listNotificationPreferences(userId) {
    const { data, error } = await client.from('notification_preferences').select('*').eq('user_id', userId)
    if (!error) {
      await database.notificationPreferences.bulkPut(data ?? [])
      return data ?? []
    }
    const cached = await database.notificationPreferences.where('user_id').equals(userId).toArray()
    if (cached.length) return cached
    throw error
  }

  async function setNotificationPreference(userId, category, optionalEnabled) {
    const row = { user_id: userId, category, optional_enabled: optionalEnabled, updated_at: new Date().toISOString() }
    const { data, error } = await client.from('notification_preferences')
      .upsert(row, { onConflict: 'user_id,category' }).select().single()
    if (error) throw error
    await database.notificationPreferences.put(data)
    return data
  }

  return { listNotificationPreferences, setNotificationPreference }
}

export const settingsRepository = createSettingsRepository()
