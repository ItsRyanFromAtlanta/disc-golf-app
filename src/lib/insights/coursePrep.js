// Course preparation — what the app can honestly tell a player before they tee
// off, computed entirely from data that already exists.
//
// `AGENTS.md` names course prep as one of three pillars: "pre-round strategy,
// hole-by-hole info, disc recommendations". The third of those is where this
// module had to make a decision, so it is worth stating up front.
//
// There is no honest per-player distance model in this schema. `discs` and
// `disc_molds` carry flight numbers, but nothing anywhere records how far this
// player throws anything — the putting tables stop at putting range and
// `disc_odometer_events` counts throws, not distance. Turning speed/glide/turn/
// fade into "throw this disc on hole 7" would require inventing a
// distance-per-speed curve and calling the result a recommendation. That is
// exactly the opaque composite score `PRODUCT_ROADMAP.md` rejects, and it would
// be wrong for anyone whose arm does not match the invented curve.
//
// So the disc half of this module is grounded in the player's own record
// instead: which discs they have actually thrown on this hole, how often, and
// how those attempts scored. That is deterministic, explainable in one line, and
// carries its own sample size. It says nothing at all until the player has
// played the hole — which is correct, and is the state this feature ships into.
//
// Everything here is a pure function over rows the caller already loaded.

/**
 * Presentation bands for measured hole distance.
 *
 * These group a fact (`holes.distance_feet`) for reading; they are deliberately
 * NOT a claim about which disc a hole calls for. The boundaries are round
 * numbers chosen so an 18-hole layout splits into buckets a person can hold in
 * their head, and they are named constants so changing them is one edit.
 */
export const HOLE_DISTANCE_BANDS = [
  { key: 'short', label: 'Under 250 ft', minFeet: 0, maxFeet: 249 },
  { key: 'mid', label: '250–349 ft', minFeet: 250, maxFeet: 349 },
  { key: 'long', label: '350–449 ft', minFeet: 350, maxFeet: 449 },
  { key: 'very_long', label: '450 ft and up', minFeet: 450, maxFeet: Number.POSITIVE_INFINITY },
]

/**
 * The floor before a per-hole average is printed rather than withheld.
 *
 * Three, matching `CONDITION_SPLIT_MIN_ROUNDS` and the "never off a single
 * event, require a pattern of at least three" rule `AGENTS.md` applies to
 * coaching. Below the floor this module still reports counts and best scores —
 * those are facts about what happened. An average over one round is not an
 * average, it is that round wearing a statistical costume.
 */
export const COURSE_PREP_MIN_ROUNDS = 3

/**
 * `disc_molds.category` in throwing order, shortest to longest.
 *
 * The vocabulary is fixed by a CHECK constraint in
 * `disc_locker_and_layouts_schema.sql`; this array only fixes the display order,
 * so an unknown value sorts out rather than crashing.
 */
export const DISC_CATEGORY_ORDER = ['putter', 'approach', 'midrange', 'fairway', 'distance']

// A disc is only "carried" if it is still in the locker. `lost`, `retired` and
// `sold` discs are real history but they are not in the bag on Saturday, and
// counting them would overstate what the player can actually throw.
const CARRYABLE_DISC_STATUSES = new Set(['in_locker'])

