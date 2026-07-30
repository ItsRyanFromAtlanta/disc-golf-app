import { test, expect } from './fixtures/app'

// Round conditions, driven through the screens that own them.
//
// The pure normalization is covered by `src/lib/roundWeather.test.js`; what
// only a browser can show is that the control reaches those functions with what
// the player actually tapped, and that the PATCH leaving the device carries all
// three columns rather than whichever one the form happened to touch.
//
// Note what this deliberately cannot verify: the fixture backend is not
// Postgres, so it will happily accept `weather_condition` on a `rounds` table
// whose migration has not been applied. Schema truth stays with the SQL checks.

const ROUND_ID = '00000000-0000-4000-8000-0000000000e1'
const COURSE_ID = '00000000-0000-4000-8000-0000000000e2'
const LAYOUT_ID = '00000000-0000-4000-8000-0000000000e3'

const COURSE = { id: COURSE_ID, name: 'Oak Grove', location: 'Atlanta', created_by: null }
const LAYOUT = { id: LAYOUT_ID, course_id: COURSE_ID, name: 'Main', is_default: true }

const HOLES = [1, 2, 3].map((number) => ({
  id: `00000000-0000-4000-8000-00000000f00${number}`,
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
    target_score: null,
    total_score: null,
    status: 'in_progress',
    created_at: '2026-07-30T14:00:00.000Z',
    ...overrides,
  }
}

async function seedRound(supabase, overrides = {}) {
  supabase.setTable('rounds', [buildRound(overrides)])
  supabase.setTable('courses', [COURSE])
  supabase.setTable('layouts', [LAYOUT])
  supabase.setTable('holes', HOLES)
  supabase.setTable('round_holes', [])
  await supabase.signIn()
}

/** The last PATCH the round table received, which is the write under test. */
function lastRoundPatch(supabase) {
  const patches = supabase.writesTo('rounds').filter((write) => write.method === 'PATCH')
  return patches.at(-1)?.body ?? null
}

test.describe('round conditions on the scorecard', () => {
  test('records a condition, a wind speed, and a note in one write', async ({ page, supabase }) => {
    await seedRound(supabase)

    await page.goto(`/rounds/${ROUND_ID}`)
    const panel = page.getByRole('region', { name: 'Round conditions' })
    await expect(panel).toContainText('Conditions not recorded')

    await panel.getByRole('button', { name: 'Add conditions' }).click()
    await panel.getByRole('button', { name: 'Headwind' }).click()
    await panel.getByLabel('Wind (mph)').fill('14')
    await panel.getByLabel('Notes (optional)').fill('gusting after the turn')
    await panel.getByRole('button', { name: 'Save conditions' }).click()

    // All three columns, together — `weather_summary` predates the structured
    // pair and a partial patch would leave the two halves disagreeing.
    await expect.poll(() => lastRoundPatch(supabase)).toEqual({
      weather_condition: 'headwind',
      wind_mph: 14,
      weather_summary: 'gusting after the turn',
    })

    // The editor closes and the reading reflects what was saved.
    await expect(panel.getByRole('button', { name: 'Save conditions' })).toBeHidden()
    await expect(panel).toContainText('Headwind · 14 mph wind · gusting after the turn')
  })

  // `clear` carries no direction to attribute a speed to, so the field is not
  // offered and no speed is written — matching the practice weather drawer.
  test('offers no wind field for clear, and writes none', async ({ page, supabase }) => {
    await seedRound(supabase)

    await page.goto(`/rounds/${ROUND_ID}`)
    const panel = page.getByRole('region', { name: 'Round conditions' })
    await panel.getByRole('button', { name: 'Add conditions' }).click()

    await panel.getByRole('button', { name: 'Crosswind' }).click()
    await expect(panel.getByLabel('Wind (mph)')).toBeVisible()

    await panel.getByRole('button', { name: 'Clear' }).click()
    await expect(panel.getByLabel('Wind (mph)')).toBeHidden()

    await panel.getByRole('button', { name: 'Save conditions' }).click()
    await expect.poll(() => lastRoundPatch(supabase)?.wind_mph).toBeNull()
    await expect.poll(() => lastRoundPatch(supabase)?.weather_condition).toBe('clear')
  })

  // Weather is optional, so a mis-tap has to be undoable. Without this the only
  // way out of a wrong chip is to save a condition the round did not have.
  test('tapping the selected condition again clears it', async ({ page, supabase }) => {
    await seedRound(supabase, { weather_condition: 'rain' })

    await page.goto(`/rounds/${ROUND_ID}`)
    const panel = page.getByRole('region', { name: 'Round conditions' })
    await expect(panel).toContainText('Rain')

    await panel.getByRole('button', { name: 'Edit conditions' }).click()
    await panel.getByRole('button', { name: 'Rain' }).click()
    await panel.getByRole('button', { name: 'Save conditions' }).click()

    await expect.poll(() => lastRoundPatch(supabase)?.weather_condition).toBeNull()
    await expect(panel).toContainText('Conditions not recorded')
  })

  // An abandoned edit must not survive as though it had been saved.
  test('cancelling discards the draft', async ({ page, supabase }) => {
    await seedRound(supabase)

    await page.goto(`/rounds/${ROUND_ID}`)
    const panel = page.getByRole('region', { name: 'Round conditions' })
    await panel.getByRole('button', { name: 'Add conditions' }).click()
    await panel.getByRole('button', { name: 'Rain' }).click()
    await panel.getByRole('button', { name: 'Cancel' }).click()

    expect(lastRoundPatch(supabase)).toBeNull()
    await expect(panel).toContainText('Conditions not recorded')

    await panel.getByRole('button', { name: 'Add conditions' }).click()
    await expect(panel.getByRole('button', { name: 'Rain' })).toHaveAttribute('aria-pressed', 'false')
  })
})

test.describe('round conditions on the summary', () => {
  // A finished round is the realistic moment to remember the wind, and it is
  // the only screen a completed round still opens on.
  test('a completed round can still have its conditions corrected', async ({ page, supabase }) => {
    await seedRound(supabase, { status: 'completed', total_score: 9 })

    await page.goto(`/rounds/${ROUND_ID}/summary`)
    const panel = page.getByRole('region', { name: 'Round conditions' })
    await expect(panel).toBeVisible()

    await panel.getByRole('button', { name: 'Add conditions' }).click()
    await panel.getByRole('button', { name: 'Tailwind' }).click()
    await panel.getByLabel('Wind (mph)').fill('8')
    await panel.getByRole('button', { name: 'Save conditions' }).click()

    await expect.poll(() => lastRoundPatch(supabase)).toEqual({
      weather_condition: 'tailwind',
      wind_mph: 8,
      weather_summary: null,
    })
    await expect(panel).toContainText('Tailwind · 8 mph wind')
  })
})
