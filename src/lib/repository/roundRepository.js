import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ACTIVITY_SOURCES,
  ACTIVITY_STATES,
  ACTIVITY_STATE_REASONS,
  ACTIVITY_TYPES,
} from '../activityLifecycle'
import { db } from '../db/dexieDb'
import { nextBackoffDelayMs } from '../instantLaunch/backoff'
import { isPermanentError } from '../instantLaunch/errorClassification'
import { getInstallationId } from '../instantLaunch/installationId'
import { SYNC_STATUS, createSyncScheduler } from '../instantLaunch/syncScheduler'
import { activityRepository } from './activityRepository'
import { createActivitySyncAdapter } from './activitySync'
import { createOutboxQueue, enqueueAndSend } from './outboxQueue'
import { assertCourseIsSynced } from './courseRepository'
import {
  createRound,
  fetchRound,
  fetchRounds,
  updateRound,
  upsertRoundHole,
} from '../roundLog'
import { captureBagVersion } from './bagHistoryRepository'
import { replayRoundPlayerEntry, roundPlayerApi } from './roundPlayerRepository'
import {
  ROUND_HOLE_TABLE,
  ROUND_PLAYER_TABLE,
  ROUND_TABLE,
  roundCreateKey,
} from './roundOutboxKeys'

// The roster joins the same queue rather than getting a fourth one. Its rows
// depend on the same round create, drain in the same pass, and are reported by
// the same sync banners — a companion that never reached the server is exactly
// as invisible to the player as a score that never did, which is what audit
// finding 2 was about.
const ROUND_OUTBOX_TABLES = [ROUND_TABLE, ROUND_HOLE_TABLE, ROUND_PLAYER_TABLE]
const roundActivitySync = createActivitySyncAdapter()

export { roundCreateKey }

export function roundIdForOutboxEntry(entry) {
  if (entry?.table === ROUND_TABLE) return entry.op === 'update' ? entry.payload?.roundId : entry.payload?.id
  if (entry?.table === ROUND_HOLE_TABLE) return entry.payload?.round_id
  // A queued delete carries the seat, not the row, so it is keyed on
  // `roundId` rather than `round_id` — both spellings resolve to the round the
  // banner has to name.
  if (entry?.table === ROUND_PLAYER_TABLE) return entry.payload?.round_id ?? entry.payload?.roundId ?? null
  return null
}

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

async function cacheRound(round, database = db) {
  if (!round?.id) return round
  await database.transaction('rw', database.rounds, database.roundHoles, async () => {
    await database.rounds.put(round)
    const holes = (round.round_holes ?? []).map(localHole)
    await database.roundHoles.where('round_id').equals(round.id).delete()
    if (holes.length > 0) await database.roundHoles.bulkPut(holes)
  })
  return round
}

