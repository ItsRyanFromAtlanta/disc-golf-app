import { useCallback, useEffect, useState } from 'react'
import { db } from '../db/dexieDb'
import { isMissingRelationError } from '../instantLaunch/errorClassification'
import { deleteRoundPlayer, fetchRoundPlayers, upsertRoundPlayer } from '../roundLog'
import { normalizeRoster, roundPlayerFields } from '../roundPlayers'
import { createOutboxQueue, enqueueAndSend } from './outboxQueue'
import { ROUND_PLAYER_TABLE, roundCreateKey } from './roundOutboxKeys'

// Reads and writes for the companions recorded on a round.
//
// A deliberate leaf: this module imports nothing from `roundRepository.js`, so
// the replay branches there can import the cache helpers below without a cycle.
// The shared outbox constants live in `roundOutboxKeys.js` for the same reason.
//
// Two behaviours here carry the weight, and both are about the migration not
// having landed:
//
//   * **The read degrades.** `20260730234500_phase_e_round_players.sql` is
//     unapplied, so on a live deployment this table does not exist yet.
//     PostgREST answers `PGRST205` and Postgres `42P01`, both of which
//     `isMissingRelationError` recognises. The read then reports
//     `available: false` rather than throwing, and the panel says the feature
//     is not available on this deployment instead of rendering an editor whose
//     every write would queue forever. This is the AGENTS.md rule — "UI that
//     calls a new RPC must degrade when the RPC is absent" — applied to a table.
//   * **The write does not poison.** Those two codes are in `DEPLOY_LAG_CODES`
//     and carry no attached status, so `isPermanentError` reads them as
//     transient. A companion added in the deploy window waits for the migration
//     instead of poisoning the round's outbox. That is why the read guard is a
//     courtesy rather than a safety net: even if it fails, nothing is lost.

export { ROUND_PLAYER_TABLE }

function localPlayer(input = {}) {
  return {
    id: input.id ?? crypto.randomUUID(),
    round_id: input.round_id ?? input.roundId ?? null,
    user_id: input.user_id ?? input.userId ?? null,
    position: Number(input.position),
    display_name: input.display_name ?? input.displayName ?? '',
    total_score: input.total_score ?? input.totalScore ?? null,
    created_at: input.created_at ?? null,
    updated_at: input.updated_at ?? new Date().toISOString(),
  }
}

// `replacesId` carries the optimistic row's id when the server turns out to own
// a different one for the same seat — the normal outcome, since the write
// resolves on `(round_id, position)` and lets the database keep its own primary
// key. Without it the optimistic row lingers beside the authoritative one and
// the seat is rendered twice. Same shape, same reason, as `cacheRoundHole`.
export async function cacheRoundPlayer(input, { replacesId = null, database = db } = {}) {
  const player = localPlayer(input)
  await database.transaction('rw', database.roundPlayers, async () => {
    if (replacesId && replacesId !== player.id) await database.roundPlayers.delete(replacesId)
    // Also clears any *other* local row holding this seat. Two devices adding a
    // different person to seat 3 converge on the server's one row; the mirror
    // has to converge with it or the roster reads as one more player than the
    // round has.
    const sameSeat = await database.roundPlayers
      .where('[round_id+position]')
      .equals([player.round_id, player.position])
      .toArray()
    const stale = sameSeat.filter((row) => row.id !== player.id).map((row) => row.id)
    if (stale.length > 0) await database.roundPlayers.bulkDelete(stale)
    await database.roundPlayers.put(player)
  })
  return player
}

export async function removeCachedRoundPlayer({ roundId, position }, { database = db } = {}) {
  const rows = await database.roundPlayers
    .where('[round_id+position]')
    .equals([roundId, Number(position)])
    .toArray()
  if (rows.length > 0) await database.roundPlayers.bulkDelete(rows.map((row) => row.id))
  return rows.length
}

async function cachedRoster(roundId, database = db) {
  if (!roundId) return []
  return database.roundPlayers.where('round_id').equals(roundId).toArray()
}