function finiteNumber(value) {
  if (value === '' || value == null || typeof value === 'boolean') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/** Play order: hole number, then tee type so a multi-tee hole stays grouped. */
function byPlayOrder(left, right) {
  const leftNumber = finiteNumber(left?.hole_number)
  const rightNumber = finiteNumber(right?.hole_number)
  if (leftNumber == null && rightNumber == null) return 0
  if (leftNumber == null) return 1
  if (rightNumber == null) return -1
  if (leftNumber !== rightNumber) return leftNumber - rightNumber
  return String(left?.tee_type ?? '').localeCompare(String(right?.tee_type ?? ''))
}

function layoutHoles(layout) {
  return [...(layout?.holes ?? [])].sort(byPlayOrder)
}

/** The band a measured distance falls in, or null when nothing was recorded. */
export function holeDistanceBand(distanceFeet) {
  const feet = finiteNumber(distanceFeet)
  if (feet == null || feet < 0) return null
  return HOLE_DISTANCE_BANDS.find((band) => feet >= band.minFeet && feet <= band.maxFeet) ?? null
}

/**
 * The shape of a layout, before any round has been played on it.
 *
 * This is the part of course prep that works at zero history, which is the
 * state the live catalog is actually in — and the reason coverage counts
 * (`holesWithPar`, `holesWithDistance`) are returned beside the totals rather
 * than folded into them. A layout whose distances were never entered should say
 * so, not quietly report a 2,400 ft course as though four holes did not exist.
 */
export function layoutBrief(layout) {
  const holes = layoutHoles(layout)
  const parCounts = new Map()
  const bandCounts = new Map()

  let parTotal = 0
  let holesWithPar = 0
  let distanceTotalFeet = 0
  let holesWithDistance = 0
  let hazards = 0
  let strategyNotes = 0
  let longest = null
  let shortest = null

  for (const hole of holes) {
    const par = finiteNumber(hole?.par)
    if (par != null) {
      parTotal += par
      holesWithPar += 1
      parCounts.set(par, (parCounts.get(par) ?? 0) + 1)
    }

    const distance = finiteNumber(hole?.distance_feet)
    if (distance != null) {
      distanceTotalFeet += distance
      holesWithDistance += 1
      const band = holeDistanceBand(distance)
      if (band) bandCounts.set(band.key, (bandCounts.get(band.key) ?? 0) + 1)
      const summary = { holeId: hole.id ?? null, holeNumber: finiteNumber(hole?.hole_number), distanceFeet: distance }
      if (longest == null || distance > longest.distanceFeet) longest = summary
      if (shortest == null || distance < shortest.distanceFeet) shortest = summary
    }

    if (typeof hole?.hazards === 'string' && hole.hazards.trim()) hazards += 1
    if (typeof hole?.strategy_notes === 'string' && hole.strategy_notes.trim()) strategyNotes += 1
  }

  return {
    layoutId: layout?.id ?? null,
    layoutName: layout?.name ?? null,
    holeCount: holes.length,
    parTotal,
    holesWithPar,
    distanceTotalFeet,
    holesWithDistance,
    holesWithoutDistance: holes.length - holesWithDistance,
    longest,
    shortest,
    parMix: [...parCounts.entries()]
      .map(([par, count]) => ({ par, holes: count }))
      .sort((left, right) => left.par - right.par),
    // Empty bands are dropped rather than returned as zeroes: a reader scanning
    // "6 holes 350–449 ft" does not need to be told there are no holes in a
    // band the course does not have.
    bands: HOLE_DISTANCE_BANDS.filter((band) => bandCounts.has(band.key)).map((band) => ({
      key: band.key,
      label: band.label,
      holes: bandCounts.get(band.key),
    })),
    documented: { hazards, strategyNotes },
  }
}

// Only a completed round on THIS layout is evidence about these holes.
//
// In-progress rounds are excluded because a score on the card can still change,
// and every other metric surface in the app reads completed-visible sources
// only. Other layouts are excluded for the reason `roundConditions.js` gives at
// more length: a different layout is different holes at different pars, so
// mixing them measures which layout was played, not how the player played.
function comparableRounds(rounds, layoutId) {
  if (!layoutId) return []
  return (rounds ?? []).filter((round) => round?.layout_id === layoutId && round?.status === 'completed')
}

/**
 * One prep entry per hole: the course's own record, plus whatever the player's
 * completed rounds on this exact layout have to say about it.
 *
 * Facts are always returned. Averages are withheld below `minRounds` and come
 * back as `null`, so a caller renders "played twice, best 3" rather than an
 * average that is really just one round with error bars nobody drew.
 */
export function holePrep(layout, rounds = [], { minRounds = COURSE_PREP_MIN_ROUNDS } = {}) {
  const holes = layoutHoles(layout)
  const relevant = comparableRounds(rounds, layout?.id ?? null)

  // hole id -> the round_holes rows recorded against it, across every
  // comparable round. Built once rather than re-scanned per hole.
  const rowsByHoleId = new Map()
  for (const round of relevant) {
    for (const row of round?.round_holes ?? []) {
      if (!row?.hole_id) continue
      const rows = rowsByHoleId.get(row.hole_id) ?? []
      rows.push(row)
      rowsByHoleId.set(row.hole_id, rows)
    }
  }

  return holes.map((hole) => {
    const par = finiteNumber(hole?.par)
    const distanceFeet = finiteNumber(hole?.distance_feet)
    const rows = rowsByHoleId.get(hole?.id) ?? []
    const scores = rows.map((row) => finiteNumber(row?.score)).filter((score) => score != null && score > 0)

    let totalRelativeToPar = 0
    let underPar = 0
    let atPar = 0
    let overPar = 0
    if (par != null) {
      for (const score of scores) {
        totalRelativeToPar += score - par
        if (score < par) underPar += 1
        else if (score === par) atPar += 1
        else overPar += 1
      }
    }

    const discs = new Map()
    for (const row of rows) {
      if (!row?.disc_id) continue
      const entry = discs.get(row.disc_id) ?? { discId: row.disc_id, disc: null, throws: 0, scoredThrows: 0, total: 0 }
      entry.disc = entry.disc ?? row.disc ?? null
      entry.throws += 1
      const score = finiteNumber(row?.score)
      if (score != null && score > 0 && par != null) {
        entry.scoredThrows += 1
        entry.total += score - par
      }
      discs.set(row.disc_id, entry)
    }

    return {
      holeId: hole?.id ?? null,
      holeNumber: finiteNumber(hole?.hole_number),
      par,
      distanceFeet,
      band: holeDistanceBand(distanceFeet),
      teeType: hole?.tee_type ?? null,
      hazards: hole?.hazards ?? null,
      strategyNotes: hole?.strategy_notes ?? null,
      playedRounds: scores.length,
      best: scores.length ? Math.min(...scores) : null,
      worst: scores.length ? Math.max(...scores) : null,
      // A fact — the strokes this hole has actually cost, over the rounds shown
      // beside it. Reported at any sample size because it is a sum of things
      // that happened, not an estimate of what happens next.
      totalRelativeToPar: par == null ? null : totalRelativeToPar,
      // A claim. Withheld until it has enough behind it to be one.
      averageRelativeToPar:
        par != null && scores.length >= minRounds ? totalRelativeToPar / scores.length : null,
      outcomes: { underPar, atPar, overPar },
      discs: [...discs.values()]
        .map((entry) => ({
          discId: entry.discId,
          disc: entry.disc,
          throws: entry.throws,
          scoredThrows: entry.scoredThrows,
          averageRelativeToPar: entry.scoredThrows >= minRounds ? entry.total / entry.scoredThrows : null,
        }))
        .sort((left, right) => right.throws - left.throws || String(left.discId).localeCompare(String(right.discId))),
    }
  })
}

/**
 * The holes that have actually cost this player strokes on this layout.
 *
 * Ranked by average over par — not by total, which would just promote whichever
 * hole happens to have been played most — and only holes whose average survived
 * `holePrep`'s sample floor are eligible at all. A layout with too little
 * history returns an empty array, which callers should render as nothing rather
 * than as an empty heading.
 */
export function priorityHoles(entries = [], { limit = 3 } = {}) {
  return entries
    .filter((entry) => entry?.averageRelativeToPar != null && entry.averageRelativeToPar > 0)
    .sort(
      (left, right) =>
        right.averageRelativeToPar - left.averageRelativeToPar ||
        right.playedRounds - left.playedRounds ||
        (left.holeNumber ?? 0) - (right.holeNumber ?? 0),
    )
    .slice(0, limit)
}

/**
 * What the layout asks for, beside what the player is carrying.
 *
 * Deliberately two counts printed next to each other, not a verdict. This
 * module cannot say a bag is wrong for a course without the distance model the
 * header explains it does not have, so it does not try: it reports how many
 * holes fall in each distance band and how many discs sit in each catalog
 * category, and lets the player draw the conclusion.
 *
 * `uncategorized` is returned rather than hidden because `disc_molds.category`
 * is nullable and the catalog is populated by hand — a reader has to be able to
 * tell "no distance drivers" from "the catalog does not know what these are".
 */
export function lockerCoverage(layout, discs = []) {
  const brief = layoutBrief(layout)
  const carried = (discs ?? []).filter((disc) => disc?.status == null || CARRYABLE_DISC_STATUSES.has(disc.status))

  const categoryCounts = new Map()
  let uncategorized = 0
  for (const disc of carried) {
    const category = disc?.moldInfo?.category ?? disc?.category ?? null
    if (typeof category === 'string' && DISC_CATEGORY_ORDER.includes(category)) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
    } else {
      uncategorized += 1
    }
  }

  return {
    bands: brief.bands,
    holesWithoutDistance: brief.holesWithoutDistance,
    categories: DISC_CATEGORY_ORDER.filter((category) => categoryCounts.has(category)).map((category) => ({
      category,
      discs: categoryCounts.get(category),
    })),
    uncategorized,
    discCount: carried.length,
  }
}
