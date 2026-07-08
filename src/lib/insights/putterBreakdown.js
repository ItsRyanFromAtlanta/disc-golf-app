// Session Summary's putter-performance breakdown (Screen 9): isolates
// accuracy by exact physical disc, using putt_events.putter_disc_id (Layer
// 1 schema, actually written starting with Screen 8's canvas). Real
// gesture-captured events only — batch-ribbon fills never create putt_events
// (see the project's data-split rule), so a session/run that used the batch
// ribbon will show fewer attempts here than its true total. Documented
// limitation, not a bug: there is no per-putt putter attribution to recover
// for a batch fill.
export function putterBreakdown(puttEvents) {
  const byPutter = new Map()
  for (const e of puttEvents) {
    if (!e.putter_disc_id) continue
    const bucket = byPutter.get(e.putter_disc_id) ?? { putterDiscId: e.putter_disc_id, makes: 0, attempts: 0 }
    bucket.attempts += 1
    if (e.outcome === 'make') bucket.makes += 1
    byPutter.set(e.putter_disc_id, bucket)
  }
  return [...byPutter.values()].map((b) => ({ ...b, pct: b.makes / b.attempts })).sort((a, b) => b.attempts - a.attempts)
}
