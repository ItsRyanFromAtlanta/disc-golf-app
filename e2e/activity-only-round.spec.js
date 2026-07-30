import { test, expect } from './fixtures/app'

// Activity-only rounds, driven through the screens that create and read them.
//
// The mode vocabulary, the write normalizer and the score-source rules are
// covered by `src/lib/roundScoring.test.js`. What only a browser can show is
// that the choice on the start form reaches the wire as `scoring_mode`, that an
// ordinary round still sends no such column, and that a round without a
// scorecard never renders a card of empty inputs that would start writing
// `round_holes` nobody asked for.
//
// Deliberately not verified here: the fixture backend is not Postgres, so it
// accepts `scoring_mode` on a `rounds` table whose migration has not been
// applied. Schema truth stays with the SQL.

const ROUND_ID = '00000000-0000-4000-8000-0000000000a1'
const COURSE_ID = '00000000-0000-4000-8000-0000000000a2'
const LAYOUT_ID = '00000000-0000-4000-8000-0000000000a3'

const COURSE = { id: COURSE_ID, name: 'Oak Grove', location: 'Atlanta', created_by: null }
const LAYOUT = { id: LAYOUT_ID, course_id: COURSE_ID, name: 'Main', is_default: true }

const HOLES = [1, 2, 3].map((number) => ({
  id: `00000000-0000-4000-8000-00000000a00${number}`,
  layout_id: LAYOUT_ID,
  hole_number: number,
  par: 3,
  distance_feet: 250,
  tee_type: null,
  hazards: null,
  strategy_notes: null,
}))

function buildRound(overrides = {}) {
  return {
    id: ROUND_ID,
    course_id: COURSE_ID,
    layout_id: LAYOUT_ID,
    bag_id: null,
    bag_version_id: null,
    played_at: '2026-07-30T14:00:00.000Z',
    weather_summary: null,
    weather_condition: null,
    wind_mph: null,
    scoring_mode: 'activity_only',
    target_score: null,
    total_score: null,
    status: 'in_progress',
    created_at: '2026-07-30T14:00:00.000Z',
    ...overrides,
  }
}

async function seedCatalog(supabase) {
  supabase.setTable('courses', [COURSE])
  supabase.setTable('layouts', [LAYOUT])
  supabase.setTable('holes', HOLES)
  supabase.setTable('round_holes', [])
  supabase.stubActivityRpcs()
  await supabase.signIn()
}

async function seedRound(supabase, overrides = {}) {
  supabase.setTable('rounds', [buildRound(overrides)])
  await seedCatalog(supabase)
}

function roundInserts(supabase) {
  return supabase.writesTo('rounds').filter((write) => write.method === 'POST')
}

function lastRoundPatch(supabase) {
  const patches = supabase.writesTo('rounds').filter((write) => write.method === 'PATCH')
  return patches.at(-1)?.body ?? null
}

test.describe('starting an activity-only round', () => {
  test('sends scoring_mode and lands on the summary, not a scorecard', async ({ page, supabase }) => {
    supabase.setTable('rounds', [])
    await seedCatalog(supabase)

    await page.goto('/rounds/new')
    await page.getByRole('radio', { name: /Activity only/ }).check()

    // The layout stops being required — that is the friction this removes.
    await expect(page.getByLabel('Layout (optional)')).toBeVisible()
    await page.getByLabel('Layout (optional)').selectOption('')
    await page.getByRole('button', { name: 'Log round' }).click()

    await expect.poll(() => roundInserts(supabase).at(-1)?.body?.scoring_mode).toBe('activity_only')
    await expect.poll(() => roundInserts(supabase).at(-1)?.body?.layout_id).toBeNull()

    // Straight to the summary. Routing to the scorecard would open a card the
    // round is defined by not having.
    await expect(page).toHaveURL(/\/rounds\/[0-9a-f-]+\/summary$/)
    await expect(page.getByRole('region', { name: 'Activity-only round' })).toBeVisible()
  })

  // The deploy-window narrowing, asserted at the wire rather than trusted. An
  // ordinary round must send exactly what it sent before this feature existed,
  // so it keeps working while the migration is still in flight.
  test('an ordinary scorecard round sends no scoring_mode column at all', async ({ page, supabase }) => {
    supabase.setTable('rounds', [])
    await seedCatalog(supabase)

    await page.goto('/rounds/new')
    await page.getByRole('button', { name: 'Start round' }).click()

    await expect.poll(() => roundInserts(supabase).length).toBeGreaterThan(0)
    const body = roundInserts(supabase).at(-1).body
    expect(Object.hasOwn(body, 'scoring_mode')).toBe(false)
    expect(body.layout_id).toBe(LAYOUT_ID)
    await expect(page).toHaveURL(/\/rounds\/[0-9a-f-]+$/)
  })
})

