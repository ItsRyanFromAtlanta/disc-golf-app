import { db as defaultDb } from '../db/dexieDb'
import { supabase as defaultSupabase } from '../supabaseClient'
import { NOTIFICATION_OUTBOX_TABLE } from './notificationRepository'

function upsertArgs(notification) {
  return {
    p_notification_id: notification.id,
    p_category: notification.category,
    p_priority: notification.priority,
    p_title: notification.title,
    p_body: notification.body ?? null,
    p_action_type: notification.action_type ?? null,
    p_action_payload: notification.action_payload ?? {},
    p_activity_id: notification.activity_id ?? null,
    p_created_at: notification.created_at,
    p_expires_at: notification.expires_at ?? null,
    p_dedupe_key: notification.dedupe_key,
  }
}

export function createNotificationSyncAdapter({ database = defaultDb, client = defaultSupabase } = {}) {
  async function pull(userId) {
    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    if (data?.length) await database.notifications.bulkPut(data)
    return data ?? []
  }

  async function flush() {
    const rows = await database.outbox.where('table').equals(NOTIFICATION_OUTBOX_TABLE).sortBy('id')
    for (const row of rows) {
      const notification = row.payload
      const result =
        row.op === 'upsert'
          ? await client.rpc('notification_upsert', upsertArgs(notification))
          : await client.rpc('notification_set_status', {
              p_notification_id: notification.id,
              p_read_at: notification.read_at ?? null,
              p_resolved_at: notification.resolved_at ?? null,
            })
      if (result.error) throw result.error
      if (result.data) await database.notifications.put(result.data)
      await database.outbox.delete(row.id)
    }
  }

  return { pull, flush }
}
