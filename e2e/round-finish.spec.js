import { test, expect } from './fixtures/app'

// DEFECT_REGISTER D-16: `Finish` on the scorecard used to be a plain
// navigation `Link` to the summary — it wrote nothing. Every write that
// finishing a round performs lived (and still lives) behind the summary's own
// `Finish round` button. This suite drives the two screens together to prove
// what a unit test on either page in isolation cannot: that navigating from
// the scorecard commits nothing, and that the control now named honestly for
// that ("Review") reaches a summary whose own button is what actually
// finishes the round.

const ROUND_ID = '00000000-0000-4000-8000-0000000000f1'
const COURSE_ID = '00000000-0000-4000-8000-0000000000f2'
const LAYOUT_ID = '00000000-0000-4000-8000-0000000000f3'

const COURSE = { id: COURSE_ID, name: 'Oak Grove', location: 'Atlanta', created_by: null }
const LAYOUT = { id: LAYOUT_ID, course_id: COURSE_ID, name: 'Main', is_default: true }

const HOLES = [1, 2, 3].map((number) => ({
  id: `00000000-0000-4000-8000-00000000f10${number}`,
  layout_id: LAYOUT_ID,
  hole_number: number,
  par: 3,
  distance_feet: 250,
  tee_type: null,
  hazards: null,
  strategy_notes: null,
}))

const SCORES = [3, 4, 5] // sums to 12, so a finish writes an unambiguous total

const ROUND_HOLES = HOLES.map((hole, index) => ({
  id: `00000000-0000-4000-8000-00000000f20${index + 1}`,
  round_id: ROUND_ID,
  hole_id: hole.id,
  score: SCORES[index],
  disc_id: null,
  notes: null,
}))

function buildRound(overrides = {}) {
  return {
    id: ROUND_ID,
    course_id: COURSE_ID,
    layout_id: LAYOUT_ID,
    bag_id: null,
    bag_version_id: null,
    played_at: '2026-07-31T14:00:00.000Z',
    weather_summary: null,
    weather_condition: null,
    wind_mph: null,
    target_score: null,
    total_score: null,
    status: 'in_progress',
    created_at: '2026-07-31T14:00:00.000Z',
    ...overrides,
  }
}

async function seedRound(supabase, overrides = {}) {
  supabase.setTable('rounds', [buildRound(overrides)])
  supabase.setTable('courses', [COURSE])
  supabase.setTable('layouts', [LAYOUT])
  supabase.setTable('holes', HOLES)
  supabase.setTable('round_holes', ROUND_HOLES)
  // `finishRound` calls `finalizeRoundActivity` after the round row itself is
  // updated — the D-03 transition this pairs with. Stubbed rather than
  // asserted on here: the round-write assertions below hold regardless of
  // whether the lifecycle side succeeds, which is the whole point of
  // `finishRound`'s own try/catch around it.
  supabase.stubActivityRpcs()
  await supabase.signIn()
}

function roundPatches(supabase) {
  return supabase.writesTo('rounds').filter((write) => write.method === 'PATCH')
}

test.describe('finishing a round (DEFECT_REGISTER D-16)', () => {
  test('the scorecard control reads "Review", not "Finish"', async ({ page, supabase }) => {
    await seedRound(supabase)

    await page.goto(`/rounds/${ROUND_ID}`)
    await expect(page.getByRole('link', { name: 'Review' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Finish', exact: true })).toHaveCount(0)
  })

  test('navigating from the scorecard to the summary writes nothing', async ({ page, supabase }) => {
    await seedRound(supabase)

    await page.goto(`/rounds/${ROUND_ID}`)
    await page.getByRole('link', { name: 'Review' }).click()

    await expect(page).toHaveURL(new RegExp(`/rounds/${ROUND_ID}/summary$`))
    // The regression this test exists for: reaching the summary must not, by
    // itself, have finished the round.
    expect(roundPatches(supabase)).toHaveLength(0)
    await expect(page.locator('.round-summary-stat').filter({ hasText: 'Status' })).toContainText('In progress')
  })

  test('the summary\'s own button is what actually finishes the round', async ({ page, supabase }) => {
    await seedRound(supabase)

    await page.goto(`/rounds/${ROUND_ID}`)
    await page.getByRole('link', { name: 'Review' }).click()
    await expect(page).toHaveURL(new RegExp(`/rounds/${ROUND_ID}/summary$`))

    await page.getByRole('button', { name: 'Finish round' }).click()

    await expect.poll(() => roundPatches(supabase).at(-1)?.body).toMatchObject({
      status: 'completed',
      total_score: 12,
    })
    // Not asserted against the rendered "Status" stat, and not asserting
    // `rpc:activity_transition` fired (that is the D-03 transition
    // `finalizeRoundActivity` also attempts here — real, but exercising it
    // needs a seeded *local* activity mirror row, which is its own fixture
    // concern and not what D-16 is about): this fixture backend echoes a
    // write's body back without mutating its own table store, so
    // `finishRound`'s follow-up `fetchRound` re-reads the unmodified seed row
    // rather than a real database's updated one. `roundRepository.test.js`
    // and `roundRepository.createRound.test.js` cover the lifecycle and
    // outbox mechanics directly; this suite is the "the right control writes
    // the right thing" check the register asked for.
  })
})