test.describe('reading an activity-only round', () => {
  test('the summary shows no hole list and no invented even-par score', async ({ page, supabase }) => {
    await seedRound(supabase)

    await page.goto(`/rounds/${ROUND_ID}/summary`)
    await expect(page.getByRole('region', { name: 'Activity-only round' })).toBeVisible()

    // Neither number may read "E" or "0": nothing was recorded, and
    // `relativeToPar` over an empty card returns 0, which formats as even par.
    const stats = page.locator('.round-summary-stat')
    await expect(stats.filter({ hasText: 'Relative to par' })).toContainText('—')
    await expect(stats.filter({ hasText: 'Total strokes' })).toContainText('—')
    await expect(page.locator('.round-summary-holes')).toHaveCount(0)
  })

  test('a stated total is saved and labelled as stated, not derived', async ({ page, supabase }) => {
    await seedRound(supabase)

    await page.goto(`/rounds/${ROUND_ID}/summary`)
    await page.getByLabel('Total strokes (optional)').fill('12')
    await page.getByRole('button', { name: 'Save total' }).click()

    await expect.poll(() => lastRoundPatch(supabase)).toEqual({ total_score: 12 })

    // Layout par is 9, so a stated 12 is +3 — and it says where that came from.
    const stats = page.locator('.round-summary-stat')
    await expect(stats.filter({ hasText: 'Total strokes' })).toContainText('Entered by you')
    await expect(stats.filter({ hasText: 'Relative to par' })).toContainText('+3')
    await expect(stats.filter({ hasText: 'Relative to par' })).toContainText('Entered total vs layout par')
  })

  test('without a layout there is nothing to be relative to', async ({ page, supabase }) => {
    await seedRound(supabase, { layout_id: null, total_score: 54 })

    await page.goto(`/rounds/${ROUND_ID}/summary`)
    const stats = page.locator('.round-summary-stat')
    await expect(stats.filter({ hasText: 'Total strokes' })).toContainText('54')
    // The failure mode being prevented: printing the raw 54 as a score to par.
    await expect(stats.filter({ hasText: 'Relative to par' })).toContainText('—')
    await expect(page.getByText('No layout recorded')).toBeVisible()
  })

  test('the scorecard route explains itself instead of opening a blank card', async ({ page, supabase }) => {
    // Reachable by bookmark or an old link. Rendering the card would silently
    // start writing `round_holes` for a round that is defined by not having any.
    await seedRound(supabase)

    await page.goto(`/rounds/${ROUND_ID}`)
    await expect(page.getByText('Logged without a scorecard')).toBeVisible()
    await expect(page.getByLabel('Score for hole 1')).toHaveCount(0)
    await page.getByRole('link', { name: 'Summary' }).click()
    await expect(page).toHaveURL(new RegExp(`/rounds/${ROUND_ID}/summary$`))
  })

  test('the rounds list marks the blank as deliberate and counts the round', async ({ page, supabase }) => {
    await seedRound(supabase, { status: 'completed' })

    await page.goto('/rounds')
    await expect(page.getByText('No scorecard')).toBeVisible()
    // Volume counts it — that is the entire argument for logging it.
    await expect(page.getByRole('region', { name: 'Round volume' })).toContainText('1 round')
    await expect(page.getByRole('region', { name: 'Round volume' })).toContainText('1 without a scorecard')
  })
})
