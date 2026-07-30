import { parTotal } from '../rounds'
import { normalizeRoster, normalizePlayerName, normalizeStatedTotal } from '../roundPlayers'
import { roundScoreSummary } from '../roundScoring'

// The card as recorded: the owner plus whoever else was on it.
//
// This is the derived half of the group-scorecard groundwork, and the important
// part of it is what it refuses to do.
//
// **It does not rank.** Entries come back in seat order — the owner first,
// because it is their round and their record, then companions by seat. Nothing
// sorts by score, nothing computes a gap, and nothing names a winner.
// Head-to-head and leaderboards are `FEATURE_BACKLOG.md`'s LATER (deliberate)
// rows, parked behind the Social revisit trigger, and the distance between "a
// private card that lists four totals" and "a leaderboard" is exactly one sort
// call — so the sort is the line, and this module stays on the near side of it.
//
// **It does not average.** Every companion total is a number one person typed
// about another person's round from memory. It is a fine thing to keep and a
// terrible thing to compute with, so it feeds nothing: not
// `insights/roundVolume.js`, not `insights/roundConditions.js`, not
// `insights/coursePrep.js`. The rule from the activity-only work — anything
// counting rounds counts them, anything averaging strokes excludes them —
// resolves here even more simply, because a companion's round is not the
// owner's round at all and belongs in neither.
//
// **It reports its own coverage**, like `layoutBrief` and `conditionLedger`
// before it. A card where two of four players have a total is a card with two
// missing numbers, and saying so is more useful than printing two numbers as
// though they were the whole story.

/**
 * Relative to par for a stated total, or `null`.
 *
 * Only derivable when a layout was recorded AND its holes carry pars. A layout
 * whose pars are all null totals 0, and `stated - 0` is the raw score wearing a
 * "+54" costume — the same trap `roundScoreSummary` avoids for the owner's own
 * stated total, avoided the same way.
 */
function statedRelativeToPar(total, par) {
  if (total == null || !(par > 0)) return null
  return total - par
}

/**
 * The whole card for one round.
 *
 * @param {object} input
 * @param {object} input.round   the round row, with `holes` when a layout was recorded
 * @param {Array}  input.players companion rows as stored (`round_players`)
 * @param {string} input.selfLabel what to call the owner's own line
 */
export function groupScorecard({ round = {}, players = [], selfLabel = 'You' } = {}) {
  const roster = normalizeRoster(players)
  const par = parTotal(round?.holes ?? [])
  const self = roundScoreSummary(round)

  const entries = [
    {
      kind: 'self',
      id: round?.id ?? null,
      position: 0,
      name: selfLabel,
      total: self.total,
      // Carried through rather than re-derived so the owner's line says exactly
      // what the summary screen's hero says. A scorecard round's total is
      // derived; an activity-only round's is stated; they must not print the
      // same way here and differently there.
      totalSource: self.totalSource,
      relativeToPar: self.relativeToPar,
      relativeToParSource: self.relativeToParSource,
    },
    ...roster.map((row) => {
      const total = normalizeStatedTotal(row.total_score)
      const relative = statedRelativeToPar(total, par)
      return {
        kind: 'companion',
        id: row.id ?? null,
        position: Number(row.position),
        name: normalizePlayerName(row.display_name),
        total,
        // Always 'stated'. There is no companion scorecard to derive from, and
        // when one lands it must bring its own provenance discriminator rather
        // than letting this be inferred from the presence of hole rows.
        totalSource: total == null ? null : 'stated',
        relativeToPar: relative,
        relativeToParSource: relative == null ? null : 'stated_vs_par',
      }
    }),
  ]

  const withTotals = entries.filter((entry) => entry.total != null).length

  return {
    // A round is a group round when somebody else is recorded on it — a fact,
    // not a guess. A solo round and a round whose roster was never filled in
    // are the same thing here, and neither is claimed to be the other.
    isGroupRound: roster.length > 0,
    // Including the owner, so it reads the way a player would say it: "we were
    // a threesome".
    cardSize: roster.length + 1,
    companionCount: roster.length,
    entries,
    parTotal: par > 0 ? par : null,
    totalsRecorded: withTotals,
    // `null` rather than 0 when the card is only the owner: one player is not
    // "0% coverage of a group", it is not a group.
    totalsCoverage: roster.length === 0 ? null : withTotals / entries.length,
  }
}

/**
 * One honest sentence about the card, or `null` when there is nothing to say.
 *
 * `null` for a solo round, because "you played alone" is a claim the data does
 * not support — an empty roster means nobody was recorded, and every round
 * logged before this feature existed has one.
 */
export function describeGroupScorecard(card) {
  if (!card?.isGroupRound) return null
  const players = card.cardSize === 2 ? 'Two players' : `${card.cardSize} players`
  const missing = card.entries.length - card.totalsRecorded
  if (missing === 0) return `${players} on this card, all with a total recorded.`
  if (card.totalsRecorded === 0) return `${players} on this card. No totals recorded.`
  return `${players} on this card. ${card.totalsRecorded} of ${card.entries.length} have a total recorded.`
}
