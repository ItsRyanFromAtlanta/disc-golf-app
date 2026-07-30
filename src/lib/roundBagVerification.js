// Bag snapshot verification — did the bag recorded against this round match
// what was actually carried?
//
// The columns already exist. `rounds.bag_id` names the bag chosen at the first
// tee and `rounds.bag_version_id` points at an immutable
// `bag_versions`/`bag_version_discs` snapshot (Phase B, 2026-07-15). What did
// not exist is any way to find out whether that pointer means what it appears
// to mean — and there are several ordinary ways for it not to.
//
// The one that motivated this. `useCreateRound` captures a fresh version at
// round start, and when that call fails it falls back to the newest version the
// device happens to know about:
//
//     bagVersionId = latestBagVersion(await loadBagVersions(fields.bag_id))?.id ?? null
//
// Offline — which is the condition a round starts in, standing on a tee with
// one bar — that fallback can record a snapshot that is weeks old. Nothing on
// the round distinguishes it from one taken at the first tee, and the round
// then claims a bag composition it may never have had.
//
// What makes this answerable rather than merely worrying: `bag_versions` gets a
// new row on **every** grouped save, so the version list for a bag is a
// complete edit timeline. "Was this snapshot still current when the round
// started?" is therefore a real question with a real answer — a save between
// the snapshot and the round means it was not. The same timeline answers "was
// the bag edited while the round was in progress?".
//
// The rule this module refuses to break: it never repairs. It does not write a
// version id onto a round that lacks one, it does not silently substitute the
// nearest plausible snapshot, and it does not treat "I could not read the
// versions" as "there is no snapshot". Raw events and version history are
// authoritative here; the honest output of a verification that cannot be
// completed is a status saying so.

export const BAG_VERIFICATION_STATUSES = Object.freeze({
  /** Snapshot resolves, belongs to the recorded bag, and no save intervened. */
  VERIFIED: 'verified',
  /** Snapshot resolves, but the bag was saved again inside the window. */
  EDITED: 'edited',
  /** The snapshot belongs to a different bag than the round names. */
  BAG_MISMATCH: 'bag_mismatch',
  /** A version id is recorded and no such version could be found. */
  SNAPSHOT_MISSING: 'snapshot_missing',
  /** A bag is recorded and no version is — pre-snapshot round, or a failed capture. */
  NOT_SNAPSHOTTED: 'not_snapshotted',
  /** No bag was chosen. Nothing to verify, and that is not a fault. */
  NO_BAG_RECORDED: 'no_bag_recorded',
  /** The version history could not be read. Verification did not happen. */
  UNKNOWN: 'unknown',
})

