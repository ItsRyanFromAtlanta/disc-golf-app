import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ACTIVITY_SOURCES,
  ACTIVITY_STATES,
  ACTIVITY_STATE_REASONS,
  ACTIVITY_TYPES,
} from '../activityLifecycle'
import { db } from '../db/dexieDb'
import { getInstallationId } from '../instantLaunch/installationId'
import { activityRepository } from './activityRepository'
import { createActivitySyncAdapter } from './activitySync'
import {
  createRound,
  fetchRound,
  fetchRounds,
  updateRound,
  upsertRoundHole,
} from '../roundLog'

const ROUND_TABLE = 'rounds'
const ROUND_HOLE_TABLE = 'round_holes'
const roundActivitySync = createActivitySyncAdapter()

function localHole(input = {}) {
  return {
    id: input.id ?? crypto.randomUUID(),
    round_id: input.round_id ?? input.roundId,
    hole_id: input.hole_id ?? input.holeId,
    score: input.score == null || input.score === '' ? null : Number(input.score),
    disc_id: input.disc_id ?? input.discId ?? null,
    notes: input.notes ?? null,
    ...(input.hole ? { hole: input.hole } : {}),
    ...(input.disc ? { disc: input.disc } : {}),
  }
}

function remoteHole(input) {
  return {
    id: input.id,
    round_id: input.round_id,
    hole_id: input.hole_id,
    score: input.score,
    disc_id: input.disc_id,
    notes: input.notes,
  }
}

async function cacheRound(round) {
  if (!round?.id) return round
  await db.transaction('rw', db.rounds, db.roundHoles, async () => {
    await db.rounds.put(round)
    const holes = (round.round_holes ?? []).map(localHole)
    await db.roundHoles.where('round_id').equals(round.id).delete()
    if (holes.length > 0) await db.roundHoles.bulkPut(holes)
  })
  return round
}

async function cacheRoundHole(input) {
  const hole = localHole(input)
  await db.transaction('rw', db.rounds, db.roundHoles, async () => {
    await db.roundHoles.put(hole)
    const round = await db.rounds.get(hole.round_id)
    if (!round) return
    const current = Array.isArray(round.round_holes) ? round.round_holes : []
    const index = current.findIndex((row) => row.id === hole.id || row.hole_id === hole.hole_id)
    const next = [...current]
    if (index >= 0) next[index] = { ...next[index], ...hole }
    else next.push(hole)
    await db.rounds.put({ ...round, round_holes: next })
  })
  return hole
}

async function cachedRoundsForUser(userId) {
  return db.rounds.where('user_id').equals(userId).toArray()
}

async function readRoundList(userId) {
  try {
    const remote = await fetchRounds(userId)
    const remoteIds = new Set(remote.map((round) => round.id))
    const cached = await cachedRoundsForUser(userId)
    const staleIds = cached.filter((round) => !remoteIds.has(round.id)).map((round) => round.id)
    if (remote.length > 0) await db.rounds.bulkPut(remote)
    if (staleIds.length > 0) await db.rounds.bulkDelete(staleIds)
    return remote
  } catch (error) {
    const cached = await cachedRoundsForUser(userId)
    if (cached.length > 0) return cached
    throw error
  }
}

async function readCachedRound(roundId, userId) {
  const round = await db.rounds.get(roundId)
  if (!round || (userId && round.user_id !== userId)) return null
  if (Array.isArray(round.round_holes)) return round
  return {
    ...round,
    round_holes: await db.roundHoles.where('round_id').equals(roundId).toArray(),
  }
}

function lifecycleMutation(roundId, metadata = {}, overrides = {}) {
  const now = new Date().toISOString()
  return {
    expectedState: null,
    expectedVersion: null,
    occurredAt: now,
    recordedAt: now,
    source: ACTIVITY_SOURCES.MANUAL_ENTRY,
    installationId: getInstallationId(),
    metadata,
    idempotencyKey: `round:${roundId}:create`,
    ...overrides,
  }
}

// `rounds(id, user_id)` references `activities(id, user_id)` in the deployed
// schema. Create the lifecycle parent with the same client-generated UUID
// before the round insert so online writes satisfy the FK and offline retries
// preserve the activity -> round dependency order.
async function ensureRoundActivity({ roundId, userId, metadata = {} }) {
  let activity = await activityRepository.getById(roundId)
  if (!activity) {
    const created = await activityRepository.createDraft({
      id: roundId,
      userId,
      type: ACTIVITY_TYPES.DISC_GOLF_ROUND,
      mutation: lifecycleMutation(roundId, metadata),
      metadata: { source: 'round_logging', ...metadata },
    })
    activity = created.activity
  }

  // Starting a new round while another activity is current requires the
  // existing lifecycle confirmation flow. J1 keeps that decision out of the
  // round form, so it leaves the parent as a draft in that case; the round
  // itself remains valid and the parent can be started by a later lifecycle
  // workflow without bypassing the invariant.
  if (activity.state === ACTIVITY_STATES.DRAFT) {
    const current = await activityRepository.getActive(userId)
    if (!current) {
      const started = await activityRepository.start(
        roundId,
        lifecycleMutation(roundId, metadata, {
          expectedState: ACTIVITY_STATES.DRAFT,
          expectedVersion: 0,
          reason: ACTIVITY_STATE_REASONS.FIRST_MEANINGFUL_FACT,
          idempotencyKey: `round:${roundId}:start`,
        }),
      )
      activity = started.activity
    }
  }

  return activity
}

