// Shapes a DB-ready `putt_events` row (see `putt_events_schema.sql`). Pure —
// no Supabase, no React, no I/O — so the exclusive-arc parent selection is
// testable without a hook harness.
//
// The table's exclusive-arc CHECK requires exactly one of `regimen_run_id` /
// `freeform_session_id` / `round_hole_id` to be non-null. `parent.type`
// selects the arm; the other two are written as an explicit `null`, never
// omitted, so a practice putt's absent round is a stated fact in the payload
// rather than a key an upsert could fill in differently depending on which
// fields happened to be present.
//
// `round_hole_id` already exists on the live table (shipped 2026-07-05,
// Track 2.2c — confirmed still live via Supabase MCP 2026-07-31; see the
// FEATURE_BACKLOG.md entry for `round_hole_id on putt_events`, corrected the
// same day). This function is the seam a future round-putting capture
// surface would call to carry a putt's `round_hole_id` through — nothing
// calls it with `parent.type === 'round'` yet, because no screen captures
// putts mid-round today (`RoundScorecardPage` records per-hole strokes, not
// per-putt gesture events). Building that capture surface is a product
// decision nobody has made; this file deliberately stops short of it.
const PARENT_TYPES = new Set(['regimen', 'freeform', 'round'])

export function buildPuttEventRow({
  id,
  userId,
  parent,
  sequence,
  outcome,
  missZone = null,
  distanceFt,
  occurredAt,
  setOrder = null,
  putterDiscId = null,
  isPressure = false,
}) {
  if (!parent || !PARENT_TYPES.has(parent.type)) {
    throw new Error(`buildPuttEventRow: parent.type must be one of ${[...PARENT_TYPES].join(', ')}, got ${parent?.type}`)
  }
  return {
    id,
    _op: 'insert',
    user_id: userId,
    regimen_run_id: parent.type === 'regimen' ? parent.regimenRunId ?? null : null,
    freeform_session_id: parent.type === 'freeform' ? parent.freeformSessionId ?? null : null,
    round_hole_id: parent.type === 'round' ? parent.roundHoleId ?? null : null,
    // Denormalized copy of putting_regimen_sets.set_order — regimen-parented
    // rows only (see putt_events_schema.sql); forced null for every other arm
    // regardless of what a caller passes, rather than trusting the caller not
    // to send a stale value from an unrelated parent type.
    set_order: parent.type === 'regimen' ? setOrder : null,
    sequence,
    outcome,
    miss_zone: missZone,
    distance_ft: distanceFt,
    occurred_at: occurredAt,
    putter_disc_id: putterDiscId,
    is_pressure: isPressure === true,
  }
}