// Seats with a queued upsert still pending for this round.
//
// `saveRoundPlayer` deliberately strips `id` from the outbox payload — the
// write resolves on `(round_id, position)`, not on the row's local id, per
// `roundPlayers.js`: "resolving on the seat converges instead". So position,
// not id, is the only key that ties a queued write back to the cached row it
// belongs to.
async function queuedRoundPlayerPositions(roundId, database = db) {
  const rows = await createOutboxQueue({ database, tables: [ROUND_PLAYER_TABLE] }).rows()
  return new Set(
    rows
      .filter((row) => row.op === 'upsert' && (row.payload?.round_id ?? row.payload?.roundId) === roundId)
      .map((row) => Number(row.payload?.position))
      .filter((position) => Number.isFinite(position)),
  )
}

/**
 * The roster for one round, remote-first with a Dexie fallback.
 *
 * Always resolves — never throws — because the caller is a panel on a round
 * screen and an error boundary is not an answer to "who did I play with?".
 *
 * `available` is the deploy-lag signal and is `true` for an ordinary network
 * failure: offline is "we could not read it", which is a different claim from
 * "this deployment does not have the feature", and conflating them would tell a
 * player standing in a field that a shipped feature does not exist.
 */
export async function loadRoundPlayers(roundId, userId) {
  if (!roundId) return { players: [], available: true, fromCache: false }

  try {
    const remote = await fetchRoundPlayers(roundId)
    const mine = remote.filter((row) => !userId || row.user_id === userId)
    const queuedPositions = await queuedRoundPlayerPositions(roundId)
    let pendingOnly = []
    await db.transaction('rw', db.roundPlayers, async () => {
      const cached = await cachedRoster(roundId)
      const remoteIds = new Set(mine.map((row) => row.id))
      const remotePositions = new Set(mine.map((row) => Number(row.position)))
      // A companion whose add is still queued is absent from the remote read by
      // definition — that is what "still queued" means — and it is the one the
      // player most needs to see, since they just added them. It must survive
      // this sweep. Everything else absent from the remote read really is gone
      // (removed here, removed elsewhere, or never wrote) and stays evicted, or
      // a companion deleted on another device would linger in the mirror
      // forever. Same shape as `readRoundList`'s fix for the identical bug.
      const stale = cached
        .filter((row) => !remoteIds.has(row.id))
        .filter((row) => !queuedPositions.has(Number(row.position)))
        .map((row) => row.id)
      if (stale.length > 0) await db.roundPlayers.bulkDelete(stale)
      if (mine.length > 0) await db.roundPlayers.bulkPut(mine.map(localPlayer))
      pendingOnly = cached.filter(
        (row) => queuedPositions.has(Number(row.position)) && !remotePositions.has(Number(row.position)),
      )
    })
    return { players: normalizeRoster([...mine, ...pendingOnly]), available: true, fromCache: false }
  } catch (error) {
    if (isMissingRelationError(error)) {
      // Not deployed yet. Deliberately does not fall back to the mirror: a
      // local row for a table the server has never had would be reported as a
      // roster that exists somewhere, and it does not.
      return { players: [], available: false, fromCache: false }
    }
    return { players: normalizeRoster(await cachedRoster(roundId)), available: true, fromCache: true }
  }
}

// Deliberately not built on `createRepository`: its read helper cannot express
// the distinction this surface depends on — "the table is not deployed" versus
// "the network is gone" — and collapsing the two is the one mistake that turns
// a bad connection into a claim about the product.
function queued(options) {
  return enqueueAndSend({ database: db, ...options })
}

/**
 * Add or correct one companion.
 *
 * Refuses before touching the network or the queue when the fields are not
 * writable — a blank name, a seat outside 1..7. Both are values the CHECK
 * constraints reject, and a rejected write reaching the outbox classifies as
 * `23514`, which is permanent: the round would then carry a poisoned entry
 * because somebody typed a space. Same reasoning as `normalizeWindMph`.
 */
export async function saveRoundPlayer(input) {
  const fields = roundPlayerFields(input)
  if (!fields) throw new Error('A player needs a name and an open seat on the card.')

  const { id: localId, ...payload } = fields
  const local = { ...fields }
  return queued({
    table: ROUND_PLAYER_TABLE,
    op: 'upsert',
    payload,
    dependencyKey: roundCreateKey(fields.round_id),
    writeLocal: () => cacheRoundPlayer(local),
    remote: async () => ({ ...local, ...(await upsertRoundPlayer(payload)) }),
    writeRemote: (row) => cacheRoundPlayer(row, { replacesId: localId }),
  })
}

