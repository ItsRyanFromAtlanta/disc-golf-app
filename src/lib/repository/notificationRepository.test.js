import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createAppDatabase } from '../db/dexieDb'
import { createNotificationRepository } from './notificationRepository'

const databases = []
afterEach(async () => { for (const database of databases.splice(0)) await database.delete() })

function row(priority = 'actionable') {
  return { id: crypto.randomUUID(), user_id: 'user-1', category: 'activity', priority, dedupe_key: `activity:${priority}`, created_at: new Date().toISOString(), resolved_at: null }
}

describe('notificationRepository preferences', () => {
  it('suppresses opted-out optional notifications but never suppresses critical safety alerts', async () => {
    const database = createAppDatabase(`NotificationPreferences-${crypto.randomUUID()}`)
    databases.push(database)
    await database.notificationPreferences.put({ user_id: 'user-1', category: 'activity', optional_enabled: false })
    const repository = createNotificationRepository({ database })
    expect(await repository.upsert(row())).toBeNull()
    expect(await database.notifications.count()).toBe(0)
    expect(await repository.upsert(row('critical'))).not.toBeNull()
    expect(await database.notifications.count()).toBe(1)
  })
})
