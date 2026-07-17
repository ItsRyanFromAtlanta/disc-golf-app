import { db } from '../db/dexieDb'
import { validateOdometerInput } from '../discOdometer'
import { getInstallationId } from '../instantLaunch/installationId'
import { supabase } from '../supabaseClient'

function optimisticEvent(row) {
  return {
    id: row.eventId,
    user_id: row.userId,
    disc_id: row.discId,
    metric: row.metric,
    delta: row.delta,
    occurred_at: row.occurredAt,
    recorded_at: row.createdAt,
    source: row.source,
    reason: row.reason,
    installation_id: row.installationId,
    idempotency_key: row.idempotencyKey,
    metadata: row.metadata,
    pending: true,
  }
}

async function syncEvent(row) {
  const { data, error } = await supabase.rpc('record_disc_odometer_event', {
    p_event_id: row.eventId,
    p_disc_id: row.discId,
    p_metric: row.metric,
    p_delta: row.delta,
    p_occurred_at: row.occurredAt,
    p_source: row.source,
    p_source_ref: row.sourceRef,
    p_installation_id: row.installationId,
    p_reason: row.reason,
    p_idempotency_key: row.idempotencyKey,
    p_metadata: row.metadata,
  })
  if (error) throw error
  await db.transaction('rw', db.discOdometerEvents, db.discCosmeticUnlocks, db.discs, async () => {
    await db.discOdometerEvents.put(data.event)
    if (data.unlocks?.length) await db.discCosmeticUnlocks.bulkPut(data.unlocks)
    if (data.disc) await db.discs.put(data.disc)
  })
  return data
}

export async function recordDiscOdometerEvent({ userId, discId, metric, delta, source = 'manual_entry', reason, occurredAt, sourceRef, metadata = {} }) {
  const valid = validateOdometerInput({ metric, delta, source, reason })
  const now = new Date().toISOString()
  const row = {
    id: crypto.randomUUID(),
    eventId: crypto.randomUUID(),
    userId,
    discId,
    occurredAt: occurredAt ?? now,
    createdAt: now,
    sourceRef: sourceRef ?? null,
    installationId: getInstallationId(),
    idempotencyKey: `disc-odometer:${crypto.randomUUID()}`,
    metadata,
    status: 'pending',
    ...valid,
  }
  await db.transaction('rw', db.discOdometerOutbox, db.discOdometerEvents, async () => {
    await db.discOdometerOutbox.put(row)
    await db.discOdometerEvents.put(optimisticEvent(row))
  })
  try {
    const data = await syncEvent(row)
    await db.discOdometerOutbox.delete(row.id)
    return { ...data, queued: false }
  } catch (error) {
    await db.discOdometerOutbox.update(row.id, { status: 'retry', lastError: error.message })
    return { event: optimisticEvent(row), disc: null, unlocks: [], queued: true }
  }
}

export async function flushDiscOdometerOutbox(userId) {
  const rows = await db.discOdometerOutbox.where('userId').equals(userId).sortBy('createdAt')
  for (const row of rows) {
    try {
      await syncEvent(row)
      await db.discOdometerOutbox.delete(row.id)
    } catch (error) {
      await db.discOdometerOutbox.update(row.id, { status: 'retry', lastError: error.message })
    }
  }
}

export async function loadDiscOdometer(discId) {
  try {
    const [{ data: events, error: eventError }, { data: unlocks, error: unlockError }] = await Promise.all([
      supabase.from('disc_odometer_events').select('*').eq('disc_id', discId).order('occurred_at', { ascending: false }),
      supabase.from('disc_cosmetic_unlocks').select('*').eq('disc_id', discId).order('threshold'),
    ])
    if (eventError) throw eventError
    if (unlockError) throw unlockError
    const pending = await db.discOdometerOutbox.where('discId').equals(discId).toArray()
    await db.transaction('rw', db.discOdometerEvents, db.discCosmeticUnlocks, async () => {
      await db.discOdometerEvents.where('disc_id').equals(discId).delete()
      await db.discCosmeticUnlocks.where('disc_id').equals(discId).delete()
      if (events?.length) await db.discOdometerEvents.bulkPut(events)
      if (unlocks?.length) await db.discCosmeticUnlocks.bulkPut(unlocks)
      for (const row of pending) await db.discOdometerEvents.put(optimisticEvent(row))
    })
    return {
      events: await db.discOdometerEvents.where('disc_id').equals(discId).reverse().sortBy('occurred_at'),
      unlocks: unlocks ?? [],
    }
  } catch (error) {
    const events = await db.discOdometerEvents.where('disc_id').equals(discId).reverse().sortBy('occurred_at')
    const unlocks = await db.discCosmeticUnlocks.where('disc_id').equals(discId).sortBy('threshold')
    if (events.length || unlocks.length) return { events, unlocks }
    throw error
  }
}