export async function removeRoundPlayer({ roundId, position }) {
  const payload = { roundId, position: Number(position) }
  return queued({
    table: ROUND_PLAYER_TABLE,
    op: 'delete',
    payload,
    dependencyKey: roundCreateKey(roundId),
    writeLocal: () => removeCachedRoundPlayer(payload),
    remote: () => deleteRoundPlayer(payload),
    writeRemote: () => removeCachedRoundPlayer(payload),
  })
}

/** Replays one queued roster mutation. Throws so the caller can classify it. */
export async function replayRoundPlayerEntry(entry, { database = db, api } = {}) {
  if (entry.op === 'delete') {
    await api.deleteRoundPlayer(entry.payload)
    await removeCachedRoundPlayer(entry.payload, { database })
    return
  }
  const remote = await api.upsertRoundPlayer(entry.payload)
  await cacheRoundPlayer(remote, { database })
}

// Exposed so `roundRepository`'s sync adapter can inject test doubles the same
// way it does for rounds and holes.
export const roundPlayerApi = { upsertRoundPlayer, deleteRoundPlayer }

/**
 * The roster for a round, resolved in the background.
 *
 * Returns `null` for `players` until the first read settles, which callers
 * render as nothing — the panel appears when there is something true to say,
 * matching `useRoundBagVerification`.
 */
export function useRoundPlayers(roundId, userId) {
  const [state, setState] = useState({ players: null, available: true, fromCache: false })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const reload = useCallback(async () => {
    if (!roundId) {
      setState({ players: null, available: true, fromCache: false })
      return
    }
    const result = await loadRoundPlayers(roundId, userId)
    setState(result)
  }, [roundId, userId])

  useEffect(() => {
    let active = true
    if (!roundId) {
      setState({ players: null, available: true, fromCache: false })
      return undefined
    }
    loadRoundPlayers(roundId, userId).then((result) => {
      if (active) setState(result)
    })
    return () => {
      active = false
    }
  }, [roundId, userId])

  // Both mutations apply to the rendered roster whether or not the network
  // answered. By the time `saveRoundPlayer` resolves OR throws, the Dexie
  // mirror is already written and the outbox entry already exists — so the
  // companion genuinely is recorded, it just may not have reached the server
  // yet, which the round's own sync banners already report. The one case that
  // applies nothing is a validation refusal, which never wrote anything:
  // `roundPlayerFields` returning null is how the two are told apart. Same
  // shape as `useRoundWeather`.
  const save = useCallback(
    async (input) => {
      setSaving(true)
      setMessage(null)
      const apply = (row) => (current) => ({
        ...current,
        players: normalizeRoster([...(current.players ?? []), row]),
      })
      try {
        const result = await saveRoundPlayer({ ...input, roundId, userId })
        setState(apply(result))
        return result
      } catch (error) {
        const optimistic = roundPlayerFields({ ...input, roundId, userId })
        if (optimistic) {
          // A network failure: the row is already local and queued.
          setState(apply(optimistic))
          setMessage({ tone: 'info', text: 'Saved on this device; it will sync when you reconnect.' })
        } else {
          setMessage({ tone: 'error', text: error.message ?? 'Could not add that player.' })
        }
        return null
      } finally {
        setSaving(false)
      }
    },
    [roundId, userId],
  )

  const remove = useCallback(
    async (position) => {
      setSaving(true)
      setMessage(null)
      const drop = (current) => ({
        ...current,
        players: (current.players ?? []).filter((row) => Number(row.position) !== Number(position)),
      })
      try {
        await removeRoundPlayer({ roundId, position })
        setState(drop)
      } catch {
        setState(drop)
        setMessage({ tone: 'info', text: 'Removed on this device; it will sync when you reconnect.' })
      } finally {
        setSaving(false)
      }
    },
    [roundId],
  )

  return { ...state, reload, save, remove, saving, message }
}
