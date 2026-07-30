import { test, expect, TEST_USER } from './fixtures/app'

// Course preparation, driven through the screen that owns it.
//
// `src/lib/insights/coursePrep.test.js` covers the arithmetic. What only a
// browser can show is which of those results actually reach the page — and in
// particular that the two states this feature ships into render correctly:
// a course with no rounds behind it at all, and a course with one.
//
// The live database holds 0 courses and 0 rounds, so those are not edge cases
// here. They are the feature.

const COURSE_ID = '00000000-0000-4000-8000-0000000000c1'
const LAYOUT_ID = '00000000-0000-4000-8000-0000000000c2'
const LAYOUT_B_ID = '00000000-0000-4000-8000-0000000000c3'
const ROUND_ID = '00000000-0000-4000-8000-0000000000c4'
const DISC_ID = '00000000-0000-4000-8000-0000000000c5'

const COURSE = { id: COURSE_ID, name: 'Oak Grove', location: 'Atlanta', created_by: null }
const LAYOUT = { id: LAYOUT_ID, course_id: COURSE_ID, name: 'Main', is_default: true }
const LAYOUT_B = { id: LAYOUT_B_ID, course_id: COURSE_ID, name: 'Back Tees', is_default: false }

function buildHole(id, layoutId, number, overrides = {}) {
  return {
    id,
    layout_id: layoutId,
    hole_number: number,
    par: 3,
    distance_feet: 240,
    tee_type: null,
    hazards: null,
    strategy_notes: null,
    ...overrides,
  }
}

// Three holes: one plain, one long par 4 carrying both prose fields, and one
// whose distance was never entered — which is what a quick course typed in at
// the first tee actually looks like.
const HOLES = [
  buildHole('00000000-0000-4000-8000-00000000d001', LAYOUT_ID, 1),
  buildHole('00000000-0000-4000-8000-00000000d002', LAYOUT_ID, 2, {
    par: 4,
    distance_feet: 480,
    hazards: 'water down the left',
    strategy_notes: 'lay up short of the creek',
  }),
  buildHole('00000000-0000-4000-8000-00000000d003', LAYOUT_ID, 3, { distance_feet: null }),
]

async function seedCourse(supabase, { layouts = [LAYOUT], holes = HOLES } = {}) {
  supabase.setTable('courses', [COURSE])
  supabase.setTable('layouts', layouts)
  supabase.setTable('holes', holes)
  supabase.setTable('rounds', [])
  supabase.setTable('round_holes', [])
  await supabase.signIn()
}

test.describe('course prep with no rounds behind it', () => {
  test('reads the layout out of the course record alone', async ({ page, supabase }) => {
    await seedCourse(supabase)
    await page.goto(`/courses/${COURSE_ID}/prep?layoutId=${LAYOUT_ID}`)

    const brief = page.getByRole('region', { name: 'The layout' })
    await expect(brief).toContainText('3 holes · par 10')
    // Only the two holes that have a distance contribute to the total, and the
    // page says so rather than reporting 720 ft as though it covered the course.
    await expect(brief).toContainText('720 ft')
    await expect(brief).toContainText('Distance recorded on 2 of 3 holes')
    await expect(brief).toContainText('Longest hole 2 at 480 ft')
    await expect(brief).toContainText('2 × par 3 · 1 × par 4')

    const holes = page.getByRole('region', { name: 'Hole by hole' })
    await expect(holes).toContainText('Hazards: water down the left')
    await expect(holes).toContainText('lay up short of the creek')
    await expect(holes).toContainText('distance —')
  })

  test('says the scouting half is empty instead of showing an empty heading', async ({ page, supabase }) => {
    await seedCourse(supabase)
    await page.goto(`/courses/${COURSE_ID}/prep?layoutId=${LAYOUT_ID}`)

    await expect(page.getByRole('region', { name: 'Hole by hole' })).toContainText(
      'No completed rounds on this layout yet',
    )
    // Nothing has cleared the sample floor, so the section that would rank
    // holes is absent entirely.
    await expect(page.getByRole('region', { name: 'Where the strokes go' })).toHaveCount(0)
    await expect(page.getByText('Played once')).toHaveCount(0)
  })

  test('offers a prep sheet from the course detail screen', async ({ page, supabase }) => {
    await seedCourse(supabase)
    await page.goto(`/courses/${COURSE_ID}`)

    await page.getByRole('link', { name: 'Prep sheet' }).click()
    await expect(page.getByRole('region', { name: 'The layout' })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/courses/${COURSE_ID}/prep`))
  })

  test('switches layouts without leaving the sheet', async ({ page, supabase }) => {
    await seedCourse(supabase, {
      layouts: [LAYOUT, LAYOUT_B],
      holes: [...HOLES, buildHole('00000000-0000-4000-8000-00000000d101', LAYOUT_B_ID, 1, { distance_feet: 500 })],
    })
    await page.goto(`/courses/${COURSE_ID}/prep?layoutId=${LAYOUT_ID}`)

    await expect(page.getByRole('region', { name: 'The layout' })).toContainText('3 holes · par 10')
    await page.getByRole('button', { name: 'Back Tees' }).click()
    await expect(page.getByRole('region', { name: 'The layout' })).toContainText('1 hole · par 3')
    await expect(page.getByRole('region', { name: 'The layout' })).toContainText('500 ft')
  })
})

test.describe('course prep with one round behind it', () => {
  // One round is a fact, not a trend. The page has to say what happened without
  // dressing it up as an average — this is the assertion that keeps the sample
  // floor honest all the way to the screen.
  test('reports counts and totals but withholds every average', async ({ page, supabase }) => {
    await seedCourse(supabase)
    supabase.setTable('rounds', [
      {
        id: ROUND_ID,
        user_id: TEST_USER.id,
        course_id: COURSE_ID,
        layout_id: LAYOUT_ID,
        status: 'completed',
        played_at: '2026-07-25T14:00:00.000Z',
        total_score: 12,
        created_at: '2026-07-25T14:00:00.000Z',
      },
    ])
    supabase.setTable('round_holes', [
      { id: 'rh-1', round_id: ROUND_ID, hole_id: HOLES[0].id, score: 4, disc_id: DISC_ID, notes: null },
      { id: 'rh-2', round_id: ROUND_ID, hole_id: HOLES[1].id, score: 5, disc_id: null, notes: null },
      { id: 'rh-3', round_id: ROUND_ID, hole_id: HOLES[2].id, score: 3, disc_id: null, notes: null },
    ])
    supabase.setTable('discs', [
      { id: DISC_ID, user_id: TEST_USER.id, nickname: 'Wraith', mold: 'Wraith', status: 'in_locker', moldInfo: { category: 'distance' } },
    ])

    await page.goto(`/courses/${COURSE_ID}/prep?layoutId=${LAYOUT_ID}`)

    const holes = page.getByRole('region', { name: 'Hole by hole' })
    await expect(holes).toContainText('Played once · best 4 · +1 total')
    await expect(holes).not.toContainText('avg')
    // "Thrown here", not "throw this": the page reports what the player did,
    // which is the only disc claim this data can support.
    await expect(holes).toContainText('Thrown here: Wraith ×1')

    await expect(page.getByRole('region', { name: 'Where the strokes go' })).toHaveCount(0)

    const carry = page.getByRole('region', { name: 'What you carry' })
    await expect(carry).toContainText('1 disc in your locker')
    await expect(carry).toContainText('distance')
  })
})
