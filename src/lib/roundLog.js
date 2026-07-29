import { supabase } from './supabaseClient'

const DISC_SELECT = '*, moldInfo:disc_molds(*)'

function throwIfError(result) {
  if (result.error) throw result.error
  return result.data
}

function idList(rows) {
  return [...new Set(rows.map((row) => row).filter(Boolean))]
}

function byId(rows) {
  return new Map(rows.map((row) => [row.id, row]))
}

function nullableNumber(value) {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeRoundFields(fields = {}) {
  const allowed = [
    'id',
    'course_id',
    'layout_id',
    'bag_id',
    'bag_version_id',
    'played_at',
    'weather_summary',
    'target_score',
    'total_score',
    'status',
    'external_source',
    'external_ref',
  ]
  return Object.fromEntries(allowed.filter((key) => fields[key] !== undefined).map((key) => [key, fields[key]]))
}

function normalizeHoleFields(input = {}) {
  const roundId = input.round_id ?? input.roundId
  const holeId = input.hole_id ?? input.holeId
  if (!roundId || !holeId) throw new Error('A round hole requires roundId and holeId')

  return {
    id: input.id ?? crypto.randomUUID(),
    round_id: roundId,
    hole_id: holeId,
    score: nullableNumber(input.score),
    disc_id: input.disc_id ?? input.discId ?? null,
    notes: input.notes ?? null,
  }
}

async function fetchByIds(table, ids, select = '*') {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from(table).select(select).in('id', ids)
  return throwIfError({ data, error })
}

async function hydrateRounds(rounds) {
  if (rounds.length === 0) return []
  const [courses, layouts] = await Promise.all([
    fetchByIds('courses', idList(rounds.map((round) => round.course_id))),
    fetchByIds('layouts', idList(rounds.map((round) => round.layout_id))),
  ])
  const coursesById = byId(courses)
  const layoutsById = byId(layouts)
  return rounds.map((round) => ({
    ...round,
    course: coursesById.get(round.course_id) ?? null,
    layout: layoutsById.get(round.layout_id) ?? null,
  }))
}

export async function fetchRounds(userId) {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .order('created_at', { ascending: false })
  return hydrateRounds(throwIfError({ data, error }))
}

export async function fetchRound(roundId) {
  const { data: round, error: roundError } = await supabase.from('rounds').select('*').eq('id', roundId).single()
  throwIfError({ data: round, error: roundError })

  const [courseResult, layoutResult, roundHolesResult, layoutHolesResult] = await Promise.all([
    supabase.from('courses').select('*').eq('id', round.course_id).maybeSingle(),
    round.layout_id
      ? supabase.from('layouts').select('*').eq('id', round.layout_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('round_holes').select('*').eq('round_id', roundId).order('hole_id'),
    round.layout_id
      ? supabase.from('holes').select('*').eq('layout_id', round.layout_id).order('hole_number').order('tee_type')
      : Promise.resolve({ data: [], error: null }),
  ])
  const course = throwIfError(courseResult)
  const layout = throwIfError(layoutResult)
  const roundHoles = throwIfError(roundHolesResult)
  const layoutHoles = throwIfError(layoutHolesResult)

  const knownHoleIds = new Set(layoutHoles.map((hole) => hole.id))
  const missingHoleIds = idList(roundHoles.map((roundHole) => roundHole.hole_id)).filter(
    (holeId) => !knownHoleIds.has(holeId),
  )
  const [missingHoles, discs] = await Promise.all([
    fetchByIds('holes', missingHoleIds),
    fetchByIds('discs', idList(roundHoles.map((roundHole) => roundHole.disc_id)), DISC_SELECT),
  ])
  const holesById = byId([...layoutHoles, ...missingHoles])
  const discsById = byId(discs)

  return {
    ...round,
    course,
    layout: layout ? { ...layout, holes: layoutHoles } : null,
    holes: [...layoutHoles, ...missingHoles],
    round_holes: roundHoles.map((roundHole) => ({
      ...roundHole,
      hole: holesById.get(roundHole.hole_id) ?? null,
      disc: discsById.get(roundHole.disc_id) ?? null,
    })),
  }
}

export async function createRound(userId, fields = {}) {
  const payload = {
    ...normalizeRoundFields(fields),
    id: fields.id ?? crypto.randomUUID(),
    user_id: userId,
  }
  const { data, error } = await supabase.from('rounds').upsert(payload, { onConflict: 'id' }).select().single()
  const created = throwIfError({ data, error })
  return fetchRound(created.id)
}

export async function updateRound(roundId, fields = {}) {
  const payload = normalizeRoundFields(fields)
  delete payload.id
  delete payload.user_id
  const { data, error } = await supabase.from('rounds').update(payload).eq('id', roundId).select().single()
  const updated = throwIfError({ data, error })
  return fetchRound(updated.id)
}

// `round_holes` carries `unique (round_id, hole_id)` (supabase_schema.sql), so
// the natural key — not the surrogate `id` — is what a retry has to resolve
// against.
//
// Resolving on `id` was wrong in a way that only showed up offline: a replay
// whose locally-generated id had changed (second device, cleared cache, a
// queued write re-created from a fresh optimistic row) took the INSERT branch,
// which then violated the natural-key constraint. That 23505 was swallowed by
// `flushRoundOutbox`'s bare catch and the entry stayed queued, so the round
// retried the same doomed write on every reconnect and every app load without
// ever surfacing. Resolving on the natural key converges instead.
//
// `id` is deliberately not sent: PostgREST's merge-duplicates updates every
// column supplied, so including it would rewrite the primary key on the
// conflict path — and the local Dexie mirror is keyed by that id.
export async function upsertRoundHole(input = {}) {
  const { id: _localId, ...payload } = normalizeHoleFields(input)
  const { data, error } = await supabase
    .from('round_holes')
    .upsert(payload, { onConflict: 'round_id,hole_id' })
    .select()
    .single()
  return throwIfError({ data, error })
}

export async function fetchCourses() {
  const { data, error } = await supabase.from('courses').select('*').order('name')
  // Keep the root directory lightweight. Course detail loads layouts/holes.
  return throwIfError({ data, error })
}

export async function fetchCourse(courseId) {
  const { data: course, error: courseError } = await supabase.from('courses').select('*').eq('id', courseId).single()
  throwIfError({ data: course, error: courseError })

  const { data: layouts, error: layoutsError } = await supabase
    .from('layouts')
    .select('*')
    .eq('course_id', courseId)
    .order('is_default', { ascending: false })
    .order('name')
  const layoutRows = throwIfError({ data: layouts, error: layoutsError })
  const layoutIds = idList(layoutRows.map((layout) => layout.id))
  const { data: holes, error: holesError } = layoutIds.length
    ? await supabase.from('holes').select('*').in('layout_id', layoutIds).order('hole_number').order('tee_type')
    : { data: [], error: null }
  const holeRows = throwIfError({ data: holes, error: holesError })
  const holesByLayout = new Map()
  for (const hole of holeRows) {
    const rows = holesByLayout.get(hole.layout_id) ?? []
    rows.push(hole)
    holesByLayout.set(hole.layout_id, rows)
  }

  return {
    ...course,
    layouts: layoutRows.map((layout) => ({ ...layout, holes: holesByLayout.get(layout.id) ?? [] })),
  }
}

// PostgREST cannot find the function in its schema cache; Postgres does not know
// it at all. Both mean the migration behind `createCourseWithLayout` has not
// landed yet — `main` auto-deploys and a migration cannot ride in the same
// atomic step as the client that calls it, so there is always a window where the
// button is live and the function is not. Same pattern as `accountDeletion.js`.
const MISSING_COURSE_RPC_CODES = new Set(['PGRST202', '42883'])

export const COURSE_CREATE_UNAVAILABLE_MESSAGE =
  'Course creation is temporarily unavailable. Nothing was saved — please try again shortly.'

// A course, its default layout and its holes used to be three sequential
// upserts with nothing tying them together. A failure after the first left an
// orphan course with no layout; after the second, a layout with no holes. All
// three tables are community-visible (J1 grants every authenticated user
// `select ... using (true)`) and none of them grants a client DELETE, so a
// partial write was immediately public and unrepairable from here. Quick-course
// creation is a field action taken on one bar of signal, which is exactly when
// the gap between three round trips gets interrupted.
//
// `create_course_with_layout` does all three inserts in one function body, which
// is one transaction: an exception anywhere inside rolls back every row the call
// wrote. See `supabase/migrations/20260729120000_phase_e_atomic_course_creation.sql`.
//
// The ids are generated here rather than server-side so the call is a safe
// replay: re-sending the same `p_course_id` returns that course instead of
// creating a second one. That is what makes the call queueable, and
// `courseRepository.js` queues it (E2 finding 4).
//
// Building the arguments is separated from sending them because those are two
// different moments once the write is queued: the outbox entry has to be the
// exact args object — ids included, or a replay would create a second course —
// recorded before anything touches the network.
export function buildCourseCreateArgs({ name, location, holes = [] }) {
  // Validated first, before anything touches the network: a missing name or an
  // empty hole set should cost zero round trips on a bad connection, and an
  // invalid course must never reach the outbox, where it would fail on every
  // reconnect forever. The RPC repeats both checks for callers that are not
  // this function.
  if (!name?.trim()) throw new Error('Course name is required')
  if (holes.length === 0) throw new Error('A course needs at least one hole')

  return {
    p_name: name.trim(),
    p_location: location?.trim() || null,
    p_holes: holes.map((hole, index) => ({
      id: hole.id ?? crypto.randomUUID(),
      hole_number: Number(hole.hole_number ?? hole.holeNumber ?? index + 1),
      par: nullableNumber(hole.par) ?? 3,
      distance_feet: nullableNumber(hole.distance_feet ?? hole.distanceFeet),
      tee_type: hole.tee_type ?? hole.teeType ?? null,
      hazards: hole.hazards ?? null,
      strategy_notes: hole.strategy_notes ?? hole.strategyNotes ?? null,
    })),
    // No owner id: the function reads `auth.uid()` itself and accepts no owner
    // argument, so a caller cannot attribute a community course to anyone else,
    // and a stale client-side id cannot disagree with the JWT the write is
    // actually authorised under. It also means attribution survives a replay —
    // `created_by` is resolved when the call lands, not when it was queued.
    p_course_id: crypto.randomUUID(),
    p_layout_id: crypto.randomUUID(),
  }
}

// supabase-js returns `{ data, error, status }`, but the PostgrestError itself
// carries only `message`/`details`/`hint`/`code` — never `status`. The outbox's
// permanent/transient classifier keys off `status` for everything outside its
// small set of Postgres codes, and this function's own validation raises 22023
// (bad name / empty holes), 28000 (not signed in) and 42501 (course id owned by
// someone else) — none of which are in that set. Dropping the status would
// classify all three as transient and retry a rejected course on every
// reconnect forever, which is finding 2 reappearing on a different queue.
function courseRpcError(error, status) {
  const wrapped = error instanceof Error ? error : Object.assign(new Error(error.message), error)
  if (typeof status === 'number' && wrapped.status == null) wrapped.status = status
  return wrapped
}

// Returns the course id, not the course. The read-back is deliberately not part
// of this call: an outbox replay has no caller to hand a hydrated course to, and
// a read that fails after the write landed must not look like a write that
// failed. `courseRepository.js` hydrates separately, best-effort.
export async function createCourseWithLayoutRpc(args) {
  const { data, error, status } = await supabase.rpc('create_course_with_layout', args)
  if (error) {
    if (MISSING_COURSE_RPC_CODES.has(error.code == null ? '' : String(error.code))) {
      throw new Error(COURSE_CREATE_UNAVAILABLE_MESSAGE)
    }
    throw courseRpcError(error, status)
  }
  return data ?? args.p_course_id
}

export async function fetchLayoutHoles(layoutId) {
  const { data, error } = await supabase.from('holes').select('*').eq('layout_id', layoutId).order('hole_number').order('tee_type')
  return throwIfError({ data, error })
}
