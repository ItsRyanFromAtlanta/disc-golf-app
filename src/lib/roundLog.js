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

export async function upsertRoundHole(input = {}) {
  const payload = normalizeHoleFields(input)
  const { data, error } = await supabase.from('round_holes').upsert(payload, { onConflict: 'id' }).select().single()
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

export async function createCourseWithLayout({ userId, name, location, holes = [] }) {
  let ownerId = userId
  if (!ownerId) {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    ownerId = data.user?.id
  }
  if (!ownerId) throw new Error('You must be signed in to create a course')
  if (!name?.trim()) throw new Error('Course name is required')
  if (holes.length === 0) throw new Error('A course needs at least one hole')

  const courseId = crypto.randomUUID()
  const layoutId = crypto.randomUUID()
  const { error: courseError } = await supabase.from('courses').upsert(
    {
      id: courseId,
      name: name.trim(),
      location: location?.trim() || null,
      created_by: ownerId,
    },
    { onConflict: 'id' },
  )
  if (courseError) throw courseError

  const { error: layoutError } = await supabase.from('layouts').upsert(
    { id: layoutId, course_id: courseId, name: 'Main', is_default: true },
    { onConflict: 'id' },
  )
  if (layoutError) throw layoutError

  const holeRows = holes.map((hole, index) => ({
    id: hole.id ?? crypto.randomUUID(),
    layout_id: layoutId,
    hole_number: Number(hole.hole_number ?? hole.holeNumber ?? index + 1),
    par: nullableNumber(hole.par) ?? 3,
    distance_feet: nullableNumber(hole.distance_feet ?? hole.distanceFeet),
    tee_type: hole.tee_type ?? hole.teeType ?? null,
    hazards: hole.hazards ?? null,
    strategy_notes: hole.strategy_notes ?? hole.strategyNotes ?? null,
  }))
  const { error: holesError } = await supabase.from('holes').upsert(holeRows, { onConflict: 'id' })
  if (holesError) throw holesError

  return fetchCourse(courseId)
}

export async function fetchLayoutHoles(layoutId) {
  const { data, error } = await supabase.from('holes').select('*').eq('layout_id', layoutId).order('hole_number').order('tee_type')
  return throwIfError({ data, error })
}