// `replacesId` carries the optimistic row's id when the server turns out to
// own a different one for the same (round_id, hole_id) — which is the normal
// outcome now that `upsertRoundHole` resolves on the natural key and lets the
// database keep its own primary key. Without this the local optimistic row
// would linger beside the authoritative one and the hole would be counted
// twice in `db.roundHoles`.
async function cacheRoundHole(input, { replacesId = null, database = db } = {}) {
  const hole = localHole(input)
  await database.transaction('rw', database.rounds, database.roundHoles, async () => {
    if (replacesId && replacesId !== hole.id) await database.roundHoles.delete(replacesId)
    await database.roundHoles.put(hole)
    const round = await database.rounds.get(hole.round_id)
    if (!round) return
    const current = Array.isArray(round.round_holes) ? round.round_holes : []
    const index = current.findIndex((row) => row.id === hole.id || row.hole_id === hole.hole_id)
    const next = [...current]
    if (index >= 0) next[index] = { ...next[index], ...hole }
    else next.push(hole)
    await database.rounds.put({ ...round, round_holes: next })
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
  // `draft` is accepted here, and that is the whole of the D-03 fix.
  //
  // `ensureRoundActivity` above leaves the parent a draft when another activity
  // was already current, so that starting a round never silently replaces a
  // live session. The cost was that finalization refused draft parents, which
  // made the state terminal: the round row read `completed` while its activity
  // sat in `draft` forever, invisible to the weekly report and unrepairable
  // from any screen.
  //
  // Finalizing straight from `draft` is safe precisely because it skips
  // `active` — see the transition table's note in `activityLifecycle/reducer.js`.
  // Whatever the player has live stays live.
  if (
    !activity ||
    activity.user_id !== userId ||
    ![ACTIVITY_STATES.DRAFT, ACTIVITY_STATES.ACTIVE, ACTIVITY_STATES.PAUSED].includes(activity.state)
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

// Now the shared helper in `outboxQueue.js` — course creation became its second
// caller, so it moved next to the queue it writes into rather than being copied.
function runQueuedMutation(options) {
  return enqueueAndSend({ database: db, ...options })
}

export function useRoundList(userId) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId) return undefined
    function onOnline() {
      flushRoundOutbox(userId)
        .catch(() => undefined)
        .then(() => queryClient.invalidateQueries({ queryKey: [ROUND_TABLE, 'list', userId] }))
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

// A round-start snapshot must never crash the round create it belongs to.
// This is the fix for DEFECT_REGISTER D-05: `captureBagVersion`'s RPC always
// rejects offline, and the fallback that used to run in its place —
// `latestBagVersion(await loadBagVersions(bagId))` — rethrows when the Dexie
// cache is empty (`bagHistoryRepository.js`'s `loadBagVersions`), which on a
// fresh install or a bag never edited on this device is unconditional. That
// rethrow used to escape `useCreateRound`'s `mutationFn` before its `payload`
// existed and before the `try` that attaches `error.localResult`, so
// `RoundStartPage.jsx` had no offline branch to take: no outbox row, no local
// round, no round at all.
//
// The fix is not "catch it and fall back to the stale version" — that closed
// the crash but reopened E2 audit finding F2: a version that can be weeks old
// is indistinguishable, on the round, from one taken at the first tee.
// Instead every failure here degrades to `null`. `bagVersionId = null` is an
// honest fact: `verifyRoundBag` (`roundBagVerification.js`) already reports
// it as `not_snapshotted` rather than treating a missing snapshot as absence
// of a fault, which is exactly what this is.
export async function captureRoundStartBagVersion(bagId, roundId) {
  try {
    return await captureBagVersion(bagId, { idempotencyKey: `round-bag:${roundId}` })
  } catch {
    return null
  }
}

// The body of `useCreateRound`'s `mutationFn`, pulled out as a plain function
// so it can be unit-tested without standing up a `QueryClientProvider` —
// `useMutation` calls React hooks internally and cannot run outside a
// component render, but nothing below this line touches React at all. See
// `roundRepository.createRound.test.js`.
export function createRoundMutationFn(userId) {
  return async function createRoundMutation(fields) {
    // A round is filed against the *shared* course and layout rows, so it
    // cannot be queued behind a course that is itself still queued. Refused
    // deliberately and up front, outside the try below, so no optimistic
    // round and no outbox entry are created — see `PENDING_COURSE_ROUND_MESSAGE`
    // in `courseRepository.js` for the reasoning.
    await assertCourseIsSynced(fields.course_id)

    const roundId = fields.id ?? crypto.randomUUID()
    let payload
    try {
      // Bag-version resolution now lives inside this try — see
      // `captureRoundStartBagVersion` above for why it is safe here: it
      // cannot itself throw, but the boundary still has to hold for
      // whatever the outbox write below does.
      const bagVersionId =
        fields.bag_version_id ??
        (fields.bag_id ? await captureRoundStartBagVersion(fields.bag_id, roundId) : null)
      payload = {
        ...fields,
        id: roundId,
        user_id: userId,
        bag_version_id: bagVersionId,
      }
      return await runQueuedMutation({
        table: ROUND_TABLE,
        op: 'create',
        payload,
        idempotencyKey: roundCreateKey(roundId),
        writeLocal: () => cacheRound(payload),
        remote: () => createRoundWithActivity(userId, payload),
        writeRemote: (round) => cacheRound(round),
      })
    } catch (error) {
      // The optimistic row and outbox entry are valid even when the remote
      // request fails. Callers can navigate to the cached round immediately.
      // `payload` is guarded rather than assumed: nothing on this path can
      // throw before it is built any more, but a silently-missing
      // `localResult` is a worse failure mode than a defensive check.
      if (payload) error.localResult = payload
      throw error
    }
  }
}

export function useCreateRound(userId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createRoundMutationFn(userId),
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
          dependencyKey: roundCreateKey(roundId),
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
    dependencyKey: roundCreateKey(local.round_id),
    writeLocal: () => cacheRoundHole(local),
    remote: async () => {
      const remote = await upsertRoundHole(payload)
      return { ...local, ...remote }
    },
    writeRemote: (roundHole) => cacheRoundHole(roundHole, { replacesId: local.id }),
  })
}

// Replays one queued round mutation. Throws on failure so the caller can
// classify it — this deliberately does not swallow, which is what the bare
// `catch {}` this replaces did.
async function replayRoundEntry(entry, { userId, database, api, activitySync, ensureActivity }) {
  if (entry.table === ROUND_TABLE && entry.op === 'create') {
    await ensureActivity({
      roundId: entry.payload.id,
      userId: entry.payload.user_id ?? userId,
      metadata: {
        courseId: entry.payload.course_id ?? null,
        layoutId: entry.payload.layout_id ?? null,
      },
    })
    await activitySync.flush()
    await cacheRound(await api.createRound(userId, entry.payload), database)
    return
  }
  if (entry.table === ROUND_TABLE && entry.op === 'update') {
    await cacheRound(await api.updateRound(entry.payload.roundId, entry.payload.fields), database)
    return
  }
  if (entry.table === ROUND_HOLE_TABLE && entry.op === 'upsert') {
    const result = await api.upsertRoundHole(entry.payload)
    await cacheRoundHole(result, { replacesId: entry.payload.id, database })
    return
  }
  if (entry.table === ROUND_PLAYER_TABLE) {
    await replayRoundPlayerEntry(entry, { database, api })
  }
}

// The round outbox now honours the same § 8 contract as the activity and
// history-recovery outboxes, using the same queue, the same permanent/transient
// classifier, and the same backoff curve. The shape of the returned result
// matches `createActivitySyncAdapter().flush` so `createSyncScheduler` can drive
// it unchanged.
export function createRoundSyncAdapter({
  database = db,
  api = { createRound, updateRound, upsertRoundHole, ...roundPlayerApi },
  activitySync = roundActivitySync,
  ensureActivity = ensureRoundActivity,
} = {}) {
  const outbox = createOutboxQueue({ database, tables: ROUND_OUTBOX_TABLES })

  async function flush(userId, nowMs = Date.now()) {
    const activityResult = await activitySync.flush(nowMs)
    const permanentFailureIds = []
    let transientFailure = false

    // Re-read after each wave so a round create and the scorecard writes that
    // depend on it can drain in a single pass, in queue order.
    for (;;) {
      const ready = await outbox.listReady(nowMs)
      if (ready.length === 0) break
      for (const entry of ready) {
        try {
          await replayRoundEntry(entry, { userId, database, api, activitySync, ensureActivity })
          await outbox.acknowledge(entry.id)
        } catch (error) {
          const permanent = isPermanentError(error)
          if (permanent) permanentFailureIds.push(entry.id)
          else transientFailure = true
          await outbox.recordFailure(entry.id, {
            errorClass: permanent ? 'permanent' : 'transient',
            nextRetryAt: permanent ? null : nowMs + nextBackoffDelayMs(entry.attemptCount ?? 0),
            poison: permanent,
          })
        }
      }
    }

    const rows = await outbox.rows()
    const hasPoison = rows.some((row) => row.poison)
    const remaining = rows.filter((row) => !row.poison).length

    // Status reports on round rows only. Activity lifecycle traffic has its own
    // surface (`useHistoryRecovery`), and folding unrelated pending activities
    // in here would leave the rounds screen permanently "needs attention". The
    // one exception is a permanently failed activity while round rows are still
    // queued: a round create cannot satisfy its parent FK in that state, so
    // those rounds really are blocked and the user has to be told.
    const blockedByActivity = Boolean(activityResult?.error?.permanent) && remaining > 0
    return {
      hasPending: remaining > 0,
      error:
        hasPoison || permanentFailureIds.length > 0 || blockedByActivity
          ? { permanent: true }
          : transientFailure || remaining > 0
            ? { permanent: false }
            : null,
      permanentFailureIds,
    }
  }

  async function listPoisoned() {
    return (await outbox.rows()).filter((row) => row.poison)
  }

  return { flush, listPoisoned, retryPoisoned: outbox.retryPoisoned, outbox }
}

const roundSync = createRoundSyncAdapter()

// Several surfaces flush the round outbox — the list hook's `online` handler,
// the scorecard and summary screens on mount, and the sync scheduler. Running
// two passes concurrently would let both read the same queue snapshot and send
// every queued write twice, so calls are serialised rather than overlapped.
let flushChain = Promise.resolve()

export function flushRoundOutbox(userId, nowMs) {
  const run = flushChain.then(
    () => roundSync.flush(userId, nowMs ?? Date.now()),
    () => roundSync.flush(userId, nowMs ?? Date.now()),
  )
  flushChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

// Poisoned entries are the ones a user has to be told about: the local mirror
// still renders their scores, so nothing else on screen would reveal that the
// round never reached the server.
export async function listPoisonedRoundIds() {
  const poisoned = await roundSync.listPoisoned()
  return [...new Set(poisoned.map(roundIdForOutboxEntry).filter(Boolean))]
}

export async function retryPoisonedRoundOutbox() {
  return roundSync.retryPoisoned()
}

// Mirrors `useHistoryRecovery`: a scheduler owns when to flush, status drives
// the calm sync labels from § 12, and FAILED is terminal until the user asks
// for a retry. `unsyncedRoundIds` names which rounds are affected so a screen
// can point at the specific round rather than a generic warning.
export function useRoundSync(userId) {
  const queryClient = useQueryClient()
  const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.SYNCED)
  const [unsyncedRoundIds, setUnsyncedRoundIds] = useState([])
  const schedulerRef = useRef(null)

  useEffect(() => {
    if (!userId) return undefined
    let active = true

    async function refreshPoisoned() {
      const ids = await listPoisonedRoundIds()
      if (active) setUnsyncedRoundIds(ids)
    }

    const scheduler = createSyncScheduler({
      flush: () => flushRoundOutbox(userId),
      onStatusChange: (status) => {
        if (!active) return
        setSyncStatus(status)
        refreshPoisoned().catch(() => undefined)
        if (status === SYNC_STATUS.SYNCED) {
          queryClient.invalidateQueries({ queryKey: [ROUND_TABLE, 'list', userId] })
        }
      },
    })
    schedulerRef.current = scheduler
    scheduler.start()
    refreshPoisoned().catch(() => undefined)

    return () => {
      active = false
      scheduler.stop()
      schedulerRef.current = null
    }
  }, [queryClient, userId])

  const retrySync = useCallback(async () => {
    await retryPoisonedRoundOutbox()
    setUnsyncedRoundIds([])
    schedulerRef.current?.retry()
  }, [])

  return { syncStatus, unsyncedRoundIds, retrySync }
}