function toTime(value) {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

/**
 * The round's own clock reading for "when did this start".
 *
 * `created_at` is preferred over `played_at` deliberately, and it is not a
 * style choice: `created_at` is a server default and `bag_versions.created_at`
 * is too, so comparing them compares two readings of the same clock.
 * `played_at` is generated on the device at submit, so a phone a few minutes
 * out of step would manufacture edits that never happened. `played_at` is the
 * fallback only for a row that has no `created_at` at all — an import, or a
 * local optimistic row that has not been read back yet.
 */
export function roundStartedAt(round) {
  return toTime(round?.created_at) ?? toTime(round?.played_at)
}

function versionDiscIds(version) {
  return [...new Set((version?.bag_version_discs ?? []).map((row) => row?.disc_id).filter(Boolean))]
}

function difference(left, right) {
  const other = new Set(right)
  return left.filter((id) => !other.has(id))
}

function result(status, extra = {}) {
  return {
    status,
    verified: status === BAG_VERIFICATION_STATUSES.VERIFIED,
    bagId: null,
    versionId: null,
    versionNumber: null,
    versionName: null,
    snapshotAt: null,
    discIds: [],
    discCount: null,
    editedBeforeRound: [],
    editedDuringRound: [],
    windowEndKnown: false,
    driftFromCurrent: null,
    ...extra,
  }
}

/**
 * Verify one round's bag snapshot against the bag's version history.
 *
 * @param {object} input
 * @param {object} input.round        the round row (needs `bag_id`, `bag_version_id`, timestamps)
 * @param {Array|null} input.versions every known version of that bag, each with `bag_version_discs`.
 *                                    **`null` means "could not be read"** and is not the same as
 *                                    `[]`, which means "read, and there are none". Conflating them
 *                                    is how a network failure turns into a false accusation.
 * @param {number|string|null} input.roundEndedAt when the round finished, if known. Without it, an
 *                                    edit after the start cannot be placed inside or after the
 *                                    round, and the result says so via `windowEndKnown: false`
 *                                    rather than guessing.
 */
export function verifyRoundBag({ round, versions, roundEndedAt = null } = {}) {
  const bagId = round?.bag_id ?? null
  const versionId = round?.bag_version_id ?? null

  if (!bagId && !versionId) return result(BAG_VERIFICATION_STATUSES.NO_BAG_RECORDED)

  // Checked before anything else. A failed read is not evidence about the
  // snapshot, and reporting `snapshot_missing` because the phone was in a
  // basement would be exactly the silent-repair-shaped mistake in reverse:
  // stating a conclusion the data does not support.
  if (!Array.isArray(versions)) return result(BAG_VERIFICATION_STATUSES.UNKNOWN, { bagId, versionId })

  if (!versionId) return result(BAG_VERIFICATION_STATUSES.NOT_SNAPSHOTTED, { bagId })

  const version = versions.find((row) => row?.id === versionId) ?? null
  if (!version) return result(BAG_VERIFICATION_STATUSES.SNAPSHOT_MISSING, { bagId, versionId })

  const discIds = versionDiscIds(version)
  const snapshotAt = toTime(version.created_at)
  const base = {
    bagId,
    versionId,
    versionNumber: version.version ?? null,
    versionName: version.name ?? null,
    snapshotAt: version.created_at ?? null,
    discIds,
    discCount: discIds.length,
  }

  if (bagId && version.bag_id && version.bag_id !== bagId) {
    // The round names one bag and points at another bag's snapshot. Never
    // "corrected" to whichever looks more plausible — both values are recorded
    // facts and the disagreement is the finding.
    return result(BAG_VERIFICATION_STATUSES.BAG_MISMATCH, { ...base, mismatchedBagId: version.bag_id })
  }

  // Drift is context, not a fault: it answers "how different is my bag now?"
  // for a player reading an old round. Computed against the newest version of
  // the same bag, and omitted entirely when the snapshot IS the newest.
  const newest = versions
    .filter((row) => row?.bag_id === version.bag_id)
    .reduce((latest, row) => (!latest || (row.version ?? 0) > (latest.version ?? 0) ? row : latest), null)
  const driftFromCurrent =
    newest && newest.id !== version.id
      ? {
          added: difference(versionDiscIds(newest), discIds),
          removed: difference(discIds, versionDiscIds(newest)),
        }
      : null

  const startedAt = roundStartedAt(round)
  const endedAt = toTime(roundEndedAt)

  // No usable clock reading on either side means the timeline cannot be
  // walked at all. The snapshot resolves and belongs to the bag, but "was it
  // current?" is unanswerable, so it is reported as edited-unknown rather than
  // as verified. `windowEndKnown: false` is what a caller words its message on.
  if (startedAt == null || snapshotAt == null) {
    return result(BAG_VERIFICATION_STATUSES.EDITED, {
      ...base,
      driftFromCurrent,
      windowEndKnown: false,
      undatable: true,
    })
  }

  const siblings = versions.filter(
    (row) => row?.id !== version.id && row?.bag_id === version.bag_id,
  )
  const editedBeforeRound = []
  const editedDuringRound = []
  for (const row of siblings) {
    const at = toTime(row.created_at)
    if (at == null || at <= snapshotAt) continue
    if (at <= startedAt) {
      // A save between the snapshot and the first tee. This is the stale-
      // fallback case: the round recorded a version that had already been
      // superseded before play began.
      editedBeforeRound.push(row.id)
    } else if (endedAt == null || at <= endedAt) {
      // Inside the round, or after a start whose end we do not know. Both mean
      // the snapshot stopped describing the bag at some point the round covers.
      editedDuringRound.push(row.id)
    }
  }

  const edited = editedBeforeRound.length > 0 || editedDuringRound.length > 0
  return result(edited ? BAG_VERIFICATION_STATUSES.EDITED : BAG_VERIFICATION_STATUSES.VERIFIED, {
    ...base,
    driftFromCurrent,
    editedBeforeRound,
    editedDuringRound,
    windowEndKnown: endedAt != null,
  })
}

const STATUS_HEADLINES = {
  verified: 'Bag confirmed',
  edited: 'Bag cannot be confirmed',
  bag_mismatch: 'Bag cannot be confirmed',
  snapshot_missing: 'Bag cannot be confirmed',
  not_snapshotted: 'Bag not snapshotted',
  no_bag_recorded: 'No bag recorded',
  unknown: 'Bag not checked',
}

/**
 * One honest sentence per outcome.
 *
 * Every message for a non-verified status says what is known, what is not, and
 * why — never "something went wrong". A player has to be able to tell "your bag
 * changed mid-round" from "your phone could not reach the server", because one
 * is about their equipment and the other is about their signal.
 */
export function describeBagVerification(verification) {
  const status = verification?.status ?? BAG_VERIFICATION_STATUSES.UNKNOWN
  const headline = STATUS_HEADLINES[status] ?? STATUS_HEADLINES.unknown

  if (status === BAG_VERIFICATION_STATUSES.VERIFIED) {
    const count = verification.discCount
    return { headline, detail: `${count} ${count === 1 ? 'disc' : 'discs'}, unchanged for this round.` }
  }
  if (status === BAG_VERIFICATION_STATUSES.EDITED) {
    if (verification.undatable) {
      return {
        headline,
        detail: 'This round has no usable start time, so the snapshot cannot be placed against the bag’s edit history.',
      }
    }
    const before = verification.editedBeforeRound.length
    const during = verification.editedDuringRound.length
    if (before > 0 && during === 0) {
      return {
        headline,
        detail: 'The bag was saved again after this snapshot but before the round started, so the snapshot is older than the round.',
      }
    }
    if (before === 0 && during > 0) {
      return {
        headline,
        detail: verification.windowEndKnown
          ? 'The bag was saved again while this round was in progress, so what was carried after that point is not recorded.'
          : 'The bag was saved again after this round started, and the round has no recorded end, so it cannot be told whether that happened during play.',
      }
    }
    return {
      headline,
      detail: 'The bag was saved again both before and during this round, so the snapshot does not describe the whole of it.',
    }
  }
  if (status === BAG_VERIFICATION_STATUSES.BAG_MISMATCH) {
    return {
      headline,
      detail: 'The recorded snapshot belongs to a different bag than the round names. Both values are kept as recorded.',
    }
  }
  if (status === BAG_VERIFICATION_STATUSES.SNAPSHOT_MISSING) {
    return {
      headline,
      detail: 'The round points at a bag version that no longer resolves. Nothing has been substituted for it.',
    }
  }
  if (status === BAG_VERIFICATION_STATUSES.NOT_SNAPSHOTTED) {
    return {
      headline,
      detail: 'A bag was chosen but no snapshot was taken, so its contents at the time cannot be established.',
    }
  }
  if (status === BAG_VERIFICATION_STATUSES.NO_BAG_RECORDED) {
    return { headline, detail: 'No bag was selected when this round started.' }
  }
  return {
    headline,
    detail: 'The bag’s version history could not be read, so nothing has been checked either way.',
  }
}