async function createRoundWithActivity(userId, payload) {
  await ensureRoundActivity({
    roundId: payload.id,
    userId,
    metadata: { courseId: payload.course_id ?? null, layoutId: payload.layout_id ?? null },
  })
  await roundActivitySync.flush()
  return createRound(userId, payload)
}

export async function finalizeRoundActivity(roundId, userId) {
  const activity = await activityRepository.getById(roundId)
  if (
    !activity ||
    activity.user_id !== userId ||
    ![ACTIVITY_STATES.ACTIVE, ACTIVITY_STATES.PAUSED].includes(activity.state)
  ) {
    return activity
  }

  const now = new Date().toISOString()
  const result = await activityRepository.finalize(roundId, {
    expectedState: activity.state,
    expectedVersion: activity.version,
    occurredAt: now,
    recordedAt: now,
    source: ACTIVITY_SOURCES.MANUAL_ENTRY,
    installationId: getInstallationId(),
    reason: ACTIVITY_STATE_REASONS.USER_FINALIZE,
    idempotencyKey: `round:${roundId}:finalize`,
    metadata: { source: 'round_logging' },
  })
  await roundActivitySync.flush()
  return result.activity
}

export async function loadRound(roundId, userId) {
  try {
    return await cacheRound(await fetchRound(roundId))
  } catch (error) {
    const cached = await readCachedRound(roundId, userId)
    if (cached) return cached
    throw error
  }
}

async function runQueuedMutation({ table, op, payload, writeLocal, remote, writeRemote }) {
  const outboxId = await db.outbox.add({
    table,
    op,
    payload,
    createdAt: Date.now(),
  })
  await writeLocal()
  const result = await remote()
  await writeRemote(result)
  await db.outbox.delete(outboxId)
  return result
}

export function useRoundList(userId) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId) return undefined
    function onOnline() {
      flushRoundOutbox(userId).then(() => queryClient.invalidateQueries({ queryKey: [ROUND_TABLE, 'list', userId] }))
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [queryClient, userId])

  return useQuery({
    queryKey: [ROUND_TABLE, 'list', userId],
    queryFn: () => readRoundList(userId),
    enabled: Boolean(userId),
    networkMode: 'offlineFirst',
  })
}

export function useCreateRound(userId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fields) => {
      const payload = { ...fields, id: fields.id ?? crypto.randomUUID(), user_id: userId }
      try {
        return await runQueuedMutation({
          table: ROUND_TABLE,
          op: 'create',
          payload,
          writeLocal: () => cacheRound(payload),
          remote: () => createRoundWithActivity(userId, payload),
          writeRemote: (round) => cacheRound(round),
        })
      } catch (error) {
        // The optimistic row and outbox entry are valid even when the remote
        // request fails. Callers can navigate to the cached round immediately.
        error.localResult = payload
        throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ROUND_TABLE, 'list', userId] }),
  })
}

export function useUpdateRound(userId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ roundId, fields }) => {
      const current = (await db.rounds.get(roundId)) ?? { id: roundId, user_id: userId }
      const optimistic = { ...current, ...fields, id: roundId, user_id: userId }
      try {
        return await runQueuedMutation({
          table: ROUND_TABLE,
          op: 'update',
          payload: { roundId, fields },
          writeLocal: () => cacheRound(optimistic),
          remote: () => updateRound(roundId, fields),
          writeRemote: (round) => cacheRound(round),
        })
      } catch (error) {
        error.localResult = optimistic
        throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ROUND_TABLE, 'list', userId] }),
  })
}

export async function saveRoundHole(input) {
  const local = localHole(input)
  const payload = remoteHole(local)
  return runQueuedMutation({
    table: ROUND_HOLE_TABLE,
    op: 'upsert',
    payload,
    writeLocal: () => cacheRoundHole(local),
    remote: async () => {
      const remote = await upsertRoundHole(payload)
      return { ...local, ...remote }
    },
    writeRemote: (roundHole) => cacheRoundHole(roundHole),
  })
}

export async function flushRoundOutbox(userId) {
  await roundActivitySync.flush()
  const entries = (await db.outbox.toArray()).filter(
    (entry) => entry.table === ROUND_TABLE || entry.table === ROUND_HOLE_TABLE,
  )
  for (const entry of entries) {
    try {
      if (entry.table === ROUND_TABLE && entry.op === 'create') {
        await ensureRoundActivity({
          roundId: entry.payload.id,
          userId: entry.payload.user_id ?? userId,
          metadata: {
            courseId: entry.payload.course_id ?? null,
            layoutId: entry.payload.layout_id ?? null,
          },
        })
        await roundActivitySync.flush()
        await cacheRound(await createRound(userId, entry.payload))
      } else if (entry.table === ROUND_TABLE && entry.op === 'update') {
        const result = await updateRound(entry.payload.roundId, entry.payload.fields)
        await cacheRound(result)
      } else if (entry.table === ROUND_HOLE_TABLE && entry.op === 'upsert') {
        const result = await upsertRoundHole(entry.payload)
        await cacheRoundHole(result)
      }
      await db.outbox.delete(entry.id)
    } catch {
      // Leave the entry queued for the next reconnect or app load.
    }
  }
}
